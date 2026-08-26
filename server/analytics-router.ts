import { z } from "zod";
import { authedQuery, createRouter } from "./middleware";
import { listPositions } from "./queries/portfolio";
import { resolveMarketData } from "./analytics/marketData";
import {
  buildRiskReport,
  estimateIv30,
  scanCoveredCalls,
} from "./analytics/engine";
import { calculatePortfolioGreeks } from "./analytics/betaGreeks";

export const analyticsRouter = createRouter({
  /**
   * Covered-call suggestions ("basis improvement") for every long stock/ETF
   * holding with at least 100 shares.
   */
  basisSuggestions: authedQuery.query(async ({ ctx }) => {
    const rows = await listPositions(ctx.user.id);

    // Aggregate long equity holdings per symbol.
    const bySymbol = new Map<
      string,
      { shares: number; totalCost: number; description?: string }
    >();
    for (const p of rows) {
      if (p.assetType !== "stock" && p.assetType !== "etf") continue;
      if (p.quantity <= 0) continue;
      const cur = bySymbol.get(p.symbol) ?? { shares: 0, totalCost: 0 };
      cur.shares += p.quantity;
      cur.totalCost += (p.costBasis ?? p.price ?? 0) * p.quantity;
      cur.description = cur.description ?? p.description ?? undefined;
      bySymbol.set(p.symbol, cur);
    }

    const eligible = [...bySymbol.entries()].filter(([, v]) => v.shares >= 100);
    if (eligible.length === 0) {
      return {
        mode: "demo" as const,
        suggestions: [],
        errors: [] as string[],
        message:
          "No long stock positions with 100+ shares — covered calls need at least one round lot.",
      };
    }

    const market = await resolveMarketData(
      ctx.user.id,
      eligible.map(([sym]) => sym),
    );

    const suggestions = eligible.map(([symbol, v]) => {
      const basis = v.totalCost / v.shares;
      const spot = market.spots[symbol] ?? 0;
      const chain = market.chains[symbol] ?? [];
      const candidates = scanCoveredCalls({
        symbol,
        spot,
        basis,
        shares: v.shares,
        contracts: chain,
      });
      return {
        symbol,
        description: v.description ?? null,
        shares: v.shares,
        basis: +basis.toFixed(2),
        spot,
        best: candidates[0] ?? null,
        alternatives: candidates.slice(1),
      };
    });

    suggestions.sort((a, b) => (b.best?.score ?? 0) - (a.best?.score ?? 0));
    return { mode: market.mode, suggestions, errors: market.errors, message: null };
  }),

  /**
   * Per-underlying extreme-risk / expected-move report ("risk analysis")
   * plus portfolio-level concentration.
   */
  riskReports: authedQuery.query(async ({ ctx }) => {
    const rows = await listPositions(ctx.user.id);
    if (rows.length === 0) {
      return { mode: "demo" as const, reports: [], portfolioValue: 0, errors: [] as string[] };
    }

    const symbols = [...new Set(rows.map((p) => p.symbol))];
    const market = await resolveMarketData(ctx.user.id, symbols);

    // market value per underlying
    const valueBySymbol = new Map<string, number>();
    const shortOptBySymbol = new Map<string, boolean>();
    const basisBySymbol = new Map<string, { qty: number; cost: number }>();

    for (const p of rows) {
      const spot = market.spots[p.symbol] ?? p.price ?? p.costBasis ?? 0;
      let mv = 0;
      if (p.assetType === "option") {
        mv = Math.abs(p.quantity) * 100 * (p.price ?? p.costBasis ?? 0);
        if (p.quantity < 0) shortOptBySymbol.set(p.symbol, true);
      } else {
        mv = p.quantity * spot;
        const cur = basisBySymbol.get(p.symbol) ?? { qty: 0, cost: 0 };
        if (p.quantity > 0) {
          cur.qty += p.quantity;
          cur.cost += (p.costBasis ?? spot) * p.quantity;
          basisBySymbol.set(p.symbol, cur);
        }
      }
      valueBySymbol.set(p.symbol, (valueBySymbol.get(p.symbol) ?? 0) + mv);
    }

    const portfolioValue = [...valueBySymbol.values()].reduce((a, b) => a + b, 0);

    const reports = [...valueBySymbol.entries()].map(([symbol, mv]) => {
      const chain = market.chains[symbol] ?? [];
      const spot = market.spots[symbol] ?? 0;
      const iv30 = estimateIv30(chain, spot);
      const agg = basisBySymbol.get(symbol);
      return {
        ...buildRiskReport({
          symbol,
          spot,
          iv30,
          basis: agg && agg.qty > 0 ? agg.cost / agg.qty : null,
          marketValue: mv,
          portfolioValue,
          hasShortOptions: shortOptBySymbol.get(symbol) ?? false,
          contracts: chain,
        }),
        description:
          rows.find((p) => p.symbol === symbol && p.description)?.description ??
          null,
      };
    });

    reports.sort((a, b) => b.riskScore - a.riskScore);
    return {
      mode: market.mode,
      reports,
      portfolioValue: +portfolioValue.toFixed(2),
      errors: market.errors,
    };
  }),

  /**
   * Interactive Expected Move / Volatility Box calculator for any symbol.
   * Allows stress-testing custom DTEs and IV shocks.
   */
  expectedMoveLookup: authedQuery
    .input(
      z.object({
        symbol: z.string(),
        dte: z.number().optional(),
        ivShockPct: z.number().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const sym = input.symbol.trim().toUpperCase();
      if (!sym) {
        throw new Error("Symbol is required");
      }
      const market = await resolveMarketData(ctx.user.id, [sym]);
      const spot = market.spots[sym] ?? 0;
      const chain = market.chains[sym] ?? [];
      let iv30 = estimateIv30(chain, spot);
      if (iv30 != null && input.ivShockPct != null && input.ivShockPct !== 0) {
        iv30 = Math.max(0.02, iv30 * (1 + input.ivShockPct / 100));
      }
      const report = buildRiskReport({
        symbol: sym,
        spot,
        iv30,
        basis: null,
        marketValue: 10000,
        portfolioValue: 10000,
        hasShortOptions: false,
        dte: input.dte ?? 22,
        contracts: chain,
      });
      return { report, mode: market.mode };
    }),

  /**
   * Portfolio Greeks, SPX Beta-Weighted Delta, and Net Delta Breakdown across all positions.
   */
  portfolioGreeks: authedQuery.query(async ({ ctx }) => {
    const rows = await listPositions(ctx.user.id);
    if (rows.length === 0) {
      return {
        mode: "demo" as const,
        greeks: calculatePortfolioGreeks({ positions: [], spots: {} }),
        errors: [] as string[],
      };
    }

    const symbols = [...new Set([...rows.map((p) => p.symbol), "SPY"])];
    const market = await resolveMarketData(ctx.user.id, symbols);

    const greeks = calculatePortfolioGreeks({
      positions: rows,
      spots: market.spots,
      chains: market.chains,
      spySpot: market.spots["SPY"],
    });

    return {
      mode: market.mode,
      greeks,
      errors: market.errors,
    };
  }),
});

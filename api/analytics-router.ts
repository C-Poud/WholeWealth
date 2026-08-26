import { authedQuery, createRouter } from "./middleware";
import { listPositions } from "./queries/portfolio";
import { resolveMarketData } from "./analytics/marketData";
import {
  buildRiskReport,
  estimateIv30,
  scanCoveredCalls,
} from "./analytics/engine";

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
      return buildRiskReport({
        symbol,
        spot,
        iv30,
        basis: agg && agg.qty > 0 ? agg.cost / agg.qty : null,
        marketValue: mv,
        portfolioValue,
        hasShortOptions: shortOptBySymbol.get(symbol) ?? false,
      });
    });

    reports.sort((a, b) => b.riskScore - a.riskScore);
    return {
      mode: market.mode,
      reports,
      portfolioValue: +portfolioValue.toFixed(2),
      errors: market.errors,
    };
  }),
});

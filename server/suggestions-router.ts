import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedQuery, createRouter } from "./middleware";
import { getSetting, listPositions } from "./queries/portfolio";
import { getYahooBetas } from "./analytics/yahoo";
import { getSpotsWithFallback } from "./analytics/symbolInfo";
import { bsCallPrice } from "./analytics/blackScholes";

/** Assumed |delta| for option positions whose greeks we don't know. */
const ASSUMED_OPTION_DELTA = 0.5;
/** Target delta of the SPX hedge contracts we suggest. */
const HEDGE_DELTA = 0.3;
/** Assumed SPX 30-day IV for premium estimates. */
const ASSUMED_SPX_IV = 0.16;
/** Below this absolute SPX delta the portfolio counts as neutral. */
const NEUTRAL_THRESHOLD_DOLLARS = 500;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Put price via put–call parity on the shared call pricer. */
function bsPutPrice(input: {
  spot: number;
  strike: number;
  yearsToExpiry: number;
  rate?: number;
  vol: number;
}): number {
  const rate = input.rate ?? 0.045;
  const call = bsCallPrice({ ...input, rate });
  return Math.max(
    0,
    call - input.spot + input.strike * Math.exp(-rate * input.yearsToExpiry),
  );
}

export interface TradeIdea {
  id: string;
  title: string;
  action: string; // e.g. "BUY 4 SPX PUTS"
  instrument: string;
  quantity: number;
  estCost: number | null;
  deltaRemoved: number; // SPX beta-weighted $ delta this trade offsets
  rationale: string[];
}

export const suggestionsRouter = createRouter({
  /**
   * SPX beta-weighted delta analysis: computes the portfolio's delta
   * expressed in S&P 500 dollars, then suggests concrete hedge trades
   * to bring the book to delta-neutral.
   */
  spxNeutral: authedQuery.query(async ({ ctx }) => {
    const positions = (await listPositions(ctx.user.id)).filter(
      (p) => p.quantity !== 0,
    );
    if (positions.length === 0) {
      return {
        hasPositions: false as const,
        message:
          "Add positions first — connect a brokerage, import a file, or load the demo portfolio.",
      };
    }

    const symbols = [...new Set(positions.map((p) => p.symbol.toUpperCase()))];
    const [spots, betas, indexSpots] = await Promise.all([
      getSpotsWithFallback(symbols),
      getYahooBetas(symbols).catch(() => ({}) as Record<string, number>),
      getSpotsWithFallback(["^GSPC", "SPY"]),
    ]);
    const spxSpot = indexSpots["^GSPC"] ?? null;
    const spySpot = indexSpots["SPY"] ?? null;

    let portfolioValue = 0;
    const breakdown = positions.map((p) => {
      const sym = p.symbol.toUpperCase();
      const spot = spots[sym] ?? p.price ?? p.costBasis ?? 0;
      const beta = betas[sym] ?? 1;
      const mult = p.assetType === "option" ? 100 : 1;
      const posVal = p.quantity * spot * mult;
      portfolioValue += Math.abs(posVal);

      let deltaDollars: number;
      let rawDelta = 0; // instrument delta (e.g. 100 shares = +100 delta)

      if (p.assetType === "option") {
        const dir = p.optionType === "put" ? -1 : 1;
        rawDelta = dir * ASSUMED_OPTION_DELTA * 100 * p.quantity;
        deltaDollars = rawDelta * spot * beta;
      } else {
        rawDelta = p.quantity;
        deltaDollars = p.quantity * spot * beta;
      }

      // SPX beta delta in decimal shares/equivalent
      const spxDecimalDelta = spxSpot && spxSpot > 0 ? deltaDollars / spxSpot : (spot > 0 ? (rawDelta * beta) : 0);

      return {
        symbol: sym,
        assetType: p.assetType,
        quantity: p.quantity,
        price: round2(spot),
        beta: round2(beta),
        spxDeltaDollars: round2(deltaDollars),
        spxDelta: round2(deltaDollars), // backwards-compatible field
        spxBetaDelta: +(spxDecimalDelta.toFixed(2)), // decimal delta unit (e.g. +14.25 SPX Δ)
      };
    });

    const totalDeltaDollars = round2(
      breakdown.reduce((sum, b) => sum + b.spxDeltaDollars, 0),
    );
    const absDeltaDollars = Math.abs(totalDeltaDollars);
    const neutral = absDeltaDollars < NEUTRAL_THRESHOLD_DOLLARS;

    // Whole portfolio weighted beta = sum(weight_i * beta_i)
    let weightedBetaSum = 0;
    for (const b of breakdown) {
      weightedBetaSum += Math.abs(b.quantity * b.price * (b.assetType === "option" ? 100 : 1)) * b.beta;
    }
    const portfolioBeta = portfolioValue > 0 ? +(weightedBetaSum / portfolioValue).toFixed(2) : 1.0;

    // Portfolio SPX Beta-Weighted Delta in pure decimals (SPX contract / index equivalent shares)
    // Beta-Weighted Delta (Decimal) = Total Beta Dollar Delta / SPX Index Price
    const spxBetaDeltaDecimal = spxSpot && spxSpot > 0 ? +(totalDeltaDollars / spxSpot).toFixed(2) : 0;
    // SPY ETF equivalent shares (1/10th SPX)
    const spyBetaDeltaDecimal = spySpot && spySpot > 0 ? +(totalDeltaDollars / spySpot).toFixed(2) : +(spxBetaDeltaDecimal * 10).toFixed(2);

    const ideas: TradeIdea[] = [];
    if (!neutral && spxSpot) {
      const long = totalDeltaDollars > 0; // net long → add negative delta
      const absDelta = absDeltaDollars;
      const T = 30 / 365;

      if (long) {
        // Idea 1: buy SPX puts (~30Δ, 30 DTE)
        const putStrike = Math.round((spxSpot * 0.97) / 5) * 5;
        const putContracts = Math.max(
          1,
          Math.ceil(absDelta / (HEDGE_DELTA * 100 * spxSpot)),
        );
        const putPremium =
          bsPutPrice({
            spot: spxSpot,
            strike: putStrike,
            yearsToExpiry: T,
            vol: ASSUMED_SPX_IV,
          }) *
          100 *
          putContracts;
        ideas.push({
          id: "spx-puts",
          title: "Buy SPX Puts",
          action: `BUY ${putContracts} SPX PUT${putContracts > 1 ? "S" : ""}`,
          instrument: `SPX ${putStrike}P · ~30 DTE · Δ≈-${HEDGE_DELTA}`,
          quantity: putContracts,
          estCost: round2(putPremium),
          deltaRemoved: round2(putContracts * HEDGE_DELTA * 100 * spxSpot),
          rationale: [
            `Each ~30-delta SPX put removes ≈ ${fmtUsd(HEDGE_DELTA * 100 * spxSpot)} of SPX delta`,
            "Defined-risk protection — max loss is the premium paid",
            "Best choice when you want to keep all upside beyond the strike",
          ],
        });

        // Idea 2: put debit spread (cheaper, capped protection)
        const longK = putStrike;
        const shortK = Math.round((spxSpot * 0.93) / 5) * 5;
        const spreadCost =
          (bsPutPrice({
            spot: spxSpot,
            strike: longK,
            yearsToExpiry: T,
            vol: ASSUMED_SPX_IV,
          }) -
            bsPutPrice({
              spot: spxSpot,
              strike: shortK,
              yearsToExpiry: T,
              vol: ASSUMED_SPX_IV * 1.05,
            })) *
          100 *
          putContracts;
        ideas.push({
          id: "spx-put-spread",
          title: "SPX Put Debit Spread",
          action: `BUY ${putContracts} SPX ${longK}/${shortK} PUT SPREAD${putContracts > 1 ? "S" : ""}`,
          instrument: `SPX ${longK}P / ${shortK}P · ~30 DTE`,
          quantity: putContracts,
          estCost: round2(Math.max(0, spreadCost)),
          deltaRemoved: round2(putContracts * 0.2 * 100 * spxSpot),
          rationale: [
            "Roughly 40–60% cheaper than outright puts",
            "Protection caps out below the short strike",
            "Good for cheaper, partial delta reduction",
          ],
        });

        // Idea 3: short SPY shares
        if (spySpot) {
          const shares = Math.max(1, Math.round(absDelta / spySpot));
          ideas.push({
            id: "short-spy",
            title: "Short SPY Shares",
            action: `SELL SHORT ${shares} SPY`,
            instrument: `SPY @ ~${fmtUsd(spySpot)}`,
            quantity: shares,
            estCost: null,
            deltaRemoved: round2(shares * spySpot),
            rationale: [
              "Exact 1:1 delta offset — cleanest hedge",
              "No time decay, but requires margin and borrow",
              "Unlimited upside risk on the short leg",
            ],
          });
        }
      } else {
        // net short → add positive delta
        const callStrike = Math.round((spxSpot * 1.03) / 5) * 5;
        const callContracts = Math.max(
          1,
          Math.ceil(absDelta / (HEDGE_DELTA * 100 * spxSpot)),
        );
        const callPremium =
          bsCallPrice({
            spot: spxSpot,
            strike: callStrike,
            yearsToExpiry: T,
            vol: ASSUMED_SPX_IV,
          }) *
          100 *
          callContracts;
        ideas.push({
          id: "spx-calls",
          title: "Buy SPX Calls",
          action: `BUY ${callContracts} SPX CALL${callContracts > 1 ? "S" : ""}`,
          instrument: `SPX ${callStrike}C · ~30 DTE · Δ≈+${HEDGE_DELTA}`,
          quantity: callContracts,
          estCost: round2(callPremium),
          deltaRemoved: round2(callContracts * HEDGE_DELTA * 100 * spxSpot),
          rationale: [
            "Adds upside delta to a net-short book",
            "Defined-risk — max loss is the premium paid",
          ],
        });
        if (spySpot) {
          const shares = Math.max(1, Math.round(absDelta / spySpot));
          ideas.push({
            id: "buy-spy",
            title: "Buy SPY Shares",
            action: `BUY ${shares} SPY`,
            instrument: `SPY @ ~${fmtUsd(spySpot)}`,
            quantity: shares,
            estCost: round2(shares * spySpot),
            deltaRemoved: round2(shares * spySpot),
            rationale: [
              "Exact 1:1 positive delta — cleanest offset",
              "No expiry, no decay — capital intensive",
            ],
          });
        }
      }
    }

    return {
      hasPositions: true as const,
      spxSpot: spxSpot ? round2(spxSpot) : null,
      spySpot: spySpot ? round2(spySpot) : null,
      totalDelta: totalDeltaDollars,
      totalDeltaDollars,
      spxBetaDelta: spxBetaDeltaDecimal, // Pure decimal representation (no $)
      spyBetaDelta: spyBetaDeltaDecimal, // SPY share equivalent decimal
      portfolioBeta,                     // Portfolio weighted beta decimal (e.g. 1.15)
      portfolioValue: round2(portfolioValue),
      neutral,
      direction: totalDeltaDollars > 0 ? "long" : totalDeltaDollars < 0 ? "short" : "flat",
      dataSource: "yahoo" as const,
      breakdown: breakdown.sort(
        (a, b) => Math.abs(b.spxDeltaDollars) - Math.abs(a.spxDeltaDollars),
      ),
      ideas,
      note: "Betas from Yahoo Finance (vs S&P 500). Option positions use an assumed |Δ| 0.5 when greeks are unavailable. Estimates, not financial advice.",
    };
  }),

  /** Push a suggested trade to the user's configured broker API endpoint. */
  pushTrade: authedQuery
    .input(
      z.object({
        title: z.string(),
        action: z.string(),
        instrument: z.string(),
        quantity: z.number(),
        estCost: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const raw = await getSetting(`broker_api_${ctx.user.id}`);
      const cfg = raw
        ? (JSON.parse(raw) as { endpoint?: string; apiKey?: string })
        : {};
      if (!cfg.endpoint || !cfg.apiKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "No broker API configured — add your endpoint and API key in Settings first.",
        });
      }
      let url: URL;
      try {
        url = new URL(cfg.endpoint);
        if (url.protocol !== "https:" && url.protocol !== "http:") throw null;
      } catch {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "The broker API endpoint in Settings is not a valid URL.",
        });
      }
      let resp: Response;
      try {
        resp = await fetch(url.toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${cfg.apiKey}`,
          },
          body: JSON.stringify({
            source: "wheeldesk",
            type: "trade_suggestion",
            user: ctx.user.email,
            trade: input,
            sentAt: new Date().toISOString(),
          }),
        });
      } catch (e) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Could not reach broker API (${e instanceof Error ? e.message : "network error"})`,
        });
      }
      if (!resp.ok) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `Broker API responded with ${resp.status}.`,
        });
      }
      return { ok: true as const };
    }),
});

function fmtUsd(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

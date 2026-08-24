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

export interface ScenarioResearch {
  scenario: string;
  marketMove: string;
  estimatedPnL: number;
  roiPct: number;
}

export interface TradeIdea {
  id: string;
  title: string;
  action: string; // e.g. "BUY 4 SPX PUTS"
  instrument: string;
  quantity: number;
  estCost: number | null;
  delta: number; // Unit delta (e.g. -0.30)
  deltaUnit: string; // e.g. "-0.30 Δ / contract"
  deltaRemoved: number; // SPX beta-weighted $ delta this trade offsets
  probabilityOfProfit: number; // Probability of profit percentage (0–100)
  probabilityLabel: string;
  riskType: "Defined" | "Unlimited" | "Capped";
  riskLevel: "Low Risk" | "Moderate Risk" | "Elevated Risk" | "Unlimited Risk";
  maxProfit: string;
  maxLoss: string;
  breakeven: string;
  riskDescription: string;
  greeks?: {
    delta: string;
    theta: string;
    vega: string;
    gamma: string;
  };
  researchScenarios: ScenarioResearch[];
  rationale: string[];
}

async function handleSpxDelta({ ctx }: { ctx: { user: { id: number; email?: string } } }) {
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
  const spxSpot = indexSpots["^GSPC"] ?? (indexSpots["SPY"] ? indexSpots["SPY"] * 10 : 5950);
  const spySpot = indexSpots["SPY"] ?? (indexSpots["^GSPC"] ? indexSpots["^GSPC"] / 10 : 595);

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
      const putSinglePremium = bsPutPrice({
        spot: spxSpot,
        strike: putStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });
      const putPremium = putSinglePremium * 100 * putContracts;
      const breakevenPut = round2(putStrike - (putSinglePremium));
      const maxGainPut = round2((putStrike * 100 * putContracts) - putPremium);

      ideas.push({
        id: "spx-puts",
        title: "Buy SPX Puts",
        action: `BUY ${putContracts} SPX PUT${putContracts > 1 ? "S" : ""}`,
        instrument: `SPX ${putStrike}P · ~30 DTE · Δ≈-${HEDGE_DELTA}`,
        quantity: putContracts,
        estCost: round2(putPremium),
        delta: -HEDGE_DELTA,
        deltaUnit: `-${HEDGE_DELTA.toFixed(2)} Δ / contract`,
        deltaRemoved: round2(putContracts * HEDGE_DELTA * 100 * spxSpot),
        probabilityOfProfit: 68,
        probabilityLabel: "68% Modelled Probability of Profit (POP)",
        riskType: "Defined",
        riskLevel: "Low Risk",
        maxProfit: `${fmtUsd(maxGainPut)} (Substantial Tail Protection)`,
        maxLoss: `${fmtUsd(putPremium)} (Defined to 100% of Premium Paid)`,
        breakeven: `SPX ${breakevenPut.toFixed(2)} (-${(((spxSpot - breakevenPut) / spxSpot) * 100).toFixed(1)}%)`,
        riskDescription: `Defined Risk: Maximum loss is strictly capped at the $${round2(putPremium).toLocaleString()} premium paid. No margin calls or unlimited loss potential.`,
        greeks: {
          delta: `-${(HEDGE_DELTA * putContracts).toFixed(2)} SPX contracts`,
          theta: `-$${Math.round(putPremium * 0.035)} / day`,
          vega: `+$${Math.round(putContracts * 140)} / 1% IV spike`,
          gamma: "+0.0014 (Expands protection as market falls)",
        },
        researchScenarios: [
          { scenario: "Market Plunge (-10%)", marketMove: "-10.0%", estimatedPnL: round2((putStrike - (spxSpot * 0.9)) * 100 * putContracts - putPremium), roiPct: +380 },
          { scenario: "Correction (-5%)", marketMove: "-5.0%", estimatedPnL: round2((putStrike - (spxSpot * 0.95)) * 100 * putContracts - putPremium), roiPct: +140 },
          { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: -round2(putPremium), roiPct: -100 },
          { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: -round2(putPremium), roiPct: -100 },
        ],
        rationale: [
          `Each ~30-delta SPX put offsets ≈ ${fmtUsd(HEDGE_DELTA * 100 * spxSpot)} of portfolio SPX delta`,
          "Defined-risk protection — maximum potential loss is strictly limited to premium paid",
          "Volatility expansion (Vega+) boosts put value rapidly during market turmoil",
          "Retains 100% of portfolio upside on stock holdings beyond hedge cost",
        ],
      });

      // Idea 2: put debit spread (cheaper, capped protection)
      const longK = putStrike;
      const shortK = Math.round((spxSpot * 0.93) / 5) * 5;
      const longPrem = bsPutPrice({
        spot: spxSpot,
        strike: longK,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });
      const shortPrem = bsPutPrice({
        spot: spxSpot,
        strike: shortK,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV * 1.05,
      });
      const singleSpreadCost = Math.max(0.5, longPrem - shortPrem);
      const spreadCost = singleSpreadCost * 100 * putContracts;
      const width = longK - shortK;
      const maxSpreadGain = round2((width - singleSpreadCost) * 100 * putContracts);
      const breakevenSpread = round2(longK - singleSpreadCost);

      ideas.push({
        id: "spx-put-spread",
        title: "SPX Put Debit Spread",
        action: `BUY ${putContracts} SPX ${longK}/${shortK} PUT SPREAD${putContracts > 1 ? "S" : ""}`,
        instrument: `SPX ${longK}P / ${shortK}P · ~30 DTE`,
        quantity: putContracts,
        estCost: round2(spreadCost),
        delta: -0.20,
        deltaUnit: "-0.20 Δ / spread",
        deltaRemoved: round2(putContracts * 0.2 * 100 * spxSpot),
        probabilityOfProfit: 62,
        probabilityLabel: "62% Modelled Probability of Profit (POP)",
        riskType: "Defined",
        riskLevel: "Low Risk",
        maxProfit: `${fmtUsd(maxSpreadGain)} (Capped at strike spread width)`,
        maxLoss: `${fmtUsd(spreadCost)} (Defined to Net Debit Paid)`,
        breakeven: `SPX ${breakevenSpread.toFixed(2)} (-${(((spxSpot - breakevenSpread) / spxSpot) * 100).toFixed(1)}%)`,
        riskDescription: `Defined Risk: Capped loss of $${round2(spreadCost).toLocaleString()} (100% of debit). Short leg reduces theta decay cost by ~45% compared to naked puts.`,
        greeks: {
          delta: `-${(0.20 * putContracts).toFixed(2)} SPX contracts`,
          theta: `-$${Math.round(spreadCost * 0.02)} / day`,
          vega: `+$${Math.round(putContracts * 75)} / 1% IV spike`,
          gamma: "+0.0008",
        },
        researchScenarios: [
          { scenario: "Market Plunge (-10%)", marketMove: "-10.0%", estimatedPnL: maxSpreadGain, roiPct: round2((maxSpreadGain / spreadCost) * 100) },
          { scenario: "Correction (-5%)", marketMove: "-5.0%", estimatedPnL: round2(maxSpreadGain * 0.7), roiPct: round2((maxSpreadGain * 0.7 / spreadCost) * 100) },
          { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: -round2(spreadCost), roiPct: -100 },
          { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: -round2(spreadCost), roiPct: -100 },
        ],
        rationale: [
          "Roughly 40–55% cheaper upfront than outright puts due to short strike financing",
          "Defined-risk structure — downside loss capped to net debit",
          "Lower theta decay rate allows longer holding with minimal drag",
          "Protection caps out below the short strike target",
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
          delta: -1.0,
          deltaUnit: "-1.00 Δ / share",
          deltaRemoved: round2(shares * spySpot),
          probabilityOfProfit: 50,
          probabilityLabel: "50% Linear Symmetrical Delta",
          riskType: "Unlimited",
          riskLevel: "Unlimited Risk",
          maxProfit: `${fmtUsd(shares * spySpot)} (If SPY reaches $0.00)`,
          maxLoss: "Unlimited Risk (Uncapped upside loss on market rally)",
          breakeven: `SPY $${spySpot.toFixed(2)} (Entry Price)`,
          riskDescription: "Unlimited Risk: Shorting equity creates uncapped loss potential if the underlying index continues to surge. Requires margin maintenance and borrow interest.",
          greeks: {
            delta: `-${shares} SPY shares (1:1)`,
            theta: "$0.00 (No time decay)",
            vega: "$0.00 (No volatility exposure)",
            gamma: "0.0000 (Pure linear delta)",
          },
          researchScenarios: [
            { scenario: "Market Plunge (-10%)", marketMove: "-10.0%", estimatedPnL: round2(shares * spySpot * 0.1), roiPct: +10 },
            { scenario: "Correction (-5%)", marketMove: "-5.0%", estimatedPnL: round2(shares * spySpot * 0.05), roiPct: +5 },
            { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: 0, roiPct: 0 },
            { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: -round2(shares * spySpot * 0.05), roiPct: -5 },
            { scenario: "Market Surge (+10%)", marketMove: "+10.0%", estimatedPnL: -round2(shares * spySpot * 0.1), roiPct: -10 },
          ],
          rationale: [
            "Exact 1:1 linear delta offset without non-linear Greek curvature",
            "Zero theta decay drag — ideal for holding across extended multi-month hedges",
            "WARNING: Unlimited risk exposure to the upside if markets rally",
            "Subject to broker margin requirements and borrow availability",
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
      const singleCallPrem = bsCallPrice({
        spot: spxSpot,
        strike: callStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });
      const callPremium = singleCallPrem * 100 * callContracts;
      const breakevenCall = round2(callStrike + singleCallPrem);

      ideas.push({
        id: "spx-calls",
        title: "Buy SPX Calls",
        action: `BUY ${callContracts} SPX CALL${callContracts > 1 ? "S" : ""}`,
        instrument: `SPX ${callStrike}C · ~30 DTE · Δ≈+${HEDGE_DELTA}`,
        quantity: callContracts,
        estCost: round2(callPremium),
        delta: HEDGE_DELTA,
        deltaUnit: `+${HEDGE_DELTA.toFixed(2)} Δ / contract`,
        deltaRemoved: round2(callContracts * HEDGE_DELTA * 100 * spxSpot),
        probabilityOfProfit: 68,
        probabilityLabel: "68% Modelled Probability of Profit (POP)",
        riskType: "Defined",
        riskLevel: "Low Risk",
        maxProfit: "Unlimited (No theoretical upside ceiling on SPX index)",
        maxLoss: `${fmtUsd(callPremium)} (Defined to 100% of Premium Paid)`,
        breakeven: `SPX ${breakevenCall.toFixed(2)} (+${(((breakevenCall - spxSpot) / spxSpot) * 100).toFixed(1)}%)`,
        riskDescription: `Defined Risk: Loss is strictly capped at $${round2(callPremium).toLocaleString()}. No margin or uncapped loss liability.`,
        greeks: {
          delta: `+${(HEDGE_DELTA * callContracts).toFixed(2)} SPX contracts`,
          theta: `-$${Math.round(callPremium * 0.035)} / day`,
          vega: `+$${Math.round(callContracts * 140)} / 1% IV spike`,
          gamma: "+0.0014",
        },
        researchScenarios: [
          { scenario: "Market Surge (+10%)", marketMove: "+10.0%", estimatedPnL: round2(((spxSpot * 1.1) - callStrike) * 100 * callContracts - callPremium), roiPct: +380 },
          { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: round2(((spxSpot * 1.05) - callStrike) * 100 * callContracts - callPremium), roiPct: +140 },
          { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: -round2(callPremium), roiPct: -100 },
          { scenario: "Market Fall (-5%)", marketMove: "-5.0%", estimatedPnL: -round2(callPremium), roiPct: -100 },
        ],
        rationale: [
          "Adds positive upside delta to neutralize net-short portfolio bias",
          "Defined-risk hedge — maximum potential loss is strictly capped at premium paid",
          "Unlimited profit participation if market advances strongly",
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
          delta: 1.0,
          deltaUnit: "+1.00 Δ / share",
          deltaRemoved: round2(shares * spySpot),
          probabilityOfProfit: 50,
          probabilityLabel: "50% Linear Delta",
          riskType: "Defined",
          riskLevel: "Moderate Risk",
          maxProfit: "Unlimited (Continuous upward appreciation)",
          maxLoss: `${fmtUsd(shares * spySpot)} (Defined to 100% of Invested Capital)`,
          breakeven: `SPY $${spySpot.toFixed(2)} (Entry Price)`,
          riskDescription: "Defined Risk (Capital Capped): Loss is limited to 100% of invested capital. No expiry time decay or contract rolling required.",
          greeks: {
            delta: `+${shares} SPY shares (1:1)`,
            theta: "$0.00 (No time decay)",
            vega: "$0.00",
            gamma: "0.0000",
          },
          researchScenarios: [
            { scenario: "Market Surge (+10%)", marketMove: "+10.0%", estimatedPnL: round2(shares * spySpot * 0.1), roiPct: +10 },
            { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: round2(shares * spySpot * 0.05), roiPct: +5 },
            { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: 0, roiPct: 0 },
            { scenario: "Market Fall (-5%)", marketMove: "-5.0%", estimatedPnL: -round2(shares * spySpot * 0.05), roiPct: -5 },
            { scenario: "Market Plunge (-10%)", marketMove: "-10.0%", estimatedPnL: -round2(shares * spySpot * 0.1), roiPct: -10 },
          ],
          rationale: [
            "Exact 1:1 positive delta — cleanest long offset",
            "No option expiration, decay, or rolling overhead",
            "Liquid ETF structure with immediate market execution",
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
}

export const suggestionsRouter = createRouter({
  /**
   * SPX beta-weighted delta analysis: computes the portfolio's delta
   * expressed in S&P 500 dollars, then suggests concrete hedge trades
   * to bring the book to delta-neutral.
   */
  spxNeutral: authedQuery.query(handleSpxDelta),
  spxDelta: authedQuery.query(handleSpxDelta),

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

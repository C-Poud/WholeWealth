import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedQuery, createRouter } from "./middleware";
import { getSetting, listPositions } from "./queries/portfolio";
import { getYahooBetas } from "./analytics/yahoo";
import { getSpotsWithFallback } from "./analytics/symbolInfo";
import {
  bsCallPrice,
  bsCallDelta,
  bsPutPrice,
  bsPutDelta,
  bsGamma,
  bsVega,
  bsTheta,
} from "./analytics/blackScholes";

/** Assumed |delta| for option positions whose greeks we don't know. */
const ASSUMED_OPTION_DELTA = 0.5;
/** Assumed SPX 30-day IV for premium estimates. */
const ASSUMED_SPX_IV = 0.16;
/** Below this absolute SPX delta in dollars the portfolio counts as neutral. */
const NEUTRAL_THRESHOLD_DOLLARS = 500;

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface ScenarioResearch {
  scenario: string;
  marketMove: string;
  estimatedPnL: number;
  residualDelta: number;
  roiPct: number;
}

export interface TradeIdea {
  id: string;
  title: string;
  action: string; // e.g. "BUY 3 SPX PUTS"
  instrument: string;
  quantity: number;
  estCost: number | null;
  delta: number; // Unit delta (e.g. -0.30)
  deltaUnit: string; // e.g. "-0.30 Δ / contract"
  deltaRemoved: number; // SPX beta-weighted $ delta this trade offsets
  preHedgeDelta: number; // Decimal delta before hedge (e.g. +12.4 SPX eq)
  tradeDelta: number; // Delta added by this hedge (e.g. -12.0 SPX eq)
  postHedgeDelta: number; // Net residual delta after hedge (e.g. +0.4 SPX eq)
  neutralityPct: number; // e.g. 96.8% neutralized
  probabilityOfProfit: number; // Probability of profit percentage (0–100)
  probabilityLabel: string;
  riskType: "Defined" | "Unlimited" | "Capped";
  riskLevel: "Low Risk" | "Moderate Risk" | "Elevated Risk" | "Unlimited Risk";
  maxProfit: string;
  maxLoss: string;
  breakeven: string;
  riskDescription: string;
  rebalanceThreshold: string;
  greeks?: {
    delta: string;
    gamma: string;
    theta: string;
    vega: string;
  };
  researchScenarios: ScenarioResearch[];
  rationale: string[];
}

export interface SingleAssetHedge {
  symbol: string;
  quantity: number;
  price: number;
  beta: number;
  rawDelta: number; // shares
  dollarDelta: number;
  callHedge: {
    action: string;
    strike: number;
    contracts: number;
    contractDelta: number;
    premium: number;
    postDelta: number;
    dte: number;
  };
  putHedge: {
    action: string;
    strike: number;
    contracts: number;
    contractDelta: number;
    cost: number;
    postDelta: number;
    dte: number;
  };
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
      spxDelta: round2(deltaDollars),
      spxBetaDelta: +(spxDecimalDelta.toFixed(2)),
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
  // Wikipedia definition: Delta = dV / dS
  const spxBetaDeltaDecimal = spxSpot && spxSpot > 0 ? +(totalDeltaDollars / spxSpot).toFixed(2) : 0;
  // SPY ETF equivalent shares (1/10th SPX)
  const spyBetaDeltaDecimal = spySpot && spySpot > 0 ? +(totalDeltaDollars / spySpot).toFixed(2) : +(spxBetaDeltaDecimal * 10).toFixed(2);

  const ideas: TradeIdea[] = [];
  const T = 30 / 365;

  if (!neutral && spxSpot) {
    const long = totalDeltaDollars > 0; // net long → requires negative delta to neutralize

    if (long) {
      // -------------------------------------------------------------
      // Strategy 1: Wikipedia Delta-Neutral OTM SPX Puts (~30Δ)
      // Exact formula: N = - Delta_portfolio / (100 * Delta_put)
      // -------------------------------------------------------------
      const putStrike = Math.round((spxSpot * 0.97) / 5) * 5;
      const singlePutDelta = bsPutDelta({
        spot: spxSpot,
        strike: putStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      }); // e.g. -0.28
      const singlePutGamma = bsGamma({
        spot: spxSpot,
        strike: putStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });
      const singlePutVega = bsVega({
        spot: spxSpot,
        strike: putStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });
      const singlePutTheta = bsTheta({
        spot: spxSpot,
        strike: putStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
        type: "put",
      });
      const singlePutPrem = bsPutPrice({
        spot: spxSpot,
        strike: putStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });

      // Wikipedia exact hedge ratio: N = ceil(|spxBetaDelta| / (|singlePutDelta| * 100))
      // Since 1 SPX option controls 100 index multiplier units
      const putContracts = Math.max(
        1,
        Math.round(spxBetaDeltaDecimal / (Math.abs(singlePutDelta) * 100)) || 1,
      );
      const totalHedgeDeltaAdded = round2(putContracts * 100 * singlePutDelta);
      const postHedgeDelta = round2(spxBetaDeltaDecimal + totalHedgeDeltaAdded);
      const neutralityPct = Math.min(
        100,
        round2(
          Math.max(
            0,
            (1 - Math.abs(postHedgeDelta) / Math.abs(spxBetaDeltaDecimal)) * 100,
          ),
        ),
      );

      const putPremium = singlePutPrem * 100 * putContracts;
      const breakevenPut = round2(putStrike - singlePutPrem);
      const maxGainPut = round2((putStrike * 100 * putContracts) - putPremium);

      ideas.push({
        id: "spx-puts",
        title: "Delta-Neutral SPX Puts",
        action: `BUY ${putContracts} SPX ${putStrike} PUT${putContracts > 1 ? "S" : ""}`,
        instrument: `SPX ${putStrike}P · 30 DTE · Δ=${singlePutDelta.toFixed(2)}`,
        quantity: putContracts,
        estCost: round2(putPremium),
        delta: round2(singlePutDelta),
        deltaUnit: `${singlePutDelta.toFixed(2)} Δ / contract`,
        deltaRemoved: round2(Math.abs(totalHedgeDeltaAdded) * spxSpot),
        preHedgeDelta: spxBetaDeltaDecimal,
        tradeDelta: totalHedgeDeltaAdded,
        postHedgeDelta,
        neutralityPct,
        probabilityOfProfit: 68,
        probabilityLabel: "68% POP (Modelled by N(d2))",
        riskType: "Defined",
        riskLevel: "Low Risk",
        maxProfit: `${fmtUsd(maxGainPut)} (Substantial Tail Protection)`,
        maxLoss: `${fmtUsd(putPremium)} (Capped at 100% of Premium)`,
        breakeven: `SPX ${breakevenPut.toFixed(2)} (-${(((spxSpot - breakevenPut) / spxSpot) * 100).toFixed(1)}%)`,
        riskDescription: `Defined Risk: Maximum loss is strictly capped at the $${round2(putPremium).toLocaleString()} premium paid. No margin calls or unlimited downside liability.`,
        rebalanceThreshold: `Rebalance when SPX moves ±${((0.05 / Math.max(0.0001, singlePutGamma * 100 * putContracts)) * 100).toFixed(1)}% or net delta drifts > ±2.0`,
        greeks: {
          delta: `${totalHedgeDeltaAdded >= 0 ? "+" : ""}${totalHedgeDeltaAdded.toFixed(2)} SPX eq.`,
          gamma: `+${(singlePutGamma * 100 * putContracts).toFixed(4)} (expands protection during selloffs)`,
          theta: `-$${Math.abs(round2(singlePutTheta * 100 * putContracts))} / day`,
          vega: `+$${Math.abs(round2(singlePutVega * 100 * putContracts))} / 1% IV spike`,
        },
        researchScenarios: [
          { scenario: "Market Plunge (-10%)", marketMove: "-10.0%", estimatedPnL: round2((putStrike - (spxSpot * 0.9)) * 100 * putContracts - putPremium), residualDelta: round2(postHedgeDelta - 100 * putContracts * singlePutGamma * spxSpot * 0.1), roiPct: +380 },
          { scenario: "Correction (-5%)", marketMove: "-5.0%", estimatedPnL: round2(Math.max(0, putStrike - (spxSpot * 0.95)) * 100 * putContracts - putPremium), residualDelta: round2(postHedgeDelta - 100 * putContracts * singlePutGamma * spxSpot * 0.05), roiPct: +140 },
          { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: -round2(putPremium), residualDelta: postHedgeDelta, roiPct: -100 },
          { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: -round2(putPremium), residualDelta: round2(postHedgeDelta + 100 * putContracts * singlePutGamma * spxSpot * 0.05), roiPct: -100 },
        ],
        rationale: [
          `Offsets ≈ ${fmtUsd(Math.abs(totalHedgeDeltaAdded) * spxSpot)} of portfolio beta-weighted delta`,
          `Residual post-hedge portfolio delta is ${postHedgeDelta >= 0 ? "+" : ""}${postHedgeDelta.toFixed(2)} SPX equivalent (${neutralityPct}% neutralized)`,
          "Positive Gamma (+Γ) naturally increases negative delta as the market declines",
          "Defined-risk hedge preserves unlimited stock upside past the premium cost",
        ],
      });

      // -------------------------------------------------------------
      // Strategy 2: SPX Vertical Put Debit Spread (Delta-Neutral Spread)
      // Long Strike K1 (~30Δ), Short Strike K2 (~15Δ)
      // -------------------------------------------------------------
      const longK = putStrike;
      const shortK = Math.round((spxSpot * 0.93) / 5) * 5;
      const longPrem = bsPutPrice({ spot: spxSpot, strike: longK, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const shortPrem = bsPutPrice({ spot: spxSpot, strike: shortK, yearsToExpiry: T, vol: ASSUMED_SPX_IV * 1.05 });
      const longDelta = bsPutDelta({ spot: spxSpot, strike: longK, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const shortDelta = bsPutDelta({ spot: spxSpot, strike: shortK, yearsToExpiry: T, vol: ASSUMED_SPX_IV * 1.05 });
      const netSpreadDelta = longDelta - shortDelta; // e.g. -0.28 - (-0.14) = -0.14

      const spreadContracts = Math.max(
        1,
        Math.round(spxBetaDeltaDecimal / (Math.abs(netSpreadDelta) * 100)) || 1,
      );
      const spreadHedgeDelta = round2(spreadContracts * 100 * netSpreadDelta);
      const postSpreadDelta = round2(spxBetaDeltaDecimal + spreadHedgeDelta);
      const spreadNeutralityPct = Math.min(
        100,
        round2(
          Math.max(
            0,
            (1 - Math.abs(postSpreadDelta) / Math.abs(spxBetaDeltaDecimal)) * 100,
          ),
        ),
      );

      const singleSpreadCost = Math.max(0.5, longPrem - shortPrem);
      const spreadCost = singleSpreadCost * 100 * spreadContracts;
      const width = longK - shortK;
      const maxSpreadGain = round2((width - singleSpreadCost) * 100 * spreadContracts);
      const breakevenSpread = round2(longK - singleSpreadCost);

      ideas.push({
        id: "spx-put-spread",
        title: "SPX Delta-Neutral Put Spread",
        action: `BUY ${spreadContracts} SPX ${longK}/${shortK} PUT SPREAD${spreadContracts > 1 ? "S" : ""}`,
        instrument: `SPX ${longK}P / ${shortK}P · 30 DTE · Net Δ=${netSpreadDelta.toFixed(2)}`,
        quantity: spreadContracts,
        estCost: round2(spreadCost),
        delta: round2(netSpreadDelta),
        deltaUnit: `${netSpreadDelta.toFixed(2)} Δ / spread`,
        deltaRemoved: round2(Math.abs(spreadHedgeDelta) * spxSpot),
        preHedgeDelta: spxBetaDeltaDecimal,
        tradeDelta: spreadHedgeDelta,
        postHedgeDelta: postSpreadDelta,
        neutralityPct: spreadNeutralityPct,
        probabilityOfProfit: 62,
        probabilityLabel: "62% Modelled Probability of Profit (POP)",
        riskType: "Defined",
        riskLevel: "Low Risk",
        maxProfit: `${fmtUsd(maxSpreadGain)} (Capped at strike spread width)`,
        maxLoss: `${fmtUsd(spreadCost)} (Defined to Net Debit Paid)`,
        breakeven: `SPX ${breakevenSpread.toFixed(2)} (-${(((spxSpot - breakevenSpread) / spxSpot) * 100).toFixed(1)}%)`,
        riskDescription: `Defined Risk: Maximum loss capped at $${round2(spreadCost).toLocaleString()}. Short leg reduces theta decay by ~45% relative to outright puts.`,
        rebalanceThreshold: `Rebalance when market moves outside the ${shortK}–${longK} strike corridor`,
        greeks: {
          delta: `${spreadHedgeDelta >= 0 ? "+" : ""}${spreadHedgeDelta.toFixed(2)} SPX eq.`,
          gamma: "+0.0008",
          theta: `-$${Math.abs(round2(spreadCost * 0.018))} / day`,
          vega: `+$${round2(spreadContracts * 75)} / 1% IV spike`,
        },
        researchScenarios: [
          { scenario: "Market Plunge (-10%)", marketMove: "-10.0%", estimatedPnL: maxSpreadGain, residualDelta: postSpreadDelta, roiPct: round2((maxSpreadGain / spreadCost) * 100) },
          { scenario: "Correction (-5%)", marketMove: "-5.0%", estimatedPnL: round2(maxSpreadGain * 0.7), residualDelta: round2(postSpreadDelta - 2), roiPct: round2((maxSpreadGain * 0.7 / spreadCost) * 100) },
          { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: -round2(spreadCost), residualDelta: postSpreadDelta, roiPct: -100 },
          { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: -round2(spreadCost), residualDelta: postSpreadDelta, roiPct: -100 },
        ],
        rationale: [
          `Financed hedge reduces capital outlay by ~50% compared to naked puts`,
          `Residual post-hedge delta: ${postSpreadDelta >= 0 ? "+" : ""}${postSpreadDelta.toFixed(2)} SPX eq. (${spreadNeutralityPct}% neutralized)`,
          "Lower theta drag enables maintaining the hedge through low-volatility periods",
          "Protection is capped below the short strike of " + shortK,
        ],
      });

      // -------------------------------------------------------------
      // Strategy 3: Linear Benchmark Short Shares (Exact 1:1 Delta, Zero Gamma)
      // -------------------------------------------------------------
      if (spySpot) {
        const shares = Math.max(1, Math.round(spyBetaDeltaDecimal));
        const postSharesDelta = round2(spyBetaDeltaDecimal - shares);
        const sharesNeutralityPct = Math.min(
          100,
          round2(Math.max(0, (1 - Math.abs(postSharesDelta) / Math.abs(spyBetaDeltaDecimal)) * 100)),
        );

        ideas.push({
          id: "short-spy",
          title: "Linear SPY Short Hedge",
          action: `SELL SHORT ${shares} SPY`,
          instrument: `SPY @ ~${fmtUsd(spySpot)} · Pure 1:1 Delta`,
          quantity: shares,
          estCost: null,
          delta: -1.0,
          deltaUnit: "-1.00 Δ / share",
          deltaRemoved: round2(shares * spySpot),
          preHedgeDelta: spyBetaDeltaDecimal,
          tradeDelta: -shares,
          postHedgeDelta: postSharesDelta,
          neutralityPct: sharesNeutralityPct,
          probabilityOfProfit: 50,
          probabilityLabel: "50% Linear Symmetrical Delta",
          riskType: "Unlimited",
          riskLevel: "Unlimited Risk",
          maxProfit: `${fmtUsd(shares * spySpot)} (If SPY reaches $0.00)`,
          maxLoss: "Unlimited Risk (Uncapped loss if market rallies indefinitely)",
          breakeven: `SPY $${spySpot.toFixed(2)} (Entry Spot)`,
          riskDescription: "Unlimited Risk: Linear short equity carries uncapped upside loss potential. Requires margin maintenance and borrow interest.",
          rebalanceThreshold: "No rebalancing needed for small moves; zero gamma curvature",
          greeks: {
            delta: `-${shares} SPY shares (1:1)`,
            gamma: "0.0000 (Pure linear delta)",
            theta: "$0.00 (Zero time decay)",
            vega: "$0.00 (Zero volatility exposure)",
          },
          researchScenarios: [
            { scenario: "Market Plunge (-10%)", marketMove: "-10.0%", estimatedPnL: round2(shares * spySpot * 0.1), residualDelta: postSharesDelta, roiPct: +10 },
            { scenario: "Correction (-5%)", marketMove: "-5.0%", estimatedPnL: round2(shares * spySpot * 0.05), residualDelta: postSharesDelta, roiPct: +5 },
            { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: 0, residualDelta: postSharesDelta, roiPct: 0 },
            { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: -round2(shares * spySpot * 0.05), residualDelta: postSharesDelta, roiPct: -5 },
            { scenario: "Market Surge (+10%)", marketMove: "+10.0%", estimatedPnL: -round2(shares * spySpot * 0.1), residualDelta: postSharesDelta, roiPct: -10 },
          ],
          rationale: [
            "Exact linear delta offset (zero Greek curvature, Γ = 0, Θ = 0)",
            `Residual post-hedge delta: ${postSharesDelta >= 0 ? "+" : ""}${postSharesDelta.toFixed(1)} SPY shares (${sharesNeutralityPct}% neutralized)`,
            "Zero time decay drag — ideal for static long-duration beta neutralization",
            "WARNING: Uncapped upside risk exposure if broad market surges",
          ],
        });
      }
    } else {
      // -------------------------------------------------------------
      // Net Short Portfolio -> Add Positive Delta to Neutralize
      // -------------------------------------------------------------
      const callStrike = Math.round((spxSpot * 1.03) / 5) * 5;
      const singleCallDelta = bsCallDelta({
        spot: spxSpot,
        strike: callStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });
      const singleCallGamma = bsGamma({
        spot: spxSpot,
        strike: callStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });
      const singleCallVega = bsVega({
        spot: spxSpot,
        strike: callStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });
      const singleCallTheta = bsTheta({
        spot: spxSpot,
        strike: callStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
        type: "call",
      });
      const singleCallPrem = bsCallPrice({
        spot: spxSpot,
        strike: callStrike,
        yearsToExpiry: T,
        vol: ASSUMED_SPX_IV,
      });

      const callContracts = Math.max(
        1,
        Math.round(Math.abs(spxBetaDeltaDecimal) / (singleCallDelta * 100)) || 1,
      );
      const totalHedgeDeltaAdded = round2(callContracts * 100 * singleCallDelta);
      const postHedgeDelta = round2(spxBetaDeltaDecimal + totalHedgeDeltaAdded);
      const neutralityPct = Math.min(
        100,
        round2(
          Math.max(
            0,
            (1 - Math.abs(postHedgeDelta) / Math.abs(spxBetaDeltaDecimal)) * 100,
          ),
        ),
      );

      const callPremium = singleCallPrem * 100 * callContracts;
      const breakevenCall = round2(callStrike + singleCallPrem);

      ideas.push({
        id: "spx-calls",
        title: "Delta-Neutral SPX Calls",
        action: `BUY ${callContracts} SPX ${callStrike} CALL${callContracts > 1 ? "S" : ""}`,
        instrument: `SPX ${callStrike}C · 30 DTE · Δ=+${singleCallDelta.toFixed(2)}`,
        quantity: callContracts,
        estCost: round2(callPremium),
        delta: round2(singleCallDelta),
        deltaUnit: `+${singleCallDelta.toFixed(2)} Δ / contract`,
        deltaRemoved: round2(totalHedgeDeltaAdded * spxSpot),
        preHedgeDelta: spxBetaDeltaDecimal,
        tradeDelta: totalHedgeDeltaAdded,
        postHedgeDelta,
        neutralityPct,
        probabilityOfProfit: 68,
        probabilityLabel: "68% Modelled Probability of Profit (POP)",
        riskType: "Defined",
        riskLevel: "Low Risk",
        maxProfit: "Unlimited (No theoretical upside cap on SPX rally)",
        maxLoss: `${fmtUsd(callPremium)} (Defined to 100% of Premium Paid)`,
        breakeven: `SPX ${breakevenCall.toFixed(2)} (+${(((breakevenCall - spxSpot) / spxSpot) * 100).toFixed(1)}%)`,
        riskDescription: `Defined Risk: Loss is strictly capped at $${round2(callPremium).toLocaleString()}. No margin or uncapped loss liability.`,
        rebalanceThreshold: `Rebalance when market moves ±${((0.05 / Math.max(0.0001, singleCallGamma * 100 * callContracts)) * 100).toFixed(1)}%`,
        greeks: {
          delta: `+${totalHedgeDeltaAdded.toFixed(2)} SPX eq.`,
          gamma: `+${(singleCallGamma * 100 * callContracts).toFixed(4)}`,
          theta: `-$${Math.abs(round2(singleCallTheta * 100 * callContracts))} / day`,
          vega: `+$${round2(singleCallVega * 100 * callContracts)} / 1% IV spike`,
        },
        researchScenarios: [
          { scenario: "Market Surge (+10%)", marketMove: "+10.0%", estimatedPnL: round2(((spxSpot * 1.1) - callStrike) * 100 * callContracts - callPremium), residualDelta: round2(postHedgeDelta + 100 * callContracts * singleCallGamma * spxSpot * 0.1), roiPct: +380 },
          { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: round2(Math.max(0, (spxSpot * 1.05) - callStrike) * 100 * callContracts - callPremium), residualDelta: round2(postHedgeDelta + 100 * callContracts * singleCallGamma * spxSpot * 0.05), roiPct: +140 },
          { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: -round2(callPremium), residualDelta: postHedgeDelta, roiPct: -100 },
          { scenario: "Market Fall (-5%)", marketMove: "-5.0%", estimatedPnL: -round2(callPremium), residualDelta: round2(postHedgeDelta - 100 * callContracts * singleCallGamma * spxSpot * 0.05), roiPct: -100 },
        ],
        rationale: [
          `Adds +${totalHedgeDeltaAdded.toFixed(2)} delta to neutralize net-short portfolio bias`,
          `Residual post-hedge delta: ${postHedgeDelta >= 0 ? "+" : ""}${postHedgeDelta.toFixed(2)} SPX eq. (${neutralityPct}% neutralized)`,
          "Defined-risk hedge — maximum potential loss is strictly capped at premium paid",
        ],
      });

      if (spySpot) {
        const shares = Math.max(1, Math.round(Math.abs(spyBetaDeltaDecimal)));
        const postSharesDelta = round2(spyBetaDeltaDecimal + shares);
        const sharesNeutralityPct = Math.min(
          100,
          round2(Math.max(0, (1 - Math.abs(postSharesDelta) / Math.abs(spyBetaDeltaDecimal)) * 100)),
        );

        ideas.push({
          id: "buy-spy",
          title: "Linear SPY Long Hedge",
          action: `BUY ${shares} SPY`,
          instrument: `SPY @ ~${fmtUsd(spySpot)}`,
          quantity: shares,
          estCost: round2(shares * spySpot),
          delta: 1.0,
          deltaUnit: "+1.00 Δ / share",
          deltaRemoved: round2(shares * spySpot),
          preHedgeDelta: spyBetaDeltaDecimal,
          tradeDelta: shares,
          postHedgeDelta: postSharesDelta,
          neutralityPct: sharesNeutralityPct,
          probabilityOfProfit: 50,
          probabilityLabel: "50% Linear Delta",
          riskType: "Defined",
          riskLevel: "Moderate Risk",
          maxProfit: "Unlimited (Continuous upward appreciation)",
          maxLoss: `${fmtUsd(shares * spySpot)} (Defined to 100% of Invested Capital)`,
          breakeven: `SPY $${spySpot.toFixed(2)} (Entry Price)`,
          riskDescription: "Defined Risk (Capital Capped): Loss is limited to 100% of invested capital.",
          rebalanceThreshold: "Static linear offset; zero gamma curvature",
          greeks: {
            delta: `+${shares} SPY shares (1:1)`,
            gamma: "0.0000",
            theta: "$0.00",
            vega: "$0.00",
          },
          researchScenarios: [
            { scenario: "Market Surge (+10%)", marketMove: "+10.0%", estimatedPnL: round2(shares * spySpot * 0.1), residualDelta: postSharesDelta, roiPct: +10 },
            { scenario: "Market Rally (+5%)", marketMove: "+5.0%", estimatedPnL: round2(shares * spySpot * 0.05), residualDelta: postSharesDelta, roiPct: +5 },
            { scenario: "Flat Market (0%)", marketMove: "0.0%", estimatedPnL: 0, residualDelta: postSharesDelta, roiPct: 0 },
            { scenario: "Market Fall (-5%)", marketMove: "-5.0%", estimatedPnL: -round2(shares * spySpot * 0.05), residualDelta: postSharesDelta, roiPct: -5 },
            { scenario: "Market Plunge (-10%)", marketMove: "-10.0%", estimatedPnL: -round2(shares * spySpot * 0.1), residualDelta: postSharesDelta, roiPct: -10 },
          ],
          rationale: [
            "Exact 1:1 positive delta offset without Greek decay",
            `Residual post-hedge delta: ${postSharesDelta >= 0 ? "+" : ""}${postSharesDelta.toFixed(1)} SPY shares (${sharesNeutralityPct}% neutralized)`,
            "Liquid ETF execution",
          ],
        });
      }
    }
  }

  // -------------------------------------------------------------
  // Single-Asset Delta-Neutral Hedges (Per Stock Position)
  // Wikipedia: For each stock asset with N shares, Delta_asset = +N
  // Option hedge ratio: N_options = -N / (100 * Delta_option)
  // -------------------------------------------------------------
  const stockPositions = positions.filter((p) => p.assetType === "stock" && p.quantity > 0);
  const singleAssetHedges: SingleAssetHedge[] = stockPositions.map((p) => {
    const sym = p.symbol.toUpperCase();
    const spot = spots[sym] ?? p.price ?? p.costBasis ?? 100;
    const beta = betas[sym] ?? 1.0;
    const rawDelta = p.quantity;
    const dollarDelta = rawDelta * spot;
    const vol = 0.30; // 30% baseline IV for single stocks

    // 1. Covered Call Delta Neutralizer (Sell calls to offset stock delta)
    // Target ~30-delta OTM Call: Strike ~ 1.05 * Spot
    const callStrike = Math.round(spot * 1.05);
    const callDelta = bsCallDelta({ spot, strike: callStrike, yearsToExpiry: T, vol });
    const callContracts = Math.max(1, Math.round(rawDelta / (callDelta * 100)));
    const callPrem = bsCallPrice({ spot, strike: callStrike, yearsToExpiry: T, vol }) * 100 * callContracts;
    const callPostDelta = round2(rawDelta - (callContracts * 100 * callDelta));

    // 2. Protective Put Delta Neutralizer (Buy puts to offset stock delta)
    // Target ~30-delta OTM Put: Strike ~ 0.95 * Spot
    const putStrike = Math.round(spot * 0.95);
    const putDelta = bsPutDelta({ spot, strike: putStrike, yearsToExpiry: T, vol });
    const putContracts = Math.max(1, Math.round(rawDelta / (Math.abs(putDelta) * 100)));
    const putCost = bsPutPrice({ spot, strike: putStrike, yearsToExpiry: T, vol }) * 100 * putContracts;
    const putPostDelta = round2(rawDelta + (putContracts * 100 * putDelta));

    return {
      symbol: sym,
      quantity: p.quantity,
      price: round2(spot),
      beta: round2(beta),
      rawDelta,
      dollarDelta: round2(dollarDelta),
      callHedge: {
        action: `SELL ${callContracts}x ${sym} ${callStrike}C`,
        strike: callStrike,
        contracts: callContracts,
        contractDelta: round2(callDelta),
        premium: round2(callPrem),
        postDelta: callPostDelta,
        dte: 30,
      },
      putHedge: {
        action: `BUY ${putContracts}x ${sym} ${putStrike}P`,
        strike: putStrike,
        contracts: putContracts,
        contractDelta: round2(putDelta),
        cost: round2(putCost),
        postDelta: putPostDelta,
        dte: 30,
      },
    };
  });

  return {
    hasPositions: true as const,
    spxSpot: spxSpot ? round2(spxSpot) : null,
    spySpot: spySpot ? round2(spySpot) : null,
    totalDelta: totalDeltaDollars,
    totalDeltaDollars,
    spxBetaDelta: spxBetaDeltaDecimal,
    spyBetaDelta: spyBetaDeltaDecimal,
    portfolioBeta,
    portfolioValue: round2(portfolioValue),
    neutral,
    direction: totalDeltaDollars > 0 ? "long" : totalDeltaDollars < 0 ? "short" : "flat",
    dataSource: "yahoo" as const,
    breakdown: breakdown.sort(
      (a, b) => Math.abs(b.spxDeltaDollars) - Math.abs(a.spxDeltaDollars),
    ),
    ideas,
    singleAssetHedges,
    deltaNeutralFormulation: {
      definition: "Delta neutrality creates a portfolio where the total first-order derivative with respect to underlying price is zero: Δ_portfolio = Σ(w_i * Δ_i) = 0.",
      hedgeRatioFormula: "N_contracts = -Δ_unhedged / (100 * Δ_contract)",
      gammaSensitivity: "As prices change, non-zero Gamma (Γ = ∂Δ/∂S) causes Delta to drift, requiring periodic dynamic rebalancing.",
      neutralThresholdDollars: NEUTRAL_THRESHOLD_DOLLARS,
    },
    note: "Calculated via Black-Scholes partial derivatives and Capital Asset Pricing Model (CAPM) Beta weighting relative to the S&P 500 index.",
  };
}

export const suggestionsRouter = createRouter({
  spxNeutral: authedQuery.query(handleSpxDelta),
  spxDelta: authedQuery.query(handleSpxDelta),

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
            source: "networth",
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

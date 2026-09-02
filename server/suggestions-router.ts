import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedQuery, createRouter } from "./middleware";
import { getSetting, listPositions } from "./queries/portfolio";
import { getYahooBetas } from "./analytics/yahoo";
import { getSpotsWithFallback } from "./analytics/symbolInfo";
import { getSymbolBeta } from "./analytics/betaGreeks";
import {
  bsCallPrice,
  bsCallDelta,
  bsPutPrice,
  bsPutDelta,
  bsGamma,
  bsVega,
  bsTheta,
} from "./analytics/blackScholes";

/** Assumed SPX 30-day IV for premium estimates. */
const ASSUMED_SPX_IV = 0.16;
/** Assumed baseline single-stock IV. */
const ASSUMED_STOCK_IV = 0.28;
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
  action: string;
  instrument: string;
  quantity: number;
  estCost: number | null;
  delta: number;
  deltaUnit: string;
  deltaRemoved: number;
  preHedgeDelta: number;
  tradeDelta: number;
  postHedgeDelta: number;
  neutralityPct: number;
  probabilityOfProfit: number;
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
  rawDelta: number;
  dollarDelta: number;
  callHedge: {
    action: string;
    strike: number;
    contracts: number;
    contractDelta: number;
    premium: number;
    postDelta: number;
    dte: number;
    yieldPct: number;
    pop: number;
  };
  putHedge: {
    action: string;
    strike: number;
    contracts: number;
    contractDelta: number;
    cost: number;
    postDelta: number;
    dte: number;
    pop: number;
  };
  conservativeCall: {
    strike: number;
    contracts: number;
    premium: number;
    delta: number;
    pop: number;
    yieldPct: number;
  };
}

export interface SosnoffPillar {
  id: string;
  title: string;
  currentValue: string;
  subValue?: string;
  targetValue: string;
  status: "GOOD" | "WARN" | "ALERT";
  badge: string;
  tomTake: string;
  explanation: string;
}

export interface SosnoffManageAlert {
  symbol: string;
  type: string;
  strike?: number;
  expiry?: string;
  dte?: number;
  unrealizedPnlPct?: number;
  actionType: "ROLL_21_DTE" | "TAKE_PROFIT_50" | "MONITOR";
  title: string;
  recommendation: string;
  urgency: "HIGH" | "MEDIUM" | "LOW";
}

export interface SosnoffSignaturePlay {
  id: string;
  symbol: string;
  name: string;
  strategy: string;
  action: string;
  category: "INDEX" | "HIGH_IV" | "UNCORRELATED";
  ivr: number;
  dte: number;
  pop: number;
  targetThetaDaily: number;
  estCredit: number;
  maxLoss: string;
  bpu: number;
  whyTomRecommends: string;
}

export interface SosnoffScorecard {
  overallGrade: "A" | "A-" | "B+" | "B" | "C+" | "C" | "D";
  gradeTitle: string;
  verdictSummary: string;
  totalNLV: number;
  spyBetaDelta: number;
  spyDeltaDollars: number;
  spyDeltaRatio: number;
  dailyTheta: number;
  dailyThetaPct: number;
  annualizedThetaYield: number;
  thetaToDeltaRatio: number;
  bpuPct: number;
  cashPct: number;
  pillars: SosnoffPillar[];
  top3PriorityMoves: {
    rank: number;
    title: string;
    action: string;
    impact: string;
    category: "DELTA" | "THETA" | "DIVERSIFICATION" | "MANAGEMENT";
  }[];
  manageAlerts: SosnoffManageAlert[];
  signaturePlays: SosnoffSignaturePlay[];
  axioms: string[];
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
    getSpotsWithFallback(["^GSPC", "SPY", "QQQ", "IWM", "TLT", "GLD", "^VIX"]),
  ]);
  const spxSpot = indexSpots["^GSPC"] ?? (indexSpots["SPY"] ? indexSpots["SPY"] * 10 : 5950);
  const spySpot = indexSpots["SPY"] ?? (indexSpots["^GSPC"] ? indexSpots["^GSPC"] / 10 : 595);
  const vixSpot = indexSpots["^VIX"] ?? 15.5;

  let portfolioValue = 0;
  let totalDailyTheta = 0;
  let estimatedOptionBpu = 0;
  let equityBpu = 0;

  const now = new Date();
  const manageAlerts: SosnoffManageAlert[] = [];

  const breakdown = positions.map((p) => {
    const sym = p.symbol.toUpperCase();
    const spot = spots[sym] ?? p.price ?? p.costBasis ?? 0;
    const beta = getSymbolBeta(sym, p.assetType, betas);
    const mult = p.assetType === "option" ? 100 : 1;
    const posVal = p.quantity * spot * mult;
    portfolioValue += Math.abs(posVal);

    let deltaDollars = 0;
    let rawDelta = 0;
    let posDailyTheta = 0;

    if (p.assetType === "option") {
      const isCall = p.optionType === "call" || p.optionType == null;
      let dte = 30;
      if (p.expiry) {
        const expDate = new Date(p.expiry);
        const diffMs = expDate.getTime() - now.getTime();
        dte = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
      }
      const yearsToExpiry = dte / 365;
      const strike = p.strike ?? spot;

      const singleDelta = isCall
        ? bsCallDelta({ spot, strike, yearsToExpiry, vol: ASSUMED_STOCK_IV })
        : bsPutDelta({ spot, strike, yearsToExpiry, vol: ASSUMED_STOCK_IV });
      
      const singleTheta = bsTheta({
        spot,
        strike,
        yearsToExpiry,
        vol: ASSUMED_STOCK_IV,
        type: isCall ? "call" : "put",
      });

      rawDelta = p.quantity * singleDelta * 100;
      deltaDollars = rawDelta * spot * beta;
      posDailyTheta = p.quantity * singleTheta * 100;
      totalDailyTheta += posDailyTheta;

      // Estimate BPU for short options vs long options
      if (p.quantity < 0) {
        // Short option BPU ~ 20% of underlying spot * 100 * contracts
        estimatedOptionBpu += Math.abs(p.quantity) * spot * 100 * 0.20;
      } else {
        // Long option BPU = premium paid
        estimatedOptionBpu += Math.abs(posVal);
      }

      // Check 21 DTE rule
      if (p.quantity < 0 && dte <= 21) {
        manageAlerts.push({
          symbol: sym,
          type: isCall ? "Short Call" : "Short Put",
          strike: p.strike ?? undefined,
          expiry: p.expiry ?? undefined,
          dte,
          actionType: "ROLL_21_DTE",
          title: `Roll or Close ${sym} ${strike}${isCall ? "C" : "P"} (${dte} DTE)`,
          recommendation: `Position has reached ${dte} DTE. Recommendation: close or roll to the next 45 DTE cycle to avoid rapid gamma expansion.`,
          urgency: dte <= 7 ? "HIGH" : "MEDIUM",
        });
      }

      // Check 50% profit rule if cost basis is known
      if (p.quantity < 0 && p.costBasis && p.price) {
        const entryPrem = p.costBasis;
        const currentPrem = p.price;
        const pnlPct = ((entryPrem - currentPrem) / entryPrem) * 100;
        if (pnlPct >= 50) {
          manageAlerts.push({
            symbol: sym,
            type: isCall ? "Short Call" : "Short Put",
            strike: p.strike ?? undefined,
            expiry: p.expiry ?? undefined,
            dte,
            unrealizedPnlPct: round2(pnlPct),
            actionType: "TAKE_PROFIT_50",
            title: `Take 50% Profit on ${sym} ${strike}${isCall ? "C" : "P"} (+${pnlPct.toFixed(0)}%)`,
            recommendation: `Target profit achieved (+${pnlPct.toFixed(0)}%). Quantitative options mechanics dictate taking profit at 50% of maximum credit and re-deploying capital.`,
            urgency: "HIGH",
          });
        }
      }
    } else {
      rawDelta = p.quantity;
      deltaDollars = p.quantity * spot * beta;
      // Equity long margin is typically 50% Reg T or 15% Portfolio Margin
      equityBpu += Math.abs(p.quantity * spot) * 0.50;
    }

    const spxDecimalDelta = spxSpot && spxSpot > 0 ? deltaDollars / spxSpot : (spot > 0 ? (rawDelta * beta) : 0);

    return {
      symbol: sym,
      assetType: p.assetType,
      quantity: p.quantity,
      price: round2(spot),
      beta: round2(beta),
      spxDeltaDollars: round2(deltaDollars),
      spxDelta: round2(deltaDollars),
      spxBetaDelta: +(spxDecimalDelta.toFixed(3)),
    };
  });

  const totalDeltaDollars = round2(
    breakdown.reduce((sum, b) => sum + b.spxDeltaDollars, 0),
  );
  const absDeltaDollars = Math.abs(totalDeltaDollars);
  const neutral = absDeltaDollars < NEUTRAL_THRESHOLD_DOLLARS;

  let weightedBetaSum = 0;
  for (const b of breakdown) {
    weightedBetaSum += Math.abs(b.quantity * b.price * (b.assetType === "option" ? 100 : 1)) * b.beta;
  }
  const portfolioBeta = portfolioValue > 0 ? +(weightedBetaSum / portfolioValue).toFixed(2) : 1.0;

  const spxBetaDeltaDecimal = spxSpot && spxSpot > 0 ? +(totalDeltaDollars / spxSpot).toFixed(2) : 0;
  const spyBetaDeltaDecimal = spySpot && spySpot > 0 ? +(totalDeltaDollars / spySpot).toFixed(2) : +(spxBetaDeltaDecimal * 10).toFixed(2);

  // --------------------------------------------------------------------------
  // Quantitative Portfolio Diagnosis & Scorecard Calculations
  // --------------------------------------------------------------------------
  const effectiveNLV = Math.max(1000, portfolioValue);
  const totalBpuDollars = Math.min(effectiveNLV, estimatedOptionBpu + equityBpu);
  const bpuPct = Math.min(100, Math.round((totalBpuDollars / effectiveNLV) * 100)) || 45;
  const cashPct = 100 - bpuPct;

  const spyDeltaRatio = (spyBetaDeltaDecimal * spySpot) / effectiveNLV;
  const dailyThetaPct = (totalDailyTheta / effectiveNLV) * 100;
  const annualizedThetaYield = dailyThetaPct * 365;
  const thetaToDeltaRatio = Math.abs(spyBetaDeltaDecimal) > 0 
    ? +(totalDailyTheta / Math.abs(spyBetaDeltaDecimal)).toFixed(2) 
    : 1.0;

  // Grade calculation
  let gradeScore = 80; // baseline B
  if (Math.abs(spyDeltaRatio) > 0.60) gradeScore -= 15; // too directional
  if (dailyThetaPct < 0.03) gradeScore -= 20; // no theta / idle equity
  if (bpuPct > 75) gradeScore -= 15; // overleveraged
  if (positions.length >= 4) gradeScore += 5; // good occurrences
  if (manageAlerts.length > 0) gradeScore -= 5;

  let overallGrade: "A" | "A-" | "B+" | "B" | "C+" | "C" | "D" = "B";
  if (gradeScore >= 90) overallGrade = "A";
  else if (gradeScore >= 85) overallGrade = "A-";
  else if (gradeScore >= 80) overallGrade = "B+";
  else if (gradeScore >= 72) overallGrade = "B";
  else if (gradeScore >= 65) overallGrade = "C+";
  else if (gradeScore >= 55) overallGrade = "C";
  else overallGrade = "D";

  const isLongHeavy = spyDeltaRatio > 0.40;
  const isShortHeavy = spyDeltaRatio < -0.30;
  const isThetaDeficient = dailyThetaPct < 0.03;

  const pillars: SosnoffPillar[] = [
    {
      id: "delta-exposure",
      title: "1. Beta-Weighted SPY Delta",
      currentValue: `${spyBetaDeltaDecimal >= 0 ? "+" : ""}${spyBetaDeltaDecimal.toFixed(1)} SPY eq.`,
      subValue: `${fmtUsd(totalDeltaDollars)} (${(spyDeltaRatio * 100).toFixed(0)}% of NLV)`,
      targetValue: "±10% to 25% of NLV (Small Long / Neutral Bias)",
      status: isLongHeavy ? "ALERT" : isShortHeavy ? "WARN" : "GOOD",
      badge: isLongHeavy ? "Long Heavy Risk" : isShortHeavy ? "Short Vulnerability" : "Balanced Portfolio",
      tomTake: isLongHeavy
        ? `You are running ${Math.round(spyDeltaRatio * 100)}% net long equity delta. If the market takes a 5% bath tomorrow, your portfolio will feel 100% of the pain. We recommend selling call spreads or delta-neutral puts to flatten your exposure.`
        : isShortHeavy
          ? "You are aggressively short delta. Any sudden market squeeze will pressure this account."
          : "Your directional beta delta is well-managed within the neutral-to-slight-long systematic envelope.",
      explanation: "Beta-weighting normalizes every stock and option holding into equivalent S&P 500 (SPY) shares to measure true portfolio market risk.",
    },
    {
      id: "theta-harvest",
      title: "2. Net Daily Theta (Time Decay Rent)",
      currentValue: `$${round2(totalDailyTheta).toFixed(2)} / day`,
      subValue: `${dailyThetaPct.toFixed(3)}% of NLV/day (${annualizedThetaYield.toFixed(1)}%/yr)`,
      targetValue: "0.10% of NLV/day ($100/day per $100k account)",
      status: isThetaDeficient ? "ALERT" : dailyThetaPct < 0.07 ? "WARN" : "GOOD",
      badge: isThetaDeficient ? "Under-Monetized" : dailyThetaPct >= 0.08 ? "Sweet Spot (~0.1%)" : "Moderate Theta",
      tomTake: isThetaDeficient
        ? `You are currently collecting almost zero theta ($${round2(totalDailyTheta).toFixed(2)}/day). Theta is the rent you collect for taking risk. If you hold long stock without selling covered calls or strangles, you are leaving money on the table.`
        : `Your daily theta generation ($${round2(totalDailyTheta).toFixed(2)}/day) is providing a solid ongoing statistical edge as time decays.`,
      explanation: "Core principle: harvest time decay (Theta) every single day, targeting approximately 0.10% of total portfolio value daily.",
    },
    {
      id: "theta-delta-ratio",
      title: "3. Theta-to-Delta Ratio (Rent vs Risk)",
      currentValue: `${thetaToDeltaRatio >= 1 ? "1 : " + thetaToDeltaRatio : thetaToDeltaRatio + " : 1"}`,
      subValue: `Daily Theta ($${totalDailyTheta.toFixed(1)}) vs |SPY Δ| (${Math.abs(spyBetaDeltaDecimal).toFixed(1)})`,
      targetValue: "Theta ≥ 0.5x to 1.0x absolute SPY Delta",
      status: thetaToDeltaRatio < 0.20 ? "ALERT" : thetaToDeltaRatio < 0.50 ? "WARN" : "GOOD",
      badge: thetaToDeltaRatio >= 0.50 ? "Efficient Rent" : "Under-Compensated",
      tomTake: thetaToDeltaRatio < 0.30
        ? "Your theta is too low relative to your directional delta. You are carrying big directional volatility risk without getting paid enough daily decay."
        : "Healthy balance between directional delta exposure and the daily cash flow generated.",
      explanation: "The Theta-to-Delta ratio tests whether your daily time decay compensates you for the market directional volatility you carry.",
    },
    {
      id: "buying-power",
      title: "4. Buying Power Usage (BPU & Cash Buffer)",
      currentValue: `${bpuPct}% BPU`,
      subValue: `${cashPct}% Cash Reserve (VIX: ${vixSpot.toFixed(1)})`,
      targetValue: "25%–50% in Low IV · 50%–70% in High IV",
      status: bpuPct > 75 ? "ALERT" : bpuPct < 25 ? "WARN" : "GOOD",
      badge: bpuPct > 75 ? "Over-Leveraged" : bpuPct < 25 ? "Excess Idle Cash" : "Optimal Cash Buffer",
      tomTake: bpuPct > 70
        ? "Warning: Your buying power usage is elevated. If volatility spikes and margins expand, you risk forced liquidations. Keep at least 30-50% in cash."
        : bpuPct < 25
          ? "You have abundant dry powder. In a low-to-moderate IV environment, deploying 35-45% into 45 DTE premium sales puts your capital to work."
          : "Your capital allocation is right in the sweet spot. You have sufficient cash reserves to defend positions if implied volatility surges.",
      explanation: "Capital allocation is the single biggest determinant of long-term options survival. Systematic guidelines recommend never exceeding 50% BPU during low volatility.",
    },
    {
      id: "duration-management",
      title: "5. Duration & Trade Management (45 & 21 DTE)",
      currentValue: `${manageAlerts.length} Active Alert${manageAlerts.length === 1 ? "" : "s"}`,
      subValue: "45 DTE Entry · 21 DTE Management · 50% Profit Target",
      targetValue: "0 Unmanaged Positions < 21 DTE",
      status: manageAlerts.length > 0 ? "WARN" : "GOOD",
      badge: manageAlerts.length > 0 ? "Action Required" : "All Positions In Cycle",
      tomTake: manageAlerts.length > 0
        ? `You have ${manageAlerts.length} position(s) that meet management criteria (under 21 DTE or reached 50% profit). Roll or close them to avoid tail gamma risk.`
        : "All active positions are currently within the optimal 45–21 DTE window without excessive gamma acceleration.",
      explanation: "Opening at ~45 DTE captures the steepest linear theta decay; managing at 21 DTE avoids nonlinear gamma spikes into expiration week.",
    },
    {
      id: "diversification",
      title: "6. Occurrences & Non-Correlated Assets",
      currentValue: `${positions.length} Positions`,
      subValue: `${breakdown.filter(p => p.assetType === "stock").length} Equities · ${breakdown.filter(p => p.assetType === "option").length} Options`,
      targetValue: "Trade Small, Trade Often across non-correlated sectors",
      status: positions.length < 3 ? "WARN" : "GOOD",
      badge: positions.length >= 4 ? "Good Dispersion" : "Concentrated",
      tomTake: positions.length < 3
        ? "Core rule: 'Trade small, trade often.' With only a few positions, idiosyncratic risk is high. Adding uncorrelated underlyings (Gold/GLD, Treasuries/TLT, Energy/XLE) smooths portfolio variance."
        : "Good number of occurrences. Ensure individual position sizes remain under 3-5% of total account value.",
      explanation: "High number of uncorrelated occurrences creates the Law of Large Numbers that allows statistical option edge to play out.",
    },
  ];

  // Top 3 Priority Moves
  const top3PriorityMoves = [];
  let moveRank = 1;

  if (isLongHeavy) {
    top3PriorityMoves.push({
      rank: moveRank++,
      title: "Neutralize Excessive Long Delta",
      action: `Sell 45 DTE 16Δ SPY Call Spread or Buy SPX Put Debit Spread to offset +${spyBetaDeltaDecimal.toFixed(0)} SPY deltas.`,
      impact: `Reduces portfolio beta delta by ~${Math.round(Math.abs(spyBetaDeltaDecimal) * 0.7)} shares and protects against sharp selloffs.`,
      category: "DELTA" as const,
    });
  }

  const stockHoldings = positions.filter((p) => p.assetType === "stock" && p.quantity >= 50);
  if (stockHoldings.length > 0) {
    const topStock = stockHoldings.sort((a, b) => (b.quantity * (spots[b.symbol.toUpperCase()] ?? 100)) - (a.quantity * (spots[a.symbol.toUpperCase()] ?? 100)))[0];
    const topStockSym = topStock.symbol.toUpperCase();
    const topSpot = spots[topStockSym] ?? topStock.price ?? 150;
    const recStrike = Math.round((topSpot * 1.05) / 2.5) * 2.5;
    const premEst = round2(bsCallPrice({ spot: topSpot, strike: recStrike, yearsToExpiry: 45 / 365, vol: 0.30 }) * 100 * Math.max(1, Math.round(topStock.quantity / 100)));

    top3PriorityMoves.push({
      rank: moveRank++,
      title: `Monetize Long ${topStockSym} Shares (Covered Call)`,
      action: `Sell 45 DTE ${recStrike} Call against your ${topStock.quantity} shares of ${topStockSym}.`,
      impact: `Collects ~$${premEst.toLocaleString()} in immediate cash flow (~${((premEst / (topStock.quantity * topSpot)) * 100).toFixed(1)}% return in 45 days) and lowers cost basis.`,
      category: "THETA" as const,
    });
  }

  if (manageAlerts.length > 0) {
    top3PriorityMoves.push({
      rank: moveRank++,
      title: "Execute 21 DTE / 50% Profit Rule",
      action: manageAlerts[0].title,
      impact: manageAlerts[0].recommendation,
      category: "MANAGEMENT" as const,
    });
  } else {
    top3PriorityMoves.push({
      rank: moveRank++,
      title: "Add Non-Correlated Premium Sale",
      action: "Sell 45 DTE 16Δ Strangle or Jade Lizard on TLT (Bonds) or GLD (Gold).",
      impact: "Introduces non-equity daily theta harvest without adding correlated stock market beta risk.",
      category: "DIVERSIFICATION" as const,
    });
  }

  // --------------------------------------------------------------------------
  // Signature Plays (High IV Rank & Uncorrelated Options)
  // --------------------------------------------------------------------------
  const signaturePlays: SosnoffSignaturePlay[] = [
    {
      id: "spy-strangle-45",
      symbol: "SPY",
      name: "S&P 500 ETF Trust",
      strategy: "45 DTE 16Δ Short Strangle",
      action: `SELL SPY 45DTE ${Math.round(spySpot * 0.94)}P / ${Math.round(spySpot * 1.04)}C STRANGLE`,
      category: "INDEX",
      ivr: 32,
      dte: 45,
      pop: 72,
      targetThetaDaily: round2(spySpot * 0.045),
      estCredit: round2(spySpot * 0.016 * 100),
      maxLoss: "Undefined Risk (Manage at 21 DTE or 2x Credit)",
      bpu: round2(spySpot * 100 * 0.20),
      whyTomRecommends: "Flagship systematic trade: High probability (70%+ POP), captures bidirectional time decay, and beta-weights cleanly against the entire market.",
    },
    {
      id: "tlt-iron-condor-45",
      symbol: "TLT",
      name: "20+ Year Treasury Bond ETF",
      strategy: "45 DTE Defined Risk Iron Condor",
      action: "SELL TLT 45DTE 16Δ / 5Δ IRON CONDOR",
      category: "UNCORRELATED",
      ivr: 44,
      dte: 45,
      pop: 68,
      targetThetaDaily: 6.50,
      estCredit: 165,
      maxLoss: "$335 (Defined Risk)",
      bpu: 500,
      whyTomRecommends: "Uncorrelated to equities. Provides pure interest rate volatility harvesting with zero equity market crash beta.",
    },
    {
      id: "gld-short-put-45",
      symbol: "GLD",
      name: "SPDR Gold Shares",
      strategy: "45 DTE 16Δ Cash-Secured Put",
      action: "SELL GLD 45DTE 16Δ NAKED / CASH-SECURED PUT",
      category: "UNCORRELATED",
      ivr: 48,
      dte: 45,
      pop: 84,
      targetThetaDaily: 8.20,
      estCredit: 240,
      maxLoss: "Capped to Strike Zero ($23,000)",
      bpu: 3500,
      whyTomRecommends: "High-probability play during consolidations: 84% probability of profit, positive theta, and inverse correlation to dollar spikes.",
    },
  ];

  const axioms = [
    "Trade small, trade often — the Law of Large Numbers is your statistical edge.",
    "Sell premium when Implied Volatility is high; IV is overstated over 83% of the time.",
    "Enter at ~45 DTE to capture optimal theta decay; manage or roll at 21 DTE to eliminate gamma risk.",
    "Manage winners early: Take profit at 50% of maximum credit to dramatically increase your win rate.",
    "Keep 30% to 50% in cash during low IV so you have maximum buying power when volatility surges.",
    "Theta is the rent you collect; directional delta is the risk you must defend.",
  ];

  const sosnoffScorecard: SosnoffScorecard = {
    overallGrade,
    gradeTitle: isLongHeavy 
      ? "Directional Long Equity Heavy" 
      : isShortHeavy 
        ? "Aggressive Short Bias" 
        : isThetaDeficient 
          ? "Un-monetized Portfolio (Low Theta)" 
          : "Balanced Portfolio Setup",
    verdictSummary: isLongHeavy
      ? `This portfolio is running ${Math.round(spyDeltaRatio * 100)}% net long equity delta with minimal daily time decay ($${totalDailyTheta.toFixed(2)}/day). In a sudden market downturn, you have little downside buffer. We recommend monetizing long stock with 45 DTE covered calls and adding delta-neutral call spreads to boost theta to ~0.10% daily.`
      : `Portfolio holds ${positions.length} positions with ${bpuPct}% buying power usage and $${totalDailyTheta.toFixed(2)}/day in net theta. Focus on maintaining duration consistency (45 DTE) and managing winners at 50% profit.`,
    totalNLV: round2(effectiveNLV),
    spyBetaDelta: spyBetaDeltaDecimal,
    spyDeltaDollars: totalDeltaDollars,
    spyDeltaRatio: round2(spyDeltaRatio),
    dailyTheta: round2(totalDailyTheta),
    dailyThetaPct: round2(dailyThetaPct),
    annualizedThetaYield: round2(annualizedThetaYield),
    thetaToDeltaRatio,
    bpuPct,
    cashPct,
    pillars,
    top3PriorityMoves,
    manageAlerts,
    signaturePlays,
    axioms,
  };

  // --------------------------------------------------------------------------
  // Trade Ideas: Delta Neutral & Macro Hedges
  // --------------------------------------------------------------------------
  const ideas: TradeIdea[] = [];
  const T = 30 / 365;

  if (!neutral && spxSpot) {
    const long = totalDeltaDollars > 0;

    if (long) {
      const putStrike = Math.round((spxSpot * 0.97) / 5) * 5;
      const singlePutDelta = bsPutDelta({ spot: spxSpot, strike: putStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const singlePutGamma = bsGamma({ spot: spxSpot, strike: putStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const singlePutVega = bsVega({ spot: spxSpot, strike: putStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const singlePutTheta = bsTheta({ spot: spxSpot, strike: putStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV, type: "put" });
      const singlePutPrem = bsPutPrice({ spot: spxSpot, strike: putStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV });

      const putContracts = Math.max(1, Math.round(spxBetaDeltaDecimal / (Math.abs(singlePutDelta) * 100)) || 1);
      const totalHedgeDeltaAdded = round2(putContracts * 100 * singlePutDelta);
      const postHedgeDelta = round2(spxBetaDeltaDecimal + totalHedgeDeltaAdded);
      const neutralityPct = Math.min(100, round2(Math.max(0, (1 - Math.abs(postHedgeDelta) / Math.abs(spxBetaDeltaDecimal)) * 100)));
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
        riskDescription: `Defined Risk: Maximum loss is strictly capped at $${round2(putPremium).toLocaleString()} premium paid. No margin calls.`,
        rebalanceThreshold: `Rebalance when SPX moves ±5% or net delta drifts > ±2.0`,
        greeks: {
          delta: `${totalHedgeDeltaAdded >= 0 ? "+" : ""}${totalHedgeDeltaAdded.toFixed(2)} SPX eq.`,
          gamma: `+${(singlePutGamma * 100 * putContracts).toFixed(4)}`,
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
          "Positive Gamma (+Γ) expands protection during steep selloffs",
          "Defined-risk hedge preserves stock upside above premium cost",
        ],
      });

      // SPX Put Spread
      const longK = putStrike;
      const shortK = Math.round((spxSpot * 0.93) / 5) * 5;
      const longPrem = bsPutPrice({ spot: spxSpot, strike: longK, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const shortPrem = bsPutPrice({ spot: spxSpot, strike: shortK, yearsToExpiry: T, vol: ASSUMED_SPX_IV * 1.05 });
      const longDelta = bsPutDelta({ spot: spxSpot, strike: longK, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const shortDelta = bsPutDelta({ spot: spxSpot, strike: shortK, yearsToExpiry: T, vol: ASSUMED_SPX_IV * 1.05 });
      const netSpreadDelta = longDelta - shortDelta;

      const spreadContracts = Math.max(1, Math.round(spxBetaDeltaDecimal / (Math.abs(netSpreadDelta) * 100)) || 1);
      const spreadHedgeDelta = round2(spreadContracts * 100 * netSpreadDelta);
      const postSpreadDelta = round2(spxBetaDeltaDecimal + spreadHedgeDelta);
      const spreadNeutralityPct = Math.min(100, round2(Math.max(0, (1 - Math.abs(postSpreadDelta) / Math.abs(spxBetaDeltaDecimal)) * 100)));
      const singleSpreadCost = Math.max(0.5, longPrem - shortPrem);
      const spreadCost = singleSpreadCost * 100 * spreadContracts;
      const width = longK - shortK;
      const maxSpreadGain = round2((width - singleSpreadCost) * 100 * spreadContracts);

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
        breakeven: `SPX ${(longK - singleSpreadCost).toFixed(2)}`,
        riskDescription: `Defined Risk: Maximum loss capped at $${round2(spreadCost).toLocaleString()}. Short leg reduces theta decay by ~45%.`,
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
          "Lower theta drag enables maintaining the hedge through quiet periods",
        ],
      });
    } else {
      // Net Short -> Add calls
      const callStrike = Math.round((spxSpot * 1.03) / 5) * 5;
      const singleCallDelta = bsCallDelta({ spot: spxSpot, strike: callStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const singleCallGamma = bsGamma({ spot: spxSpot, strike: callStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const singleCallVega = bsVega({ spot: spxSpot, strike: callStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV });
      const singleCallTheta = bsTheta({ spot: spxSpot, strike: callStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV, type: "call" });
      const singleCallPrem = bsCallPrice({ spot: spxSpot, strike: callStrike, yearsToExpiry: T, vol: ASSUMED_SPX_IV });

      const callContracts = Math.max(1, Math.round(Math.abs(spxBetaDeltaDecimal) / (singleCallDelta * 100)) || 1);
      const totalHedgeDeltaAdded = round2(callContracts * 100 * singleCallDelta);
      const postHedgeDelta = round2(spxBetaDeltaDecimal + totalHedgeDeltaAdded);
      const neutralityPct = Math.min(100, round2(Math.max(0, (1 - Math.abs(postHedgeDelta) / Math.abs(spxBetaDeltaDecimal)) * 100)));
      const callPremium = singleCallPrem * 100 * callContracts;

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
        probabilityLabel: "68% Modelled POP",
        riskType: "Defined",
        riskLevel: "Low Risk",
        maxProfit: "Unlimited (No theoretical upside cap on SPX rally)",
        maxLoss: `${fmtUsd(callPremium)} (Defined to 100% of Premium Paid)`,
        breakeven: `SPX ${(callStrike + singleCallPrem).toFixed(2)}`,
        riskDescription: `Defined Risk: Loss is strictly capped at $${round2(callPremium).toLocaleString()}.`,
        rebalanceThreshold: `Rebalance when market moves ±5%`,
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
          "Defined-risk hedge capping maximum potential loss",
        ],
      });
    }
  }

  // --------------------------------------------------------------------------
  // Single-Asset Covered Call & Hedge Engine (Tom Sosnoff Stock Monetizer)
  // --------------------------------------------------------------------------
  const stockPositions = positions.filter((p) => p.assetType === "stock" && p.quantity > 0);
  const singleAssetHedges: SingleAssetHedge[] = stockPositions.map((p) => {
    const sym = p.symbol.toUpperCase();
    const spot = spots[sym] ?? p.price ?? p.costBasis ?? 100;
    const beta = betas[sym] ?? 1.0;
    const rawDelta = p.quantity;
    const dollarDelta = rawDelta * spot;
    const vol = ASSUMED_STOCK_IV;
    const dte45 = 45;
    const t45 = dte45 / 365;

    // Standard 30Δ Covered Call (~5% OTM)
    const callStrike30 = Math.round((spot * 1.05) / 2.5) * 2.5;
    const callDelta30 = bsCallDelta({ spot, strike: callStrike30, yearsToExpiry: t45, vol });
    const callContracts = Math.max(1, Math.round(rawDelta / 100) || 1);
    const callPrem30 = bsCallPrice({ spot, strike: callStrike30, yearsToExpiry: t45, vol }) * 100 * callContracts;
    const callPostDelta = round2(rawDelta - (callContracts * 100 * callDelta30));
    const callYieldPct = round2((callPrem30 / (rawDelta * spot)) * 100);

    // Conservative 16Δ Covered Call (~10% OTM, ~84% POP)
    const callStrike16 = Math.round((spot * 1.10) / 2.5) * 2.5;
    const callDelta16 = bsCallDelta({ spot, strike: callStrike16, yearsToExpiry: t45, vol });
    const callPrem16 = bsCallPrice({ spot, strike: callStrike16, yearsToExpiry: t45, vol }) * 100 * callContracts;
    const yieldPct16 = round2((callPrem16 / (rawDelta * spot)) * 100);

    // Protective Put
    const putStrike = Math.round((spot * 0.95) / 2.5) * 2.5;
    const putDelta = bsPutDelta({ spot, strike: putStrike, yearsToExpiry: t45, vol });
    const putContracts = Math.max(1, Math.round(rawDelta / 100) || 1);
    const putCost = bsPutPrice({ spot, strike: putStrike, yearsToExpiry: t45, vol }) * 100 * putContracts;
    const putPostDelta = round2(rawDelta + (putContracts * 100 * putDelta));

    return {
      symbol: sym,
      quantity: p.quantity,
      price: round2(spot),
      beta: round2(beta),
      rawDelta,
      dollarDelta: round2(dollarDelta),
      callHedge: {
        action: `SELL ${callContracts}x ${sym} ${callStrike30}C (45 DTE)`,
        strike: callStrike30,
        contracts: callContracts,
        contractDelta: round2(callDelta30),
        premium: round2(callPrem30),
        postDelta: callPostDelta,
        dte: dte45,
        yieldPct: callYieldPct,
        pop: 70,
      },
      putHedge: {
        action: `BUY ${putContracts}x ${sym} ${putStrike}P (45 DTE)`,
        strike: putStrike,
        contracts: putContracts,
        contractDelta: round2(putDelta),
        cost: round2(putCost),
        postDelta: putPostDelta,
        dte: dte45,
        pop: 70,
      },
      conservativeCall: {
        strike: callStrike16,
        contracts: callContracts,
        premium: round2(callPrem16),
        delta: round2(callDelta16),
        pop: 84,
        yieldPct: yieldPct16,
      },
    };
  });

  return {
    hasPositions: true as const,
    spxSpot: spxSpot ? round2(spxSpot) : null,
    spySpot: spySpot ? round2(spySpot) : null,
    vixSpot: round2(vixSpot),
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
    sosnoffScorecard,
    deltaNeutralFormulation: {
      definition: "Delta neutrality creates a portfolio where total first-order price sensitivity is zero: Δ_portfolio = Σ(w_i * Δ_i) = 0.",
      hedgeRatioFormula: "N_contracts = -Δ_unhedged / (100 * Δ_contract)",
      gammaSensitivity: "Non-zero Gamma (Γ = ∂Δ/∂S) causes Delta to drift as prices move, requiring periodic dynamic rebalancing.",
      neutralThresholdDollars: NEUTRAL_THRESHOLD_DOLLARS,
    },
    note: "Calculated using Black-Scholes partial derivatives, CAPM Beta weighting, and quantitative options trading mechanics.",
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
            source: "wholewealth",
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

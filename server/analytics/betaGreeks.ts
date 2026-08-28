import { bsCallDelta, bsPutDelta } from "./blackScholes";
import type { ChainContract } from "./engine";

/**
 * Standard S&P 500 Betas for popular stocks, ETFs, indices, commodities, and bonds.
 * Beta measures covariance of asset returns relative to SPY / S&P 500.
 */
export const POPULAR_BETAS: Record<string, number> = {
  // Broad Market & Indices
  SPY: 1.0,
  VOO: 1.0,
  IVV: 1.0,
  SPLG: 1.0,
  QQQ: 1.18,
  QQQM: 1.18,
  IWM: 1.15,
  DIA: 0.85,
  VTI: 1.02,
  VT: 0.95,
  XLK: 1.25,
  XLF: 1.05,
  XLE: 0.82,
  XLV: 0.72,
  XLI: 1.02,
  XLU: 0.58,
  XLP: 0.54,
  XLY: 1.22,
  SMH: 1.65,
  SOXX: 1.60,

  // Fixed Income & Cash Equivalent ETFs
  SGOV: 0.0,
  BIL: 0.0,
  SHV: 0.0,
  USFR: 0.0,
  ICSH: 0.0,
  TBIL: 0.0,
  CLIP: 0.0,
  BOXX: 0.0,
  MINT: 0.0,
  TLT: -0.32,
  IEF: -0.15,
  SHY: 0.02,
  AGG: 0.08,
  BND: 0.08,
  HYG: 0.40,
  JNK: 0.42,

  // Dividend & Income ETFs
  SCHD: 0.40,
  VYM: 0.65,
  DVY: 0.68,
  HDV: 0.62,
  JEPI: 0.60,
  JEPQ: 0.70,
  DIVO: 0.65,

  // Commodities & Precious Metals
  GLD: 0.042,
  GLDN: 0.042,
  IAU: 0.042,
  SGOL: 0.042,
  SLV: 0.35,
  USO: 0.52,
  UNG: 0.38,

  // Mega-cap & Tech
  AAPL: 1.12,
  MSFT: 1.08,
  NVDA: 1.75,
  TSLA: 2.15,
  AMZN: 1.22,
  GOOGL: 1.08,
  GOOG: 1.08,
  META: 1.28,
  NFLX: 0.61,
  AMD: 1.68,
  AVGO: 1.45,
  INTC: 1.12,
  QCOM: 1.32,
  MU: 1.55,
  ARM: 1.85,
  TSM: 1.25,
  ASML: 1.30,

  // High Growth & Volatility
  PLTR: 2.35,
  COIN: 3.10,
  MSTR: 3.40,
  MARA: 3.25,
  RIOT: 3.15,
  HOOD: 2.20,
  SOFI: 2.10,
  UPST: 2.65,
  RBLX: 1.95,
  AFRM: 2.80,
  UBER: 1.42,
  ABNB: 1.35,
  SHOP: 1.85,
  SQ: 2.15,

  // Financials & Value
  JPM: 1.10,
  BAC: 1.22,
  WFC: 1.15,
  GS: 1.30,
  MS: 1.35,
  BRK: 0.88,
  "BRK.B": 0.88,
  V: 0.98,
  MA: 1.05,
  PYPL: 1.45,

  // Healthcare & Consumer Staples (Defensive)
  JNJ: 0.54,
  PG: 0.56,
  KO: 0.55,
  PEP: 0.58,
  WMT: 0.52,
  COST: 0.82,
  TGT: 1.05,
  UNH: 0.72,
  PFE: 0.65,
  ABBV: 0.62,
  LLY: 0.78,
  MRK: 0.58,
  MCD: 0.68,

  // Energy & Industrials
  XOM: 0.78,
  CVX: 0.82,
  COP: 1.10,
  SLB: 1.35,
  CAT: 1.15,
  DE: 1.08,
  BA: 1.45,
  GE: 1.20,
  DIS: 1.25,
};

/** Get the beta for a given ticker with intelligent heuristics fallback */
export function getSymbolBeta(
  symbol: string,
  assetType?: string,
  customBetas?: Record<string, number>,
): number {
  const sym = symbol.toUpperCase().trim();
  if (customBetas && typeof customBetas[sym] === "number" && isFinite(customBetas[sym])) {
    return +customBetas[sym].toFixed(3);
  }
  if (POPULAR_BETAS[sym] != null) {
    return POPULAR_BETAS[sym];
  }
  // Cash / T-Bill ETFs
  if (
    sym === "SGOV" ||
    sym === "BIL" ||
    sym === "SHV" ||
    sym === "USFR" ||
    sym === "TBIL" ||
    sym === "CLIP" ||
    sym === "BOXX" ||
    sym === "ICSH" ||
    sym === "MINT"
  ) {
    return 0.0;
  }
  // Gold / Precious Metals
  if (sym === "GLD" || sym === "GLDN" || sym === "IAU" || sym === "SGOL" || sym === "BAR") {
    return 0.042;
  }
  if (sym === "SLV" || sym === "SIVR") return 0.35;
  if (sym === "SCHD" || sym === "VYM" || sym === "HDV") return 0.40;
  if (assetType === "etf") return 1.0;
  return 1.0; // Default beta = 1.0
}

export interface PositionGreekInput {
  id?: number;
  symbol: string;
  description?: string | null;
  assetType: "stock" | "option" | "etf" | "other";
  quantity: number;
  costBasis?: number | null;
  price?: number | null;
  optionType?: "call" | "put" | null;
  strike?: number | null;
  expiry?: string | null; // YYYY-MM-DD
  rawSymbol?: string | null;
}

export interface PositionGreekResult {
  id?: number;
  symbol: string;
  description: string | null;
  assetType: "stock" | "option" | "etf" | "other";
  quantity: number; // positive for long, negative for short
  spot: number;
  marketValue: number;
  beta: number;
  multiplier: number; // 1 for stocks/ETFs, 100 for standard equity options
  contractDelta: number; // Single unit delta (+1.0 for long stock, +0.01 to +0.99 for call, -0.01 to -0.99 for put)
  positionDelta: number; // Delta contribution = quantity * contractDelta * multiplier (equivalent underlying shares)
  perDollarMoveImpact: number; // P&L change if this underlying moves by $1.00 = positionDelta * $1.00
  spyBetaDelta: number; // SPY Beta-weighted delta
  spxBetaDelta: number; // SPX Beta-weighted delta
  dollarDelta: number; // Dollar sensitivity per 100% SPX move
  spx1PctDollarImpact: number; // Dollar impact of a +1% S&P 500 move
  optionDetails?: {
    optionType: "call" | "put";
    strike: number;
    expiry: string;
    dte: number;
    moneynessPct: number;
    isCovered: boolean;
  } | null;
}

export interface UnderlyingGreekSummary {
  symbol: string;
  description: string | null;
  spot: number;
  beta: number;
  equityShares: number;
  equityDelta: number;
  shortCallContracts: number;
  shortPutContracts: number;
  longCallContracts: number;
  longPutContracts: number;
  optionDelta: number;
  netDelta: number; // Total net delta for this underlying in share equivalents
  perDollarMoveImpact: number; // P&L impact per $1.00 move in this underlying (= netDelta * $1.00)
  coverageRatio: number; // % of equity shares covered by short calls
  marketValue: number;
  portfolioWeight: number;
  spyBetaDelta: number;
  spxBetaDelta: number;
  dollarDelta: number;
  spx1PctDollarImpact: number;
  directionalStatus: "Bullish (Long)" | "Bearish (Short)" | "Covered / Hedged" | "Delta Neutral";
}

export interface PortfolioGreekAnalysis {
  portfolioValue: number;
  benchmark: {
    symbol: "SPY";
    spySpot: number;
    spxSpot: number;
  };
  // Summary Aggregates
  netPortfolioDelta: number; // Arithmetic sum of position deltas
  totalEquityDelta: number; // Delta from long/short shares
  totalOptionDelta: number; // Delta from short/long options
  totalSpyBetaDelta: number; // SPY-weighted Delta (sensitivity to $1 SPY move)
  totalSpxBetaDelta: number; // SPX-weighted Delta (sensitivity to $1 SPX point move)
  totalDollarDelta: number; // Total portfolio dollar delta
  spx1PctDollarImpact: number; // Dollar gain/loss per +1% move in S&P 500
  effectivePortfolioBeta: number; // Portfolio-weighted beta = totalDollarDelta / portfolioValue
  directionalBias: {
    label: "Long Market Bias" | "Short Market Bias" | "Delta Neutral / Balanced";
    severity: "bullish" | "bearish" | "neutral";
    description: string;
  };
  hedgingGuide: {
    spySharesToNeutral: number;
    spxContractsToNeutral: number;
    mesContractsToNeutral: number;
  };
  underlyings: UnderlyingGreekSummary[];
  positions: PositionGreekResult[];
}

const DAY_MS = 86400000;

function calcDte(expiry: string): number {
  try {
    const expDate = new Date(expiry + "T16:00:00Z").getTime();
    const now = Date.now();
    return Math.max(0, Math.round((expDate - now) / DAY_MS));
  } catch {
    return 30;
  }
}

/** Helper to extract option details even if only description or rawSymbol was saved */
function extractOptionParameters(
  pos: PositionGreekInput,
  spot: number,
): {
  optionType: "call" | "put";
  strike: number;
  expiry: string;
} {
  let isCall = pos.optionType === "call" || pos.optionType == null;
  let strike = pos.strike ?? null;
  let expiry = pos.expiry ?? null;

  const text = `${pos.description ?? ""} ${pos.rawSymbol ?? ""}`.trim();
  if ((!strike || !expiry) && text) {
    // OCC format: e.g. NFLX261016C00085000 or NFLX  261016C00085000
    const occMatch = text.match(/([A-Z]+)\s*(\d{2})(\d{2})(\d{2})([CP])(\d{8})/i);
    if (occMatch) {
      const year = 2000 + parseInt(occMatch[2], 10);
      const month = occMatch[3].padStart(2, "0");
      const day = occMatch[4].padStart(2, "0");
      expiry = `${year}-${month}-${day}`;
      isCall = occMatch[5].toUpperCase() === "C";
      strike = parseInt(occMatch[6], 10) / 1000;
    } else {
      // Human readable format: e.g. "INTC Oct16'26 67.5 Put" or "NFLX Oct16'26 85 Call"
      const monthMap: Record<string, string> = {
        JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
        JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12"
      };
      const humanMatch = text.match(/([A-Za-z]{3})\s*(\d{1,2})['\s](\d{2,4})\s+([\d.]+)\s+(Call|Put|C|P)/i);
      if (humanMatch) {
        const mStr = humanMatch[1].toUpperCase();
        const m = monthMap[mStr] ?? "01";
        const d = humanMatch[2].padStart(2, "0");
        let y = humanMatch[3];
        if (y.length === 2) y = `20${y}`;
        expiry = `${y}-${m}-${d}`;
        strike = parseFloat(humanMatch[4]);
        isCall = humanMatch[5].toUpperCase().startsWith("C");
      }
    }
  }

  return {
    optionType: isCall ? "call" : "put",
    strike: strike && strike > 0 ? strike : spot,
    expiry: expiry ?? new Date(Date.now() + 30 * DAY_MS).toISOString().split("T")[0],
  };
}

/**
 * Calculate full Greeks and Beta-Weighted Delta analysis across a user's positions.
 *
 * Broker Beta-Weighted Delta standard formulas:
 * - Position Delta = Quantity * Contract_Delta * Multiplier
 *   (Stocks: 1 share = 1.0 delta; Calls: delta in [0.01, 0.99]; Puts: delta in [-0.99, -0.01])
 * - Dollar Delta = Position Delta * Underlying Spot * Beta
 * - SPX Beta Delta = (Position Delta * Underlying Spot * Beta) / SPX_Spot
 * - SPY Beta Delta = (Position Delta * Underlying Spot * Beta) / SPY_Spot
 */
export function calculatePortfolioGreeks(params: {
  positions: PositionGreekInput[];
  spots: Record<string, number>;
  chains?: Record<string, ChainContract[]>;
  spySpot?: number;
  spxSpot?: number;
  customBetas?: Record<string, number>;
}): PortfolioGreekAnalysis {
  const { positions, spots } = params;

  // Resolve Benchmark Prices (SPY and SPX)
  const spySpot = params.spySpot && params.spySpot > 0 ? params.spySpot : (spots["SPY"] ?? 595.0);
  const spxSpot =
    params.spxSpot && params.spxSpot > 0
      ? params.spxSpot
      : (spots["^GSPC"] && spots["^GSPC"] > 0 ? spots["^GSPC"] : spySpot * 10);

  const analyzedPositions: PositionGreekResult[] = [];

  for (const pos of positions) {
    const sym = pos.symbol.toUpperCase().trim();
    const spot = spots[sym] ?? pos.price ?? pos.costBasis ?? 100.0;
    const beta = getSymbolBeta(sym, pos.assetType, params.customBetas);

    let contractDelta = 1.0;
    let multiplier = 1;
    let positionDelta = 0;
    let marketValue = 0;
    let optionDetails: PositionGreekResult["optionDetails"] = null;

    if (pos.assetType === "stock" || pos.assetType === "etf") {
      multiplier = 1;
      contractDelta = 1.0;
      // Stock contribution = quantity * 1.0 (positive for long, negative for short)
      positionDelta = pos.quantity * contractDelta * multiplier;
      marketValue = pos.quantity * spot;
    } else if (pos.assetType === "option") {
      multiplier = 100;
      const parsedOpt = extractOptionParameters(pos, spot);
      const isCall = parsedOpt.optionType === "call";
      const strike = parsedOpt.strike;
      const expiry = parsedOpt.expiry;
      const dte = calcDte(expiry);
      const T = Math.max(1, dte) / 365;

      // Look up chain delta if present, otherwise calculate with Black-Scholes
      let rawDelta = 0;
      const chainMatch = params.chains?.[sym]?.find(
        (c) =>
          c.optionType === (isCall ? "call" : "put") &&
          Math.abs(c.strike - strike) < 0.01 &&
          c.expiry === expiry
      );

      if (chainMatch?.delta != null && !isNaN(chainMatch.delta)) {
        rawDelta = chainMatch.delta;
      } else {
        const vol = chainMatch?.iv && chainMatch.iv > 0.05 ? chainMatch.iv : 0.32;
        rawDelta = isCall
          ? bsCallDelta({ spot, strike, yearsToExpiry: T, vol })
          : bsPutDelta({ spot, strike, yearsToExpiry: T, vol });
      }

      // Calls have delta in [0.01, 0.99]; Puts have delta in [-0.99, -0.01]
      rawDelta = isCall
        ? Math.max(0.01, Math.min(0.99, rawDelta))
        : Math.min(-0.01, Math.max(-0.99, rawDelta));
      contractDelta = rawDelta;

      // Option contribution = contracts * option_delta * contract_multiplier (100)
      // Long Call (+1 * 0.436 * 100) = +43.6 delta
      // Short Call (-1 * 0.436 * 100) = -43.6 delta
      // Long Put (+1 * -0.450 * 100) = -45.0 delta
      // Short Put (-1 * -0.450 * 100) = +45.0 delta (bullish)
      positionDelta = pos.quantity * contractDelta * multiplier;
      marketValue = Math.abs(pos.quantity) * 100 * (pos.price ?? pos.costBasis ?? 2.5);

      optionDetails = {
        optionType: isCall ? "call" : "put",
        strike,
        expiry,
        dte,
        moneynessPct: ((spot - strike) / strike) * 100,
        isCovered: false, // will be evaluated at underlying aggregate level
      };
    } else {
      multiplier = 1;
      positionDelta = pos.quantity;
      marketValue = pos.quantity * spot;
    }

    // Dollar Delta = PositionDelta * UnderlyingSpot * Beta
    const dollarDelta = positionDelta * spot * beta;
    // SPX Beta-Weighted Delta = (PositionDelta * UnderlyingSpot * Beta) / SPX_Spot
    const spxBetaDelta = spot > 0 && spxSpot > 0 ? dollarDelta / spxSpot : 0;
    // SPY Beta-Weighted Delta = (PositionDelta * UnderlyingSpot * Beta) / SPY_Spot
    const spyBetaDelta = spot > 0 && spySpot > 0 ? dollarDelta / spySpot : 0;
    // Dollar impact of a +1% S&P 500 move = DollarDelta * 0.01
    const spx1PctDollarImpact = dollarDelta * 0.01;
    // $1.00 Move P&L in the underlying asset itself = positionDelta * $1.00
    const perDollarMoveImpact = positionDelta * 1.0;

    analyzedPositions.push({
      id: pos.id,
      symbol: sym,
      description: pos.description ?? null,
      assetType: pos.assetType,
      quantity: pos.quantity,
      spot,
      marketValue,
      beta,
      multiplier,
      contractDelta: +contractDelta.toFixed(3),
      positionDelta: +positionDelta.toFixed(2),
      perDollarMoveImpact: +perDollarMoveImpact.toFixed(2),
      spyBetaDelta: +spyBetaDelta.toFixed(2),
      spxBetaDelta: +spxBetaDelta.toFixed(3),
      dollarDelta: +dollarDelta.toFixed(2),
      spx1PctDollarImpact: +spx1PctDollarImpact.toFixed(2),
      optionDetails,
    });
  }

  // Aggregate by Underlying
  const underlyingMap = new Map<string, UnderlyingGreekSummary>();

  for (const p of analyzedPositions) {
    const sym = p.symbol;
    const existing = underlyingMap.get(sym) ?? {
      symbol: sym,
      description: p.description,
      spot: p.spot,
      beta: p.beta,
      equityShares: 0,
      equityDelta: 0,
      shortCallContracts: 0,
      shortPutContracts: 0,
      longCallContracts: 0,
      longPutContracts: 0,
      optionDelta: 0,
      netDelta: 0,
      coverageRatio: 0,
      marketValue: 0,
      portfolioWeight: 0,
      spyBetaDelta: 0,
      spxBetaDelta: 0,
      dollarDelta: 0,
      spx1PctDollarImpact: 0,
      directionalStatus: "Delta Neutral",
    };

    if (p.assetType === "stock" || p.assetType === "etf") {
      existing.equityShares += p.quantity;
      existing.equityDelta += p.positionDelta;
    } else if (p.assetType === "option") {
      existing.optionDelta += p.positionDelta;
      if (p.optionDetails?.optionType === "call") {
        if (p.quantity < 0) existing.shortCallContracts += Math.abs(p.quantity);
        else existing.longCallContracts += p.quantity;
      } else if (p.optionDetails?.optionType === "put") {
        if (p.quantity < 0) existing.shortPutContracts += Math.abs(p.quantity);
        else existing.longPutContracts += p.quantity;
      }
    }

    existing.marketValue += p.marketValue;
    existing.spyBetaDelta += p.spyBetaDelta;
    existing.spxBetaDelta += p.spxBetaDelta;
    existing.dollarDelta += p.dollarDelta;
    existing.spx1PctDollarImpact += p.spx1PctDollarImpact;

    underlyingMap.set(sym, existing);
  }

  const totalPortfolioValue = [...underlyingMap.values()].reduce((sum, u) => sum + Math.max(0, u.marketValue), 0);

  const underlyings: UnderlyingGreekSummary[] = [...underlyingMap.values()].map((u) => {
    const netDelta = u.equityDelta + u.optionDelta;
    const weight = totalPortfolioValue > 0 ? u.marketValue / totalPortfolioValue : 0;

    // Coverage Ratio (% of long shares hedged by short calls)
    let coverageRatio = 0;
    if (u.equityShares >= 100 && u.shortCallContracts > 0) {
      coverageRatio = Math.min(100, Math.round((u.shortCallContracts * 100 / u.equityShares) * 100));
    }

    let directionalStatus: UnderlyingGreekSummary["directionalStatus"] = "Delta Neutral";
    if (netDelta > 15) directionalStatus = "Bullish (Long)";
    else if (netDelta < -15) directionalStatus = "Bearish (Short)";
    else if (coverageRatio >= 80) directionalStatus = "Covered / Hedged";

    return {
      ...u,
      netDelta: +netDelta.toFixed(1),
      perDollarMoveImpact: +netDelta.toFixed(1),
      coverageRatio,
      portfolioWeight: +weight.toFixed(4),
      spyBetaDelta: +u.spyBetaDelta.toFixed(2),
      spxBetaDelta: +u.spxBetaDelta.toFixed(3),
      dollarDelta: +u.dollarDelta.toFixed(2),
      spx1PctDollarImpact: +u.spx1PctDollarImpact.toFixed(2),
      directionalStatus,
    };
  });

  // Sort underlyings by market value descending
  underlyings.sort((a, b) => b.marketValue - a.marketValue);

  // Portfolio Level Aggregates
  const netPortfolioDelta = analyzedPositions.reduce((sum, p) => sum + p.positionDelta, 0);
  const totalEquityDelta = analyzedPositions.filter((p) => p.assetType === "stock" || p.assetType === "etf").reduce((sum, p) => sum + p.positionDelta, 0);
  const totalOptionDelta = analyzedPositions.filter((p) => p.assetType === "option").reduce((sum, p) => sum + p.positionDelta, 0);
  const totalSpyBetaDelta = analyzedPositions.reduce((sum, p) => sum + p.spyBetaDelta, 0);
  const totalSpxBetaDelta = analyzedPositions.reduce((sum, p) => sum + p.spxBetaDelta, 0);
  const totalDollarDelta = analyzedPositions.reduce((sum, p) => sum + p.dollarDelta, 0);
  const spx1PctDollarImpact = totalDollarDelta * 0.01;

  const effectivePortfolioBeta = totalPortfolioValue > 0 ? +(totalDollarDelta / totalPortfolioValue).toFixed(2) : 0;

  // Directional Bias interpretation
  let biasLabel: PortfolioGreekAnalysis["directionalBias"]["label"] = "Delta Neutral / Balanced";
  let biasSeverity: PortfolioGreekAnalysis["directionalBias"]["severity"] = "neutral";
  let biasDesc = "Portfolio has minimal directional sensitivity to broad market fluctuations.";

  if (effectivePortfolioBeta > 0.35 || totalSpyBetaDelta > 40) {
    biasLabel = "Long Market Bias";
    biasSeverity = "bullish";
    biasDesc = `Portfolio gains ~$${Math.abs(spx1PctDollarImpact).toFixed(0)} for every +1% upward move in the S&P 500 (Effective Beta: ${effectivePortfolioBeta.toFixed(2)}).`;
  } else if (effectivePortfolioBeta < -0.35 || totalSpyBetaDelta < -40) {
    biasLabel = "Short Market Bias";
    biasSeverity = "bearish";
    biasDesc = `Portfolio profits ~$${Math.abs(spx1PctDollarImpact).toFixed(0)} for every -1% downward move in the S&P 500 (Effective Beta: ${effectivePortfolioBeta.toFixed(2)}).`;
  }

  return {
    portfolioValue: +totalPortfolioValue.toFixed(2),
    benchmark: {
      symbol: "SPY",
      spySpot: +spySpot.toFixed(2),
      spxSpot: +spxSpot.toFixed(2),
    },
    netPortfolioDelta: +netPortfolioDelta.toFixed(1),
    totalEquityDelta: +totalEquityDelta.toFixed(1),
    totalOptionDelta: +totalOptionDelta.toFixed(1),
    totalSpyBetaDelta: +totalSpyBetaDelta.toFixed(1),
    totalSpxBetaDelta: +totalSpxBetaDelta.toFixed(3),
    totalDollarDelta: +totalDollarDelta.toFixed(2),
    spx1PctDollarImpact: +spx1PctDollarImpact.toFixed(2),
    effectivePortfolioBeta,
    directionalBias: {
      label: biasLabel,
      severity: biasSeverity,
      description: biasDesc,
    },
    hedgingGuide: {
      spySharesToNeutral: -Math.round(totalSpyBetaDelta),
      spxContractsToNeutral: -Math.round(totalSpxBetaDelta),
      mesContractsToNeutral: -Math.round(totalSpyBetaDelta / 5), // Micro E-mini S&P 500 contract ≈ 50 delta
    },
    underlyings,
    positions: analyzedPositions,
  };
}

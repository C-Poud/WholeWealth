import {
  bsCallDelta,
  impliedVolCall,
  probBelow,
} from "./blackScholes";

/**
 * Normalized option contract consumed by the analytics engine. Both the
 * SnapTrade adapter and the demo generator produce this shape.
 */
export interface ChainContract {
  strike: number;
  expiry: string; // YYYY-MM-DD
  optionType: "call" | "put";
  bid: number | null;
  ask: number | null;
  last: number | null;
  openInterest?: number | null;
  iv?: number | null;
  delta?: number | null;
}

export interface CoveredCallCandidate {
  symbol: string;
  spot: number;
  basis: number;
  shares: number;
  contracts: number; // covered contracts available (floor(shares/100))
  strike: number;
  expiry: string;
  dte: number;
  bid: number;
  ask: number;
  mid: number;
  premium: number; // per share, at bid
  premiumTotal: number; // bid * 100 * contracts
  iv: number;
  delta: number;
  assignmentProb: number; // ≈ delta
  yieldPct: number; // premium / basis
  annualizedYieldPct: number;
  newBasis: number;
  breakeven: number;
  target50: number; // 50% max-profit exit price
  manageBy: string; // suggested management date
  score: number; // 0–10 mechanic score
  rationale: string[];
}

export interface RiskReport {
  symbol: string;
  spot: number;
  iv30: number | null;
  ivSource: "chain" | "unavailable";
  dte: number;
  expectedMove1Sigma: number | null;
  expectedMove2Sigma: number | null;
  lower1: number | null;
  upper1: number | null;
  lower2: number | null;
  upper2: number | null;
  probBelowBasis: number | null;
  portfolioWeight: number; // 0–1
  riskScore: number; // 0–10, higher = riskier
  riskLabel: "Low" | "Moderate" | "Elevated" | "High";
  notes: string[];
}

const DAY_MS = 86400000;

function dteOf(expiry: string, now = new Date()): number {
  return Math.max(0, Math.round((new Date(expiry + "T16:00:00Z").getTime() - now.getTime()) / DAY_MS));
}

/** Resolve IV + delta for a contract, deriving from mid price when missing. */
function enrichContract(c: ChainContract, spot: number) {
  const dte = dteOf(c.expiry);
  const T = Math.max(dte, 1) / 365;
  const mid =
    c.bid != null && c.ask != null && c.ask >= c.bid
      ? (c.bid + c.ask) / 2
      : (c.last ?? null);

  let iv = c.iv ?? null;
  if ((iv == null || iv <= 0) && mid != null && mid > 0 && c.optionType === "call") {
    iv = impliedVolCall(mid, spot, c.strike, T);
  }
  let delta = c.delta ?? null;
  if ((delta == null || delta <= 0) && iv != null && c.optionType === "call") {
    delta = bsCallDelta({ spot, strike: c.strike, yearsToExpiry: T, vol: iv });
  }
  return { dte, mid, iv, delta };
}

/** Estimate the 30-day ATM implied volatility from a chain. */
export function estimateIv30(contracts: ChainContract[], spot: number): number | null {
  const calls = contracts.filter((c) => c.optionType === "call");
  const enriched = calls
    .map((c) => ({ c, ...enrichContract(c, spot) }))
    .filter((e) => e.iv != null && e.dte >= 7);

  // prefer expiry closest to 30 DTE, strike closest to spot
  enriched.sort((a, b) => {
    const da = Math.abs(a.dte - 30) * 2 + Math.abs(a.c.strike - spot) / spot;
    const db = Math.abs(b.dte - 30) * 2 + Math.abs(b.c.strike - spot) / spot;
    return da - db;
  });
  return enriched[0]?.iv ?? null;
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Scan a call chain for covered-call candidates that reduce the cost basis
 * of a long stock position. Returns ranked candidates (best first).
 */
export function scanCoveredCalls(params: {
  symbol: string;
  spot: number;
  basis: number; // per-share cost basis
  shares: number; // long shares
  contracts: ChainContract[];
  now?: Date;
}): CoveredCallCandidate[] {
  const { symbol, spot, basis, shares } = params;
  const coveredContracts = Math.floor(shares / 100);
  if (coveredContracts < 1 || basis <= 0 || spot <= 0) return [];

  const out: CoveredCallCandidate[] = [];

  for (const c of params.contracts) {
    if (c.optionType !== "call") continue;
    if (c.bid == null || c.bid <= 0.01) continue;
    const { dte, mid, iv, delta } = enrichContract(c, spot);

    if (dte < 10 || dte > 60) continue;
    if (c.strike < spot * 0.97) continue; // avoid deep ITM — too likely to be called
    if (iv == null || delta == null) continue;
    if (delta < 0.08 || delta > 0.45) continue; // sweet-spot universe

    const premium = c.bid;
    const yieldPct = premium / basis;
    const annualizedYieldPct = yieldPct * (365 / dte);
    const spreadPct = c.ask != null && mid ? (c.ask - c.bid) / mid : 0.5;

    // ---- mechanic score (0–10) -------------------------------------------
    let score = 10;
    const rationale: string[] = [];

    if (delta >= 0.15 && delta <= 0.3) {
      rationale.push(`Delta ${delta.toFixed(2)} sits in the 0.15–0.30 income sweet spot`);
    } else {
      const pen = delta < 0.15 ? (0.15 - delta) * 20 : (delta - 0.3) * 18;
      score -= Math.min(3.5, pen);
      rationale.push(
        delta < 0.15
          ? `Low delta (${delta.toFixed(2)}) — safe but thin premium`
          : `High delta (${delta.toFixed(2)}) — elevated assignment risk`,
      );
    }

    if (dte >= 21 && dte <= 45) {
      rationale.push(`${dte} DTE is in the optimal theta-decay window (21–45)`);
    } else {
      score -= 1;
      rationale.push(`${dte} DTE is outside the ideal 21–45 day window`);
    }

    if (spreadPct > 0.25) {
      score -= 1.5;
      rationale.push(`Wide bid/ask spread (${(spreadPct * 100).toFixed(0)}% of mid)`);
    } else {
      rationale.push("Tight, tradeable bid/ask spread");
    }

    if (annualizedYieldPct < 0.03) {
      score -= 2;
      rationale.push("Annualized yield below 3% — marginal income");
    } else if (annualizedYieldPct > 0.25) {
      score -= 0.5;
      rationale.push("Very high yield signals elevated underlying volatility");
    } else {
      rationale.push(`Annualized yield of ${(annualizedYieldPct * 100).toFixed(1)}% on basis`);
    }

    if (c.strike < basis) {
      score -= 2;
      rationale.push(
        `Strike ${c.strike} is below your ${basis.toFixed(2)} basis — assignment would lock in a loss`,
      );
    }

    score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));

    out.push({
      symbol,
      spot,
      basis,
      shares,
      contracts: coveredContracts,
      strike: c.strike,
      expiry: c.expiry,
      dte,
      bid: c.bid,
      ask: c.ask ?? c.bid,
      mid: mid ?? c.bid,
      premium,
      premiumTotal: +(premium * 100 * coveredContracts).toFixed(2),
      iv,
      delta,
      assignmentProb: delta,
      yieldPct,
      annualizedYieldPct,
      newBasis: +(basis - premium).toFixed(2),
      breakeven: +(basis - premium).toFixed(2),
      target50: +(premium * 0.5).toFixed(2),
      manageBy: formatDate(
        new Date(new Date(c.expiry + "T00:00:00Z").getTime() - Math.ceil(dte * 0.33) * DAY_MS),
      ),
      score,
      rationale,
    });
  }

  out.sort((a, b) => b.score - a.score || b.annualizedYieldPct - a.annualizedYieldPct);
  return out.slice(0, 6);
}

/**
 * Expected-move / outlier-risk report for a single underlying, modelled on
 * the "Extreme Risk Detection" panel: ±1σ/±2σ over ~22 calendar days.
 */
export function buildRiskReport(params: {
  symbol: string;
  spot: number;
  iv30: number | null;
  basis: number | null;
  marketValue: number;
  portfolioValue: number;
  hasShortOptions: boolean;
  dte?: number;
}): RiskReport {
  const { symbol, spot, iv30, basis, marketValue, portfolioValue, hasShortOptions } = params;
  const dte = params.dte ?? 22;
  const notes: string[] = [];

  const weight = portfolioValue > 0 ? marketValue / portfolioValue : 0;

  let em1: number | null = null;
  let em2: number | null = null;
  let lower1: number | null = null;
  let upper1: number | null = null;
  let lower2: number | null = null;
  let upper2: number | null = null;
  let pBelow: number | null = null;

  if (iv30 != null && iv30 > 0) {
    em1 = spot * iv30 * Math.sqrt(dte / 365);
    em2 = em1 * 2;
    lower1 = spot - em1;
    upper1 = spot + em1;
    lower2 = spot - em2;
    upper2 = spot + em2;
    if (basis != null && basis > 0) {
      pBelow = probBelow(spot, basis, iv30, dte);
    }
    notes.push(
      `±1σ expected move over ${dte} days is $${em1.toFixed(2)} (${((em1 / spot) * 100).toFixed(1)}%) from a 30-day IV of ${(iv30 * 100).toFixed(1)}%`,
    );
  } else {
    notes.push("No option chain available — expected move cannot be derived from IV");
  }

  // ---- risk score (0–10, higher = riskier) -------------------------------
  let score = 2;
  if (iv30 != null) {
    if (iv30 < 0.2) score += 0.5;
    else if (iv30 < 0.35) score += 1;
    else if (iv30 < 0.5) score += 2.5;
    else if (iv30 < 0.75) score += 4;
    else score += 5.5;
  } else {
    score += 1.5;
  }

  if (weight > 0.4) {
    score += 3;
    notes.push(`Concentrated position: ${(weight * 100).toFixed(0)}% of portfolio value`);
  } else if (weight > 0.25) {
    score += 2;
    notes.push(`Meaningful weight: ${(weight * 100).toFixed(0)}% of portfolio value`);
  } else if (weight > 0.1) {
    score += 1;
  }

  if (hasShortOptions) {
    score += 1.5;
    notes.push("Open short-option exposure increases tail risk");
  }

  if (pBelow != null && pBelow > 0.35) {
    score += 1;
    notes.push(`${(pBelow * 100).toFixed(0)}% modelled probability of trading below your cost basis within ${dte} days`);
  }

  score = Math.max(0, Math.min(10, Math.round(score * 10) / 10));
  const riskLabel: RiskReport["riskLabel"] =
    score < 4 ? "Low" : score < 6 ? "Moderate" : score < 8 ? "Elevated" : "High";

  return {
    symbol,
    spot,
    iv30,
    ivSource: iv30 != null ? "chain" : "unavailable",
    dte,
    expectedMove1Sigma: em1 != null ? +em1.toFixed(2) : null,
    expectedMove2Sigma: em2 != null ? +em2.toFixed(2) : null,
    lower1: lower1 != null ? +lower1.toFixed(2) : null,
    upper1: upper1 != null ? +upper1.toFixed(2) : null,
    lower2: lower2 != null ? +lower2.toFixed(2) : null,
    upper2: upper2 != null ? +upper2.toFixed(2) : null,
    probBelowBasis: pBelow != null ? +pBelow.toFixed(3) : null,
    portfolioWeight: +weight.toFixed(4),
    riskScore: score,
    riskLabel,
    notes,
  };
}

/**
 * Black-Scholes helpers: option pricing, implied-volatility solver, greeks.
 * Used to derive IV/delta from raw bid/ask quotes when the data provider
 * does not supply greeks directly.
 */

const SQRT_2PI = Math.sqrt(2 * Math.PI);

export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / SQRT_2PI;
}

/** Abramowitz–Stegun approximation of the standard normal CDF. */
export function normCdf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  // erf approximation
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}

export interface BSInput {
  spot: number;
  strike: number;
  yearsToExpiry: number;
  rate?: number; // risk-free, default 4.5%
  vol: number; // annualized, e.g. 0.32
}

export function bsCallPrice({
  spot,
  strike,
  yearsToExpiry,
  rate = 0.045,
  vol,
}: BSInput): number {
  if (yearsToExpiry <= 0 || vol <= 0) {
    return Math.max(0, spot - strike * Math.exp(-rate * yearsToExpiry));
  }
  const sqrtT = Math.sqrt(yearsToExpiry);
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * yearsToExpiry) /
    (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  return (
    spot * normCdf(d1) - strike * Math.exp(-rate * yearsToExpiry) * normCdf(d2)
  );
}

export function bsCallDelta({
  spot,
  strike,
  yearsToExpiry,
  rate = 0.045,
  vol,
}: BSInput): number {
  if (yearsToExpiry <= 0 || vol <= 0) return spot > strike ? 1 : 0;
  const sqrtT = Math.sqrt(yearsToExpiry);
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * yearsToExpiry) /
    (vol * sqrtT);
  return normCdf(d1);
}

export function bsPutDelta({
  spot,
  strike,
  yearsToExpiry,
  rate = 0.045,
  vol,
}: BSInput): number {
  if (yearsToExpiry <= 0 || vol <= 0) return spot < strike ? -1 : 0;
  const sqrtT = Math.sqrt(yearsToExpiry);
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * yearsToExpiry) /
    (vol * sqrtT);
  return normCdf(d1) - 1;
}

export function bsPutPrice({
  spot,
  strike,
  yearsToExpiry,
  rate = 0.045,
  vol,
}: BSInput): number {
  if (yearsToExpiry <= 0 || vol <= 0) {
    return Math.max(0, strike * Math.exp(-rate * yearsToExpiry) - spot);
  }
  const sqrtT = Math.sqrt(yearsToExpiry);
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * yearsToExpiry) /
    (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  return (
    strike * Math.exp(-rate * yearsToExpiry) * normCdf(-d2) - spot * normCdf(-d1)
  );
}

export function bsGamma({
  spot,
  strike,
  yearsToExpiry,
  rate = 0.045,
  vol,
}: BSInput): number {
  if (yearsToExpiry <= 0 || vol <= 0 || spot <= 0) return 0;
  const sqrtT = Math.sqrt(yearsToExpiry);
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * yearsToExpiry) /
    (vol * sqrtT);
  return normPdf(d1) / (spot * vol * sqrtT);
}

export function bsVega({
  spot,
  strike,
  yearsToExpiry,
  rate = 0.045,
  vol,
}: BSInput): number {
  if (yearsToExpiry <= 0 || vol <= 0 || spot <= 0) return 0;
  const sqrtT = Math.sqrt(yearsToExpiry);
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * yearsToExpiry) /
    (vol * sqrtT);
  return (spot * sqrtT * normPdf(d1)) / 100; // per 1% change in vol
}

export function bsTheta({
  spot,
  strike,
  yearsToExpiry,
  rate = 0.045,
  vol,
  type = "call",
}: BSInput & { type?: "call" | "put" }): number {
  if (yearsToExpiry <= 0 || vol <= 0 || spot <= 0) return 0;
  const sqrtT = Math.sqrt(yearsToExpiry);
  const d1 =
    (Math.log(spot / strike) + (rate + 0.5 * vol * vol) * yearsToExpiry) /
    (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const term1 = -(spot * normPdf(d1) * vol) / (2 * sqrtT);

  if (type === "call") {
    const term2 = -rate * strike * Math.exp(-rate * yearsToExpiry) * normCdf(d2);
    return (term1 + term2) / 365; // per calendar day
  } else {
    const term2 = rate * strike * Math.exp(-rate * yearsToExpiry) * normCdf(-d2);
    return (term1 + term2) / 365; // per calendar day
  }
}

/**
 * Solve for implied volatility of a call from its price using bisection.
 * Returns null when no solution exists in (0.001, 5).
 */
export function impliedVolCall(
  price: number,
  spot: number,
  strike: number,
  yearsToExpiry: number,
  rate = 0.045,
): number | null {
  if (price <= 0 || spot <= 0 || yearsToExpiry <= 0) return null;
  const intrinsic = Math.max(0, spot - strike * Math.exp(-rate * yearsToExpiry));
  if (price < intrinsic - 1e-6) return null;

  let lo = 0.001;
  let hi = 5;
  const priceAt = (v: number) =>
    bsCallPrice({ spot, strike, yearsToExpiry, rate, vol: v });
  if (priceAt(hi) < price) return null;

  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const p = priceAt(mid);
    if (Math.abs(p - price) < 1e-5) return mid;
    if (p < price) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Probability (under lognormal dynamics) that spot ends below `target` after `days`. */
export function probBelow(
  spot: number,
  target: number,
  vol: number,
  days: number,
  rate = 0.045,
): number {
  if (spot <= 0 || target <= 0 || vol <= 0 || days <= 0) return 0;
  const t = days / 365;
  const z =
    (Math.log(target / spot) - (rate - 0.5 * vol * vol) * t) /
    (vol * Math.sqrt(t));
  return normCdf(z);
}

import { bsCallDelta, bsCallPrice } from "../analytics/blackScholes";

/**
 * Deterministic synthetic market data used when no live market-data source
 * is configured (SnapTrade credentials absent) or when explicitly requested
 * via "Load demo portfolio". Everything is derived from a seeded PRNG so a
 * symbol always returns the same prices within a session.
 */

export interface DemoChainContract {
  strike: number;
  expiry: string; // YYYY-MM-DD
  optionType: "call" | "put";
  bid: number;
  ask: number;
  last: number;
  openInterest: number;
  iv: number;
  delta: number;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Well-known tickers get realistic-ish anchors; everything else is derived. */
const ANCHORS: Record<string, number> = {
  AAPL: 232, MSFT: 505, NVDA: 178, AMZN: 228, GOOGL: 196, META: 740,
  TSLA: 340, NFLX: 1210, AMD: 162, PLTR: 156, SPY: 645, QQQ: 575,
  AVGO: 290, COST: 940, JPM: 295,
};

export function demoSpot(symbol: string): number {
  const sym = symbol.toUpperCase();
  if (ANCHORS[sym]) {
    const rnd = mulberry32(hashString(sym + ":px"));
    return +(ANCHORS[sym] * (0.97 + rnd() * 0.06)).toFixed(2);
  }
  const rnd = mulberry32(hashString(sym + ":px"));
  return +(15 + rnd() * 385).toFixed(2);
}

/** Base annualized IV for the symbol (25%–62%). */
export function demoIv(symbol: string): number {
  const rnd = mulberry32(hashString(symbol.toUpperCase() + ":iv"));
  return +(0.25 + rnd() * 0.37).toFixed(3);
}

function roundStrike(x: number): number {
  if (x < 25) return Math.round(x * 2) / 2;
  if (x < 200) return Math.round(x / 2.5) * 2.5;
  return Math.round(x / 5) * 5;
}

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function demoChain(symbol: string, spot?: number): {
  spot: number;
  contracts: DemoChainContract[];
} {
  const S = spot ?? demoSpot(symbol);
  const baseIv = demoIv(symbol);
  const rnd = mulberry32(hashString(symbol.toUpperCase() + ":chain"));
  const contracts: DemoChainContract[] = [];
  const now = new Date();

  // ~8 weekly expiries out to 63 days
  for (let dte = 7; dte <= 63; dte += 7) {
    const expiry = new Date(now.getTime() + dte * 86400000);
    const T = dte / 365;
    for (let m = 0.8; m <= 1.2001; m += 0.04) {
      const K = roundStrike(S * m);
      if (K <= 0) continue;
      // vol smile: downside skew + slight term decay
      const iv = Math.min(
        1.2,
        Math.max(0.08, baseIv * (1 + 0.9 * Math.max(0, 1 - m)) * (1 + 0.15 * Math.sqrt(30 / dte))),
      );
      const theo = bsCallPrice({ spot: S, strike: K, yearsToExpiry: T, vol: iv });
      const spreadPct = 0.04 + 0.1 * Math.abs(1 - m) + rnd() * 0.03;
      const bid = Math.max(0.01, +(theo * (1 - spreadPct / 2)).toFixed(2));
      const ask = +(theo * (1 + spreadPct / 2)).toFixed(2);
      const last = +((bid + ask) / 2).toFixed(2);
      contracts.push({
        strike: K,
        expiry: toDateStr(expiry),
        optionType: "call",
        bid,
        ask: Math.max(ask, bid + 0.01),
        last,
        openInterest: Math.floor(500 + rnd() * 9000 * (1.3 - Math.abs(1 - m))),
        iv: +iv.toFixed(4),
        delta: +bsCallDelta({ spot: S, strike: K, yearsToExpiry: T, vol: iv }).toFixed(4),
      });
    }
  }
  return { spot: S, contracts };
}

/** Demo portfolio mirroring the style of the reference screenshots. */
export const DEMO_POSITIONS: Array<{
  symbol: string;
  description: string;
  quantity: number;
  costBasis: number;
}> = [
  { symbol: "NFLX", description: "Netflix Inc.", quantity: 200, costBasis: 1085.4 },
  { symbol: "AAPL", description: "Apple Inc.", quantity: 150, costBasis: 214.8 },
  { symbol: "NVDA", description: "NVIDIA Corp.", quantity: 300, costBasis: 152.75 },
  { symbol: "TSLA", description: "Tesla Inc.", quantity: 100, costBasis: 318.2 },
  { symbol: "PLTR", description: "Palantir Technologies", quantity: 500, costBasis: 121.6 },
];

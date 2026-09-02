import {
  bsCallDelta,
  bsCallPrice,
  bsPutDelta,
  bsPutPrice,
} from "../analytics/blackScholes";

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
export const ANCHORS: Record<string, number> = {
  AAPL: 232, MSFT: 505, NVDA: 178, AMZN: 228, GOOGL: 196, META: 740,
  TSLA: 340, NFLX: 1210, AMD: 162, PLTR: 156, SPY: 645, QQQ: 575,
  AVGO: 290, COST: 940, JPM: 295,
};

export const DEMO_SPOTS: Record<string, number> = ANCHORS;

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
    const expiryStr = toDateStr(expiry);
    const T = dte / 365;
    for (let m = 0.8; m <= 1.2001; m += 0.04) {
      const K = roundStrike(S * m);
      if (K <= 0) continue;
      // vol smile: downside skew + slight term decay
      const iv = Math.min(
        1.2,
        Math.max(0.08, baseIv * (1 + 0.9 * Math.max(0, 1 - m)) * (1 + 0.15 * Math.sqrt(30 / dte))),
      );

      // Call Contract
      const callTheo = bsCallPrice({ spot: S, strike: K, yearsToExpiry: T, vol: iv });
      const spreadPct = 0.04 + 0.1 * Math.abs(1 - m) + rnd() * 0.03;
      const callBid = Math.max(0.01, +(callTheo * (1 - spreadPct / 2)).toFixed(2));
      const callAsk = +(callTheo * (1 + spreadPct / 2)).toFixed(2);
      const callLast = +((callBid + callAsk) / 2).toFixed(2);
      contracts.push({
        strike: K,
        expiry: expiryStr,
        optionType: "call",
        bid: callBid,
        ask: Math.max(callAsk, callBid + 0.01),
        last: callLast,
        openInterest: Math.floor(500 + rnd() * 9000 * (1.3 - Math.abs(1 - m))),
        iv: +iv.toFixed(4),
        delta: +bsCallDelta({ spot: S, strike: K, yearsToExpiry: T, vol: iv }).toFixed(4),
      });

      // Put Contract
      const putTheo = bsPutPrice({ spot: S, strike: K, yearsToExpiry: T, vol: iv });
      const putBid = Math.max(0.01, +(putTheo * (1 - spreadPct / 2)).toFixed(2));
      const putAsk = +(putTheo * (1 + spreadPct / 2)).toFixed(2);
      const putLast = +((putBid + putAsk) / 2).toFixed(2);
      contracts.push({
        strike: K,
        expiry: expiryStr,
        optionType: "put",
        bid: putBid,
        ask: Math.max(putAsk, putBid + 0.01),
        last: putLast,
        openInterest: Math.floor(500 + rnd() * 9000 * (1.3 - Math.abs(1 - m))),
        iv: +iv.toFixed(4),
        delta: +bsPutDelta({ spot: S, strike: K, yearsToExpiry: T, vol: iv }).toFixed(4),
      });
    }
  }
  return { spot: S, contracts };
}

export interface DemoPositionItem {
  symbol: string;
  description: string;
  quantity: number;
  costBasis: number;
  price?: number;
  assetType?: "stock" | "option" | "etf" | "other";
  optionType?: "call" | "put" | null;
  strike?: number | null;
  expiry?: string | null;
  rawSymbol?: string | null;
}

function makeOcc(sym: string, expiry: string, type: "C" | "P", strike: number): string {
  const [y, m, d] = expiry.split("-");
  const yr = y.slice(2);
  const strikeStr = Math.round(strike * 1000).toString().padStart(8, "0");
  return `${sym.toUpperCase().padEnd(6, " ")}${yr}${m}${d}${type}${strikeStr}`;
}

export function getFreshDemoPositions(): DemoPositionItem[] {
  const now = Date.now();
  const getExpiry = (dte: number) => {
    const d = new Date(now + dte * 86400000);
    return d.toISOString().slice(0, 10);
  };

  const aaplExp42 = getExpiry(42);
  const nvdaExp35 = getExpiry(35);
  const tslaExp28 = getExpiry(28);
  const nflxExp17 = getExpiry(17);
  const spyExp45 = getExpiry(45);
  const pltrExp60 = getExpiry(60);

  return [
    // ── Core Equity & ETF Holdings ──
    {
      symbol: "NFLX",
      description: "Netflix Inc.",
      quantity: 200,
      costBasis: 1085.4,
      assetType: "stock",
    },
    {
      symbol: "AAPL",
      description: "Apple Inc.",
      quantity: 150,
      costBasis: 214.8,
      assetType: "stock",
    },
    {
      symbol: "NVDA",
      description: "NVIDIA Corp.",
      quantity: 300,
      costBasis: 152.75,
      assetType: "stock",
    },
    {
      symbol: "TSLA",
      description: "Tesla Inc.",
      quantity: 100,
      costBasis: 318.2,
      assetType: "stock",
    },
    {
      symbol: "PLTR",
      description: "Palantir Technologies",
      quantity: 500,
      costBasis: 121.6,
      assetType: "stock",
    },
    {
      symbol: "SPY",
      description: "SPDR S&P 500 ETF Trust",
      quantity: 100,
      costBasis: 625.0,
      assetType: "etf",
    },

    // ── Options Holdings (Short Covered Calls, Short Puts, Long Options) ──
    // 1) AAPL 42 DTE Short Covered Call (harvesting theta against long stock)
    {
      symbol: "AAPL",
      description: `AAPL ${aaplExp42} 245.00 Call`,
      quantity: -1,
      costBasis: 4.80,
      price: 3.10,
      assetType: "option",
      optionType: "call",
      strike: 245,
      expiry: aaplExp42,
      rawSymbol: makeOcc("AAPL", aaplExp42, "C", 245),
    },
    // 2) NVDA 35 DTE Short Covered Call (2 contracts sold against 300 long shares)
    {
      symbol: "NVDA",
      description: `NVDA ${nvdaExp35} 190.00 Call`,
      quantity: -2,
      costBasis: 5.60,
      price: 2.85,
      assetType: "option",
      optionType: "call",
      strike: 190,
      expiry: nvdaExp35,
      rawSymbol: makeOcc("NVDA", nvdaExp35, "C", 190),
    },
    // 3) TSLA 28 DTE Cash-Secured Put (income harvest on pullbacks)
    {
      symbol: "TSLA",
      description: `TSLA ${tslaExp28} 310.00 Put`,
      quantity: -1,
      costBasis: 8.40,
      price: 4.20,
      assetType: "option",
      optionType: "put",
      strike: 310,
      expiry: tslaExp28,
      rawSymbol: makeOcc("TSLA", tslaExp28, "P", 310),
    },
    // 4) NFLX 17 DTE Short Call (<=21 DTE management trigger & +60% profit take)
    {
      symbol: "NFLX",
      description: `NFLX ${nflxExp17} 1260.00 Call`,
      quantity: -1,
      costBasis: 32.50,
      price: 12.80,
      assetType: "option",
      optionType: "call",
      strike: 1260,
      expiry: nflxExp17,
      rawSymbol: makeOcc("NFLX", nflxExp17, "C", 1260),
    },
    // 5) SPY 45 DTE Short Put (broad market index theta collection)
    {
      symbol: "SPY",
      description: `SPY ${spyExp45} 630.00 Put`,
      quantity: -1,
      costBasis: 5.80,
      price: 3.90,
      assetType: "option",
      optionType: "put",
      strike: 630,
      expiry: spyExp45,
      rawSymbol: makeOcc("SPY", spyExp45, "P", 630),
    },
    // 6) PLTR 60 DTE Long Call (directional growth upside)
    {
      symbol: "PLTR",
      description: `PLTR ${pltrExp60} 165.00 Call`,
      quantity: 2,
      costBasis: 8.20,
      price: 10.40,
      assetType: "option",
      optionType: "call",
      strike: 165,
      expiry: pltrExp60,
      rawSymbol: makeOcc("PLTR", pltrExp60, "C", 165),
    },
  ];
}

/** Demo portfolio mirroring realistic blended stock and options holdings. */
export const DEMO_POSITIONS: DemoPositionItem[] = getFreshDemoPositions();


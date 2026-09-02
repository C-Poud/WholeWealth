import type { ChainContract } from "./engine";

/**
 * Yahoo Finance market data (unofficial public endpoints).
 * Real quotes + option chains without any brokerage connection.
 * Quotes are ~15 min delayed; no greeks — the engine derives delta
 * from implied volatility via Black-Scholes.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const Q1 = "https://query1.finance.yahoo.com";
const Q2 = "https://query2.finance.yahoo.com";

// The options endpoint requires a cookie + crumb pair; cache it ~25 min.
let session: { cookie: string; crumb: string; expiresAt: number } | null = null;

// ---- In-Memory Caches & In-Flight Request Deduplication --------------------
const symbolInfoCache = new Map<string, { data: YahooSymbolInfo | "not_found" | null; expiresAt: number }>();
const watchlistQuoteCache = new Map<string, { data: WatchlistQuote; expiresAt: number }>();
const chainCache = new Map<string, { data: ChainContract[]; expiresAt: number }>();
const summaryDetailsCache = new Map<string, { data: { beta?: number; fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number }; expiresAt: number }>();
const inFlightRequests = new Map<string, Promise<any>>();

function deduplicate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing;
  const promise = fetcher().finally(() => {
    inFlightRequests.delete(key);
  });
  inFlightRequests.set(key, promise);
  return promise;
}

async function getSession() {
  if (session && session.expiresAt > Date.now()) return session;

  const cookieResp = await fetch("https://fc.yahoo.com", {
    headers: { "User-Agent": UA },
    redirect: "manual",
  });
  const setCookies =
    typeof cookieResp.headers.getSetCookie === "function"
      ? cookieResp.headers.getSetCookie()
      : [cookieResp.headers.get("set-cookie") ?? ""];
  const cookie = setCookies
    .filter(Boolean)
    .map((c) => c.split(";")[0])
    .join("; ");

  const crumbResp = await fetch(`${Q1}/v1/test/getcrumb`, {
    headers: { "User-Agent": UA, cookie },
  });
  if (!crumbResp.ok) {
    throw new Error(`Yahoo crumb request failed (${crumbResp.status})`);
  }
  const crumb = (await crumbResp.text()).trim();
  if (!crumb || crumb.includes("{")) {
    throw new Error("Yahoo returned an invalid crumb");
  }

  session = { cookie, crumb, expiresAt: Date.now() + 25 * 60_000 };
  return session;
}

/** Fetch with an 8s timeout so a hung Yahoo connection never stalls a page. */
async function fetchWithTimeout(url: string, cookie?: string): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    return await fetch(url, {
      headers: { "User-Agent": UA, ...(cookie ? { cookie } : {}) },
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url: string, cookie?: string): Promise<any> {
  const resp = await fetchWithTimeout(url, cookie);
  if (!resp.ok) throw new Error(`Yahoo request failed (${resp.status})`);
  return resp.json();
}

export interface YahooSymbolInfo {
  name: string | null;
  price: number | null;
  currency: string | null;
  instrumentType: string | null; // EQUITY, ETF, INDEX, ...
  previousClose?: number | null;
  change?: number | null;
  changePct?: number | null;
}

/**
 * Name + last price + type for a symbol, from the v8 chart meta.
 * Returns the info object on success, "not_found" when Yahoo definitively
 * doesn't know the ticker, and null on transient failures (rate limit,
 * network) — callers should treat null as "unknown", not "invalid".
 */
export async function getYahooSymbolInfo(
  symbol: string,
): Promise<YahooSymbolInfo | "not_found" | null> {
  const symKey = symbol.toUpperCase().trim();
  const cached = symbolInfoCache.get(symKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  return deduplicate(`info_${symKey}`, async () => {
    try {
      const resp = await fetchWithTimeout(
        `${Q1}/v8/finance/chart/${encodeURIComponent(symKey)}?range=1d&interval=1d`,
      );
      if (resp.status === 404 || resp.status === 422) {
        symbolInfoCache.set(symKey, { data: "not_found", expiresAt: Date.now() + 5 * 60_000 });
        return "not_found";
      }
      if (!resp.ok) return null;
      const j: any = await resp.json();
      if (j?.chart?.error) {
        const code = String(j.chart.error.code ?? "");
        const res = /not found|no data|invalid/i.test(code) ? ("not_found" as const) : null;
        if (res === "not_found") {
          symbolInfoCache.set(symKey, { data: "not_found", expiresAt: Date.now() + 5 * 60_000 });
        }
        return res;
      }
      const meta = j?.chart?.result?.[0]?.meta;
      if (!meta) {
        symbolInfoCache.set(symKey, { data: "not_found", expiresAt: Date.now() + 5 * 60_000 });
        return "not_found";
      }
      const px = meta.regularMarketPrice;
      const prevClose =
        (typeof meta.regularMarketPreviousClose === "number" && meta.regularMarketPreviousClose > 0
          ? meta.regularMarketPreviousClose
          : null) ??
        (typeof meta.chartPreviousClose === "number" && meta.chartPreviousClose > 0
          ? meta.chartPreviousClose
          : null) ??
        (typeof meta.previousClose === "number" && meta.previousClose > 0
          ? meta.previousClose
          : null) ??
        null;

      const change =
        typeof px === "number" && typeof prevClose === "number"
          ? +(px - prevClose).toFixed(2)
          : null;
      const changePct =
        typeof change === "number" && typeof prevClose === "number" && prevClose > 0
          ? +((change / prevClose) * 100).toFixed(2)
          : null;

      const info: YahooSymbolInfo = {
        name: meta.longName ?? meta.shortName ?? null,
        price: typeof px === "number" && px > 0 ? px : null,
        currency: meta.currency ?? null,
        instrumentType: meta.instrumentType ?? null,
        previousClose: prevClose ? +prevClose.toFixed(2) : null,
        change,
        changePct,
      };

      symbolInfoCache.set(symKey, { data: info, expiresAt: Date.now() + 2 * 60_000 });
      return info;
    } catch {
      return null;
    }
  });
}

/** Spot prices for a set of symbols (per-symbol, best effort). */
export async function getYahooSpots(
  symbols: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const j = await fetchJson(
          `${Q1}/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`,
        );
        const px = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
        if (typeof px === "number" && px > 0) out[sym.toUpperCase()] = px;
      } catch {
        /* per-symbol best effort */
      }
    }),
  );
  return out;
}

export interface WatchlistQuote {
  symbol: string;
  name: string | null;
  price: number;
  change: number;
  changePct: number;
  ytdChangePct: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  beta: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekPos: number | null; // 0–100 % in 52w range
  ivRank: number | null; // 0–100 % Tastylive IV Rank: ((Current IV - 52W Low IV) / (52W High IV - 52W Low IV)) * 100
  ivPercentile: number | null; // 0–100 % Tastylive IV Percentile: % of days IV was below current IV
  iv30: number | null; // Current annualized 30-day volatility
  iv52wHigh: number | null; // 52-week High IV
  iv52wLow: number | null; // 52-week Low IV
}

let cachedAudUsd: { rate: number; expiresAt: number } | null = null;

/**
 * Live AUD/USD exchange rate from Yahoo Finance (AUDUSD=X).
 * Cached for 15 minutes, with fallback to 0.65 if unreachable.
 */
export async function getAudToUsdRate(): Promise<number> {
  if (cachedAudUsd && cachedAudUsd.expiresAt > Date.now()) {
    return cachedAudUsd.rate;
  }
  try {
    const resp = await fetchWithTimeout(
      `${Q1}/v8/finance/chart/AUDUSD=X?range=1d&interval=1d`,
    );
    if (resp.ok) {
      const j: any = await resp.json();
      const px = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof px === "number" && px > 0) {
        cachedAudUsd = { rate: +px.toFixed(4), expiresAt: Date.now() + 15 * 60_000 };
        return cachedAudUsd.rate;
      }
    }
  } catch (err) {
    console.warn("[currency] Live AUDUSD fetch failed, using fallback 0.65:", err);
  }
  return 0.65;
}

/**
 * Calculates Tastytrade / Tastylive Implied Volatility Rank (IVR) and IV Percentile (IVP).
 * Reference: https://www.tastylive.com/concepts-strategies/implied-volatility-rank-percentile
 *
 * IV Rank = ((Current IV - 52-Week Low IV) / (52-Week High IV - 52-Week Low IV)) * 100
 * IV Percentile = (Number of Days with IV < Current IV) / (Total Trading Days) * 100
 */
export function calculateTastyIvMetrics(
  closePrices: number[],
): {
  ivRank: number | null;
  ivPercentile: number | null;
  iv30: number | null;
  iv52wHigh: number | null;
  iv52wLow: number | null;
} {
  const validCloses = closePrices.filter((c) => typeof c === "number" && isFinite(c) && c > 0);
  if (validCloses.length < 15) {
    return { ivRank: null, ivPercentile: null, iv30: null, iv52wHigh: null, iv52wLow: null };
  }

  // Calculate daily log returns: r_t = ln(P_t / P_{t-1})
  const logReturns: number[] = [];
  for (let i = 1; i < validCloses.length; i++) {
    logReturns.push(Math.log(validCloses[i] / validCloses[i - 1]));
  }

  // Rolling 30-day window (21-30 trading days) to calculate 30-day annualized volatility
  const windowSize = Math.min(30, Math.max(10, Math.floor(logReturns.length / 3)));
  const rollingVols: number[] = [];

  for (let i = windowSize; i <= logReturns.length; i++) {
    const window = logReturns.slice(i - windowSize, i);
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (window.length - 1);
    const annualizedVol = Math.sqrt(variance * 252);
    if (isFinite(annualizedVol) && annualizedVol > 0) {
      rollingVols.push(annualizedVol);
    }
  }

  if (rollingVols.length === 0) {
    return { ivRank: null, ivPercentile: null, iv30: null, iv52wHigh: null, iv52wLow: null };
  }

  const currentIv = rollingVols[rollingVols.length - 1];
  const iv52wHigh = Math.max(...rollingVols);
  const iv52wLow = Math.min(...rollingVols);

  // Exact Tastylive IV Rank formula
  let ivRank: number;
  if (iv52wHigh > iv52wLow) {
    ivRank = Math.min(100, Math.max(0, Math.round(((currentIv - iv52wLow) / (iv52wHigh - iv52wLow)) * 100)));
  } else {
    ivRank = 50;
  }

  // Exact Tastylive IV Percentile formula
  const daysBelow = rollingVols.filter((v) => v < currentIv).length;
  const ivPercentile = Math.min(100, Math.max(0, Math.round((daysBelow / rollingVols.length) * 100)));

  return {
    ivRank,
    ivPercentile,
    iv30: +currentIv.toFixed(3),
    iv52wHigh: +iv52wHigh.toFixed(3),
    iv52wLow: +iv52wLow.toFixed(3),
  };
}

/** Rich quotes + day change + beta + 52-week range + IV Rank for a watchlist. */
export async function getWatchlistQuotes(
  symbols: string[],
): Promise<Record<string, WatchlistQuote>> {
  const out: Record<string, WatchlistQuote> = {};
  if (symbols.length === 0) return out;

  const now = Date.now();
  const missingSymbols: string[] = [];

  for (const rawSym of symbols) {
    const sym = rawSym.toUpperCase().trim();
    const cached = watchlistQuoteCache.get(sym);
    if (cached && cached.expiresAt > now) {
      out[sym] = cached.data;
    } else {
      missingSymbols.push(sym);
    }
  }

  if (missingSymbols.length === 0) return out;

  // Run quotes and summary details concurrently for missing symbols
  const [details] = await Promise.all([
    getYahooSummaryDetails(missingSymbols).catch(() => ({})),
    Promise.all(
      missingSymbols.map(async (sym) => {
        return deduplicate(`quote_${sym}`, async () => {
          try {
            // Fetch 1 year of daily history to compute exact 52-week price range and Tastylive IV Rank / IV Percentile
            const j = await fetchJson(
              `${Q1}/v8/finance/chart/${encodeURIComponent(sym)}?range=1y&interval=1d`,
            );
            const meta = j?.chart?.result?.[0]?.meta;
            const px = meta?.regularMarketPrice;
            if (typeof px === "number" && px > 0) {
              const closePrices: (number | null)[] = j?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
              const timestamps: (number | null)[] = j?.chart?.result?.[0]?.timestamp ?? [];
              const validCloses = closePrices.filter((c): c is number => typeof c === "number" && isFinite(c) && c > 0);

              // Previous trading day's close price (NOT the 1-year ago chartPreviousClose)
              const prevClose =
                (typeof meta?.regularMarketPreviousClose === "number" && meta.regularMarketPreviousClose > 0
                  ? meta.regularMarketPreviousClose
                  : null) ??
                (typeof meta?.previousClose === "number" && meta.previousClose > 0
                  ? meta.previousClose
                  : null) ??
                (validCloses.length >= 2 ? validCloses[validCloses.length - 2] : px);

              const change = +(px - prevClose).toFixed(2);
              const changePct = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;

              // Calculate YTD change % from the first trading day of the current calendar year
              const currentYear = new Date().getFullYear();
              const startOfYearTs = new Date(currentYear, 0, 1).getTime() / 1000;
              let ytdStartClose: number | null = null;

              for (let i = 0; i < timestamps.length; i++) {
                const ts = timestamps[i];
                const c = closePrices[i];
                if (ts && ts >= startOfYearTs && typeof c === "number" && c > 0) {
                  ytdStartClose = c;
                  break;
                }
              }

              const ytdChangePct = ytdStartClose
                ? +(((px - ytdStartClose) / ytdStartClose) * 100).toFixed(2)
                : changePct;

              const high52 = meta?.fiftyTwoWeekHigh ? +meta.fiftyTwoWeekHigh.toFixed(2) : null;
              const low52 = meta?.fiftyTwoWeekLow ? +meta.fiftyTwoWeekLow.toFixed(2) : null;
              let pos52: number | null = null;
              if (high52 != null && low52 != null && high52 > low52) {
                pos52 = Math.min(100, Math.max(0, Math.round(((px - low52) / (high52 - low52)) * 100)));
              }

              // Compute Tastylive IV Rank & IV Percentile from 1-year historical daily return distribution
              const ivMetrics = calculateTastyIvMetrics(validCloses);

              const quoteObj: WatchlistQuote = {
                symbol: sym,
                name: meta.longName ?? meta.shortName ?? sym,
                price: +px.toFixed(2),
                change,
                changePct,
                ytdChangePct,
                previousClose: prevClose ? +prevClose.toFixed(2) : null,
                dayHigh: meta.regularMarketDayHigh ? +meta.regularMarketDayHigh.toFixed(2) : null,
                dayLow: meta.regularMarketDayLow ? +meta.regularMarketDayLow.toFixed(2) : null,
                volume: meta.regularMarketVolume ?? null,
                beta: 1.0,
                fiftyTwoWeekHigh: high52,
                fiftyTwoWeekLow: low52,
                fiftyTwoWeekPos: pos52,
                ivRank: ivMetrics.ivRank,
                ivPercentile: ivMetrics.ivPercentile,
                iv30: ivMetrics.iv30,
                iv52wHigh: ivMetrics.iv52wHigh,
                iv52wLow: ivMetrics.iv52wLow,
              };

              out[sym] = quoteObj;
              watchlistQuoteCache.set(sym, { data: quoteObj, expiresAt: Date.now() + 45_000 });
            }
          } catch {
            // fallback
          }
        });
      }),
    ),
  ]);

  for (const sym of missingSymbols) {
    const quote = out[sym];
    if (!quote) continue;
    const d = details[sym];
    if (d) {
      if (d.beta != null) quote.beta = +d.beta.toFixed(2);
      if (d.fiftyTwoWeekHigh != null && !quote.fiftyTwoWeekHigh) {
        quote.fiftyTwoWeekHigh = +d.fiftyTwoWeekHigh.toFixed(2);
      }
      if (d.fiftyTwoWeekLow != null && !quote.fiftyTwoWeekLow) {
        quote.fiftyTwoWeekLow = +d.fiftyTwoWeekLow.toFixed(2);
      }
      if (quote.fiftyTwoWeekHigh && quote.fiftyTwoWeekLow && quote.fiftyTwoWeekHigh > quote.fiftyTwoWeekLow) {
        quote.fiftyTwoWeekPos = Math.min(
          100,
          Math.max(0, Math.round(((quote.price - quote.fiftyTwoWeekLow) / (quote.fiftyTwoWeekHigh - quote.fiftyTwoWeekLow)) * 100)),
        );
      }
      watchlistQuoteCache.set(sym, { data: quote, expiresAt: Date.now() + 45_000 });
    }
  }

  return out;
}

/** Summary details (Beta, 52W High/Low) per symbol via quoteSummary. */
export async function getYahooSummaryDetails(
  symbols: string[],
): Promise<Record<string, { beta?: number; fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number }>> {
  const out: Record<string, { beta?: number; fiftyTwoWeekHigh?: number; fiftyTwoWeekLow?: number }> = {};
  if (symbols.length === 0) return out;

  const now = Date.now();
  const missing: string[] = [];

  for (const s of symbols) {
    const sym = s.toUpperCase().trim();
    const cached = summaryDetailsCache.get(sym);
    if (cached && cached.expiresAt > now) {
      out[sym] = cached.data;
    } else {
      missing.push(sym);
    }
  }

  if (missing.length === 0) return out;

  try {
    const s = await getSession();
    await Promise.all(
      missing.map(async (sym) => {
        return deduplicate(`summary_${sym}`, async () => {
          try {
            const j = await fetchJson(
              `${Q2}/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=summaryDetail&crumb=${encodeURIComponent(s.crumb)}`,
              s.cookie,
            );
            const detail = j?.quoteSummary?.result?.[0]?.summaryDetail;
            const beta = detail?.beta?.raw;
            const high52 = detail?.fiftyTwoWeekHigh?.raw;
            const low52 = detail?.fiftyTwoWeekLow?.raw;
            const val = {
              beta: typeof beta === "number" && isFinite(beta) && beta > 0 ? beta : undefined,
              fiftyTwoWeekHigh: typeof high52 === "number" && isFinite(high52) && high52 > 0 ? high52 : undefined,
              fiftyTwoWeekLow: typeof low52 === "number" && isFinite(low52) && low52 > 0 ? low52 : undefined,
            };
            out[sym] = val;
            summaryDetailsCache.set(sym, { data: val, expiresAt: Date.now() + 10 * 60_000 });
          } catch {
            /* per-symbol best effort */
          }
        });
      }),
    );
  } catch {
    /* fallback */
  }
  return out;
}

/** Beta (vs S&P 500) per symbol via quoteSummary — uses the crumb session. */
export async function getYahooBetas(
  symbols: string[],
): Promise<Record<string, number>> {
  const details = await getYahooSummaryDetails(symbols);
  const out: Record<string, number> = {};
  for (const [sym, d] of Object.entries(details)) {
    if (d.beta) out[sym] = d.beta;
  }
  return out;
}

type YahooOption = {
  strike?: number;
  bid?: number;
  ask?: number;
  lastPrice?: number;
  openInterest?: number;
  impliedVolatility?: number;
  expiration?: number;
};

type YahooOptionsPage = {
  expirationDate?: number;
  calls?: YahooOption[];
  puts?: YahooOption[];
};

function pushContracts(
  out: ChainContract[],
  page: YahooOptionsPage | null | undefined,
) {
  if (!page) return;
  const push = (list: YahooOption[] | undefined, type: "call" | "put") => {
    for (const c of list ?? []) {
      if (c.strike == null) continue;
      const expSec = c.expiration ?? page.expirationDate;
      if (!expSec) continue;
      out.push({
        strike: c.strike,
        expiry: new Date(expSec * 1000).toISOString().slice(0, 10),
        optionType: type,
        bid: c.bid ?? null,
        ask: c.ask ?? null,
        last: c.lastPrice ?? null,
        openInterest: c.openInterest ?? null,
        iv: c.impliedVolatility ?? null,
        delta: null, // engine derives it from IV via Black-Scholes
      });
    }
  };
  push(page.calls, "call");
  push(page.puts, "put");
}

/**
 * Full option chain for one symbol: the nearest expiry plus every
 * expiration within ~95 days (covers the 10–60 DTE suggestion window).
 */
export async function getYahooChain(symbol: string): Promise<ChainContract[]> {
  const symKey = symbol.toUpperCase().trim();
  const cached = chainCache.get(symKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  return deduplicate(`chain_${symKey}`, async () => {
    const s = await getSession();
    const sym = encodeURIComponent(symKey);
    const crumb = `crumb=${encodeURIComponent(s.crumb)}`;

    const base = await fetchJson(`${Q2}/v7/finance/options/${sym}?${crumb}`, s.cookie);
    const result = base?.optionChain?.result?.[0];
    if (!result) throw new Error(`No option chain for ${symbol}`);

    const contracts: ChainContract[] = [];
    const firstPage: YahooOptionsPage | undefined = result.options?.[0];
    pushContracts(contracts, firstPage);

    const nowSec = Date.now() / 1000;
    const expirations: number[] = result.expirationDates ?? [];
    const wanted = expirations
      .filter((e) => e > nowSec - 86_400 && e < nowSec + 95 * 86_400)
      .filter((e) => e !== firstPage?.expirationDate)
      .slice(0, 14);

    const pages = await Promise.all(
      wanted.map(async (e): Promise<YahooOptionsPage | null> => {
        try {
          const j = await fetchJson(
            `${Q2}/v7/finance/options/${sym}?date=${e}&${crumb}`,
            s.cookie,
          );
          return j?.optionChain?.result?.[0]?.options?.[0] ?? null;
        } catch {
          return null;
        }
      }),
    );
    for (const page of pages) pushContracts(contracts, page);

    if (contracts.length === 0) throw new Error(`Empty option chain for ${symbol}`);
    chainCache.set(symKey, { data: contracts, expiresAt: Date.now() + 60_000 });
    return contracts;
  });
}

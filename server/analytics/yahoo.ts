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
  try {
    const resp = await fetchWithTimeout(
      `${Q1}/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}?range=1d&interval=1d`,
    );
    if (resp.status === 404 || resp.status === 422) return "not_found";
    if (!resp.ok) return null;
    const j: any = await resp.json();
    if (j?.chart?.error) {
      const code = String(j.chart.error.code ?? "");
      return /not found|no data|invalid/i.test(code) ? "not_found" : null;
    }
    const meta = j?.chart?.result?.[0]?.meta;
    if (!meta) return "not_found";
    const px = meta.regularMarketPrice;
    return {
      name: meta.longName ?? meta.shortName ?? null,
      price: typeof px === "number" && px > 0 ? px : null,
      currency: meta.currency ?? null,
      instrumentType: meta.instrumentType ?? null,
    };
  } catch {
    return null;
  }
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
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  beta: number;
}

/** Rich quotes + day change + beta for a watchlist. */
export async function getWatchlistQuotes(
  symbols: string[],
): Promise<Record<string, WatchlistQuote>> {
  const out: Record<string, WatchlistQuote> = {};
  if (symbols.length === 0) return out;

  // Run quotes and betas concurrently
  const [betas] = await Promise.all([
    getYahooBetas(symbols).catch(() => ({})),
    Promise.all(
      symbols.map(async (rawSym) => {
        const sym = rawSym.toUpperCase();
        try {
          const j = await fetchJson(
            `${Q1}/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`,
          );
          const meta = j?.chart?.result?.[0]?.meta;
          const px = meta?.regularMarketPrice;
          if (typeof px === "number" && px > 0) {
            const prevClose = meta?.chartPreviousClose ?? meta?.previousClose ?? px;
            const change = +(px - prevClose).toFixed(2);
            const changePct = prevClose > 0 ? +((change / prevClose) * 100).toFixed(2) : 0;
            out[sym] = {
              symbol: sym,
              name: meta.longName ?? meta.shortName ?? sym,
              price: +px.toFixed(2),
              change,
              changePct,
              previousClose: prevClose ? +prevClose.toFixed(2) : null,
              dayHigh: meta.regularMarketDayHigh ? +meta.regularMarketDayHigh.toFixed(2) : null,
              dayLow: meta.regularMarketDayLow ? +meta.regularMarketDayLow.toFixed(2) : null,
              volume: meta.regularMarketVolume ?? null,
              beta: 1.0, // default, filled below
            };
          }
        } catch {
          // fallback
        }
      }),
    ),
  ]);

  for (const [sym, quote] of Object.entries(out)) {
    if (betas[sym]) {
      quote.beta = +betas[sym].toFixed(2);
    }
  }

  return out;
}

/** Beta (vs S&P 500) per symbol via quoteSummary — uses the crumb session. */
export async function getYahooBetas(
  symbols: string[],
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (symbols.length === 0) return out;
  const s = await getSession();
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const j = await fetchJson(
          `${Q2}/v10/finance/quoteSummary/${encodeURIComponent(sym)}?modules=summaryDetail&crumb=${encodeURIComponent(s.crumb)}`,
          s.cookie,
        );
        const beta =
          j?.quoteSummary?.result?.[0]?.summaryDetail?.beta?.raw;
        if (typeof beta === "number" && isFinite(beta) && beta > 0) {
          out[sym.toUpperCase()] = beta;
        }
      } catch {
        /* per-symbol best effort */
      }
    }),
  );
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
  const s = await getSession();
  const sym = encodeURIComponent(symbol.toUpperCase());
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
  return contracts;
}

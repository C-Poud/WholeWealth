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

async function fetchJson(url: string, cookie?: string): Promise<any> {
  const resp = await fetch(url, {
    headers: { "User-Agent": UA, ...(cookie ? { cookie } : {}) },
  });
  if (!resp.ok) throw new Error(`Yahoo request failed (${resp.status})`);
  return resp.json();
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

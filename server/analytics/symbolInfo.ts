import {
  getYahooQuotes,
  getYahooSymbolInfo,
  getYahooSpots,
  type YahooQuote,
  type YahooSymbolInfo,
} from "./yahoo";

/**
 * Symbol lookup with automatic fallback.
 *
 * Primary: Yahoo Finance (v8 chart meta) — rich data but rate-limits
 * datacenter IPs aggressively. Fallback: stockanalysis.com (no key,
 * permissive limits) — search endpoint for name/type + quote endpoint
 * for price.
 *
 * Returns the info object on success, "not_found" when the ticker
 * definitively doesn't exist, and null on transient failures.
 */

export type SymbolInfo = YahooSymbolInfo;

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
const SA = "https://stockanalysis.com";

async function fetchSa(url: string): Promise<any | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    try {
      const resp = await fetch(url, {
        headers: { "User-Agent": UA },
        signal: ctrl.signal,
      });
      if (!resp.ok) return null;
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

async function stockAnalysisInfo(
  symbol: string,
): Promise<SymbolInfo | "not_found" | null> {
  const sym = symbol.toUpperCase();

  // 1) Search → company name + instrument type (s = stock, e = ETF)
  const sj = await fetchSa(`${SA}/api/search?q=${encodeURIComponent(sym)}`);
  if (!sj) return null; // couldn't reach stockanalysis at all
  const hits: Array<{ id?: string; s?: string; t?: string; n?: string }> =
    sj?.data ?? [];
  const hit =
    hits.find((h) => h.id === sym && (h.t === "s" || h.t === "e")) ??
    hits.find((h) => h.t === "s" || h.t === "e");
  if (!hit) return "not_found";

  const isEtf = hit.t === "e";

  // 2) Quote → last price (optional — name alone is already useful)
  let price: number | null = null;
  const qj = await fetchSa(
    `${SA}/api/quotes/${isEtf ? "e" : "s"}/${encodeURIComponent(sym)}`,
  );
  const p = qj?.data?.p;
  if (typeof p === "number" && p > 0) price = p;

  return {
    name: hit.n ?? null,
    price,
    currency: "USD",
    instrumentType: isEtf ? "ETF" : "EQUITY",
  };
}

/** Yahoo first, stockanalysis.com when Yahoo rate-limits or is unreachable. */
export async function lookupSymbolInfo(
  symbol: string,
): Promise<SymbolInfo | "not_found" | null> {
  const yahoo = await getYahooSymbolInfo(symbol);
  if (yahoo !== null) return yahoo; // info object OR definitive "not_found"
  return stockAnalysisInfo(symbol);
}

/**
 * Spot prices for a set of symbols: Yahoo first, stockanalysis.com
 * per-symbol fallback for anything Yahoo didn't return (rate limit).
 */
export async function getSpotsWithFallback(
  symbols: string[],
): Promise<Record<string, number>> {
  const out = await getYahooSpots(symbols);
  const missing = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(
    (s) => !out[s],
  );
  await Promise.all(
    missing.map(async (sym) => {
      // Try stock quote first, then ETF quote.
      for (const kind of ["s", "e"] as const) {
        const qj = await fetchSa(`${SA}/api/quotes/${kind}/${encodeURIComponent(sym)}`);
        const p = qj?.data?.p;
        if (typeof p === "number" && p > 0) {
          out[sym] = p;
          return;
        }
      }
    }),
  );
  return out;
}

/**
 * Quotes (last price + previous close) with fallback: Yahoo first,
 * stockanalysis.com per-symbol for anything missing (price only there,
 * so prevClose stays null and day-change is simply not shown).
 */
export async function getQuotesWithFallback(
  symbols: string[],
): Promise<Record<string, YahooQuote>> {
  const out = await getYahooQuotes(symbols);
  const missing = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(
    (s) => !out[s],
  );
  await Promise.all(
    missing.map(async (sym) => {
      for (const kind of ["s", "e"] as const) {
        const qj = await fetchSa(
          `${SA}/api/quotes/${kind}/${encodeURIComponent(sym)}`,
        );
        const p = qj?.data?.p;
        if (typeof p === "number" && p > 0) {
          out[sym] = { price: p, prevClose: null };
          return;
        }
      }
    }),
  );
  return out;
}

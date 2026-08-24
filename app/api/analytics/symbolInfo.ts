import { fetchYahooJson, getYahooSession, getYahooSpots } from "./yahoo";

/**
 * Symbol lookup helpers built on Yahoo's batch quote endpoint.
 * The chart endpoint (see yahoo.ts) is crumb-free but occasionally
 * misses symbols; the quote endpoint needs the cookie + crumb session
 * and returns name, price, instrument type and currency in one call.
 */

const Q2 = "https://query2.finance.yahoo.com";

export type SymbolInfo = {
  /** Long (or short) display name, e.g. "Apple Inc.". */
  name: string | null;
  /** Latest regular-market price. */
  price: number;
  /** Yahoo quote type: "EQUITY", "ETF", "INDEX", "MUTUALFUND", ... */
  instrumentType: string | null;
  /** ISO currency code, e.g. "USD". */
  currency: string | null;
};

type YahooQuote = {
  symbol?: string;
  longName?: string;
  shortName?: string;
  regularMarketPrice?: number;
  quoteType?: string;
  currency?: string;
};

type QuoteResp = {
  quoteResponse?: { result?: YahooQuote[] };
};

/** Batch quote lookup; throws when Yahoo is unreachable/rate-limiting. */
async function fetchQuotes(symbols: string[]): Promise<YahooQuote[]> {
  if (symbols.length === 0) return [];
  const s = await getYahooSession();
  const list = symbols.map(sym => encodeURIComponent(sym)).join(",");
  const j = await fetchYahooJson<QuoteResp>(
    `${Q2}/v7/finance/quote?symbols=${list}&crumb=${encodeURIComponent(s.crumb)}`,
    s.cookie
  );
  return j?.quoteResponse?.result ?? [];
}

/**
 * Look up a symbol's name, latest price, instrument type and currency.
 * Returns "not_found" for unknown tickers, or null when Yahoo is
 * unreachable/rate-limiting (the caller may then proceed without info).
 */
export async function lookupSymbolInfo(
  symbol: string
): Promise<SymbolInfo | "not_found" | null> {
  try {
    const [quote] = await fetchQuotes([symbol.toUpperCase()]);
    if (!quote || typeof quote.regularMarketPrice !== "number") {
      return "not_found";
    }
    return {
      name: quote.longName ?? quote.shortName ?? null,
      price: quote.regularMarketPrice,
      instrumentType: quote.quoteType ?? null,
      currency: quote.currency ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Spot prices with fallback: try the fast, crumb-free chart endpoint
 * first, then fill in any missing symbols via the batch quote endpoint.
 */
export async function getSpotsWithFallback(
  symbols: string[]
): Promise<Record<string, number>> {
  const spots = await getYahooSpots(symbols);
  const missing = [...new Set(symbols.map(s => s.toUpperCase()))].filter(
    sym => !(sym in spots)
  );
  if (missing.length === 0) return spots;

  try {
    const quotes = await fetchQuotes(missing);
    for (const quote of quotes) {
      const sym = quote.symbol?.toUpperCase();
      if (
        sym &&
        missing.includes(sym) &&
        typeof quote.regularMarketPrice === "number" &&
        quote.regularMarketPrice > 0
      ) {
        spots[sym] = quote.regularMarketPrice;
      }
    }
  } catch {
    /* best effort — keep whatever the chart endpoint returned */
  }
  return spots;
}

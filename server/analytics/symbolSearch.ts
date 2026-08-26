import { getYahooSymbolInfo, getYahooSpots } from "./yahoo";

export interface SymbolSuggestion {
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "crypto" | "index";
  exchange?: string;
  price: number | null;
  change?: number | null;
  changePct?: number | null;
  category?: string;
  recommendationTag?: string;
  isPopular?: boolean;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export const POPULAR_TICKERS: Array<{
  symbol: string;
  name: string;
  assetType: "stock" | "etf" | "index";
  exchange: string;
  category: string;
  tag: string;
}> = [
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", assetType: "etf", exchange: "NYSE Arca", category: "Index ETF", tag: "Most Liquid ETF · Benchmark" },
  { symbol: "QQQ", name: "Invesco QQQ Trust (Nasdaq-100)", assetType: "etf", exchange: "NASDAQ", category: "Tech ETF", tag: "High Liquidity · Tech Heavy" },
  { symbol: "AAPL", name: "Apple Inc.", assetType: "stock", exchange: "NASDAQ", category: "Mega-Cap Tech", tag: "Liquid Options · Low Volatility" },
  { symbol: "NVDA", name: "NVIDIA Corporation", assetType: "stock", exchange: "NASDAQ", category: "Semiconductors", tag: "High Premium · High IV" },
  { symbol: "TSLA", name: "Tesla, Inc.", assetType: "stock", exchange: "NASDAQ", category: "EV & Tech", tag: "Active Options · Volatility Leader" },
  { symbol: "MSFT", name: "Microsoft Corporation", assetType: "stock", exchange: "NASDAQ", category: "Mega-Cap Tech", tag: "Institutional Staple · Steady Basis" },
  { symbol: "AMZN", name: "Amazon.com, Inc.", assetType: "stock", exchange: "NASDAQ", category: "E-Commerce / Cloud", tag: "High Volume · Great Wheel Candidate" },
  { symbol: "GOOGL", name: "Alphabet Inc. (Class A)", assetType: "stock", exchange: "NASDAQ", category: "Mega-Cap Tech", tag: "Solid Fundamentals · Tight Spreads" },
  { symbol: "META", name: "Meta Platforms, Inc.", assetType: "stock", exchange: "NASDAQ", category: "Social & AI", tag: "Strong Cashflow · Liquid Chain" },
  { symbol: "AMD", name: "Advanced Micro Devices, Inc.", assetType: "stock", exchange: "NASDAQ", category: "Semiconductors", tag: "High Beta · Excellent Wheel Premium" },
  { symbol: "IWM", name: "iShares Russell 2000 ETF", assetType: "etf", exchange: "NYSE Arca", category: "Small Cap ETF", tag: "Small-Cap Benchmark · Liquid" },
  { symbol: "PLTR", name: "Palantir Technologies Inc.", assetType: "stock", exchange: "NYSE", category: "Software / AI", tag: "Retail Favorite · High Option Flow" },
  { symbol: "COIN", name: "Coinbase Global, Inc.", assetType: "stock", exchange: "NASDAQ", category: "Crypto / Fintech", tag: "High Implied Volatility" },
  { symbol: "SOFI", name: "SoFi Technologies, Inc.", assetType: "stock", exchange: "NASDAQ", category: "Fintech", tag: "Accessible Cost Basis · High Volume" },
  { symbol: "MARA", name: "MARA Holdings, Inc.", assetType: "stock", exchange: "NASDAQ", category: "Crypto Mining", tag: "High Volatility · High Premiums" },
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", assetType: "etf", exchange: "NYSE Arca", category: "Index ETF", tag: "Core Long-Term Holding" },
  { symbol: "SCHD", name: "Schwab U.S. Dividend Equity ETF", assetType: "etf", exchange: "NYSE Arca", category: "Dividend ETF", tag: "Steady Dividend · Income Strategy" },
  { symbol: "TLT", name: "iShares 20+ Year Treasury Bond ETF", assetType: "etf", exchange: "NASDAQ", category: "Bonds ETF", tag: "Interest Rate Hedge · Liquid" },
  { symbol: "JPM", name: "JPMorgan Chase & Co.", assetType: "stock", exchange: "NYSE", category: "Financials", tag: "Banking Leader · Steady Yield" },
  { symbol: "DIS", name: "The Walt Disney Company", assetType: "stock", exchange: "NYSE", category: "Entertainment", tag: "Value Recovery Play" },
  { symbol: "NFLX", name: "Netflix, Inc.", assetType: "stock", exchange: "NASDAQ", category: "Streaming", tag: "High Average True Range" },
];

/**
 * Searches symbols via Yahoo Finance and StockAnalysis with local curated fast fallback.
 */
export async function searchSymbolsWithRecommendations(query: string): Promise<SymbolSuggestion[]> {
  const cleanQ = query.trim().toUpperCase();

  // If query is empty, return top popular recommendations
  if (!cleanQ) {
    const popularSymbols = POPULAR_TICKERS.slice(0, 8).map((p) => p.symbol);
    const spots = await getYahooSpots(popularSymbols).catch(() => ({}));
    return POPULAR_TICKERS.slice(0, 8).map((p) => ({
      symbol: p.symbol,
      name: p.name,
      assetType: p.assetType,
      exchange: p.exchange,
      price: spots[p.symbol] ?? null,
      category: p.category,
      recommendationTag: p.tag,
      isPopular: true,
    }));
  }

  // 1. Search local curated list
  const localMatches = POPULAR_TICKERS.filter(
    (t) => t.symbol.startsWith(cleanQ) || t.name.toUpperCase().includes(cleanQ) || t.symbol.includes(cleanQ)
  );

  // 2. Fetch remote search results from Yahoo search endpoint
  const remoteResults: Array<{ symbol: string; name: string; type: string; exchange?: string }> = [];

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3500);
    try {
      const resp = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
          query
        )}&quotesCount=8&newsCount=0&listsCount=0&enableFuzzyQuery=true`,
        {
          headers: { "User-Agent": UA },
          signal: ctrl.signal,
        }
      );
      if (resp.ok) {
        const data = (await resp.json()) as { quotes?: Array<{ symbol?: string; quoteType?: string; shortname?: string; longname?: string; exchange?: string; exchDisp?: string }> };
        const quotes = data?.quotes || [];
        for (const q of quotes) {
          const sym = q.symbol;
          if (!sym || sym.includes("=") || sym.includes("^") || sym.includes(".")) continue;
          const qType = (q.quoteType || "").toUpperCase();
          const assetType = qType === "ETF" ? "etf" : qType === "EQUITY" ? "stock" : "stock";
          remoteResults.push({
            symbol: sym.toUpperCase(),
            name: q.shortname || q.longname || sym,
            type: assetType,
            exchange: q.exchange || q.exchDisp,
          });
        }
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Yahoo search failed, fallback to StockAnalysis search
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3000);
      try {
        const resp = await fetch(`https://stockanalysis.com/api/search?q=${encodeURIComponent(query)}`, {
          headers: { "User-Agent": UA },
          signal: ctrl.signal,
        });
        if (resp.ok) {
          const data = (await resp.json()) as { data?: Array<{ id?: string; n?: string; t?: string }> };
          const hits = data?.data || [];
          for (const h of hits) {
            if (!h.id || h.id.includes(".")) continue;
            remoteResults.push({
              symbol: h.id.toUpperCase(),
              name: h.n || h.id,
              type: h.t === "e" ? "etf" : "stock",
            });
          }
        }
      } finally {
        clearTimeout(timer);
      }
    } catch {
      // ignore
    }
  }

  // Combine and deduplicate symbols
  const combinedMap = new Map<string, SymbolSuggestion>();

  // Add exact matches from local first
  for (const loc of localMatches) {
    combinedMap.set(loc.symbol, {
      symbol: loc.symbol,
      name: loc.name,
      assetType: loc.assetType,
      exchange: loc.exchange,
      price: null,
      category: loc.category,
      recommendationTag: loc.tag,
      isPopular: true,
    });
  }

  // Add remote results
  for (const rem of remoteResults) {
    if (!combinedMap.has(rem.symbol)) {
      const pop = POPULAR_TICKERS.find((p) => p.symbol === rem.symbol);
      combinedMap.set(rem.symbol, {
        symbol: rem.symbol,
        name: rem.name,
        assetType: rem.type === "etf" ? "etf" : "stock",
        exchange: rem.exchange,
        price: null,
        category: pop?.category,
        recommendationTag: pop?.tag ?? (rem.type === "etf" ? "Index / Thematic ETF" : "Equity Holding"),
        isPopular: !!pop,
      });
    }
  }

  // If query is an exact uppercase ticker not found yet, add it
  if (!combinedMap.has(cleanQ) && /^[A-Z0-9]{1,8}$/.test(cleanQ)) {
    combinedMap.set(cleanQ, {
      symbol: cleanQ,
      name: `${cleanQ} Equity`,
      assetType: "stock",
      price: null,
      recommendationTag: "Direct Ticker Match",
    });
  }

  const results = Array.from(combinedMap.values()).slice(0, 8);

  // Fetch prices for the top results concurrently
  if (results.length > 0) {
    try {
      const spots = await getYahooSpots(results.map((r) => r.symbol));
      for (const r of results) {
        if (spots[r.symbol]) {
          r.price = spots[r.symbol];
        }
      }
    } catch {
      // best effort
    }
  }

  return results;
}

/**
 * Detailed quote preview & recommendation stats for a chosen symbol.
 */
export async function getSymbolDetailPreview(symbol: string) {
  const sym = symbol.trim().toUpperCase();
  if (!sym) return null;

  const info = await getYahooSymbolInfo(sym);
  const pop = POPULAR_TICKERS.find((p) => p.symbol === sym);

  const price = (info && info !== "not_found" ? info.price : null) ?? null;
  const name = (info && info !== "not_found" ? info.name : null) ?? pop?.name ?? sym;
  const assetType = (info && info !== "not_found" && info.instrumentType === "ETF") || pop?.assetType === "etf" ? "etf" : "stock";

  // Recommendation tips
  let tip = "";
  if (price && price > 0) {
    const lotCost = price * 100;
    tip = `100 shares = $${lotCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} for 1 Covered Call contract`;
  } else if (pop?.tag) {
    tip = pop.tag;
  }

  return {
    symbol: sym,
    name,
    price,
    currency: (info && info !== "not_found" ? info.currency : "USD") ?? "USD",
    assetType,
    category: pop?.category ?? (assetType === "etf" ? "ETF" : "Equity"),
    recommendationTag: pop?.tag ?? (assetType === "etf" ? "ETF Index Holding" : "Option Eligible"),
    tip,
  };
}

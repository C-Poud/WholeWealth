import { getDb } from "../queries/connection";
import { brokerAccounts } from "@db/schema";
import { and, eq } from "drizzle-orm";
import { getIdentity } from "../queries/portfolio";
import {
  getOptionsChain,
  getQuotes,
  getSnaptradeConfig,
} from "../snaptrade/client";
import { demoChain, demoSpot } from "../snaptrade/demo";
import { getYahooChain } from "./yahoo";
import { getSpotsWithFallback } from "./symbolInfo";
import type { ChainContract } from "./engine";

export interface MarketDataResult {
  mode: "live" | "yahoo" | "demo";
  spots: Record<string, number>;
  chains: Record<string, ChainContract[]>;
  errors: string[];
}

/**
 * Resolves spot prices and option chains for a set of symbols.
 * Priority per symbol: SnapTrade broker data (when connected) →
 * Yahoo Finance (real, ~15 min delayed, no brokerage needed) →
 * deterministic demo data so analytics stay functional.
 */
export async function resolveMarketData(
  userId: number,
  symbols: string[],
): Promise<MarketDataResult> {
  const errors: string[] = [];
  const spots: Record<string, number> = {};
  const chains: Record<string, ChainContract[]> = {};
  const unique = [...new Set(symbols.map((s) => s.toUpperCase()))];

  const config = await getSnaptradeConfig();
  const identity = await getIdentity(userId);
  let accountId: string | null = null;

  if (config && identity) {
    const db = getDb();
    const accounts = await db
      .select()
      .from(brokerAccounts)
      .where(
        and(
          eq(brokerAccounts.userId, userId),
          eq(brokerAccounts.source, "snaptrade"),
        ),
      );
    accountId = accounts[0]?.snaptradeAccountId ?? null;
  }

  const liveAvailable = !!(config && identity && accountId);
  let liveChains = 0;

  if (liveAvailable && unique.length > 0) {
    // 1) quotes (single batched call; non-fatal if unsupported)
    try {
      const quotes = await getQuotes(
        config!,
        accountId!,
        identity!.snaptradeUserId,
        identity!.userSecret,
        unique,
      );
      for (const q of quotes) {
        const sym = q.symbol?.toUpperCase();
        const px = q.last_trade_price ?? q.bid_price ?? q.ask_price;
        if (sym && px != null && px > 0) spots[sym] = px;
      }
    } catch (e) {
      errors.push(
        `Live quotes unavailable (${e instanceof Error ? e.message : "unknown error"})`,
      );
    }

    // 2) chains (per symbol, best effort)
    for (const sym of unique) {
      try {
        const raw = await getOptionsChain(
          config!,
          accountId!,
          identity!.snaptradeUserId,
          identity!.userSecret,
          sym,
        );
        const contracts: ChainContract[] = [];
        for (const c of raw) {
          if (!c.strike_price || !c.expiry_date) continue;
          const type = String(c.option_type ?? "").toUpperCase();
          contracts.push({
            strike: c.strike_price,
            expiry: c.expiry_date,
            optionType: type === "PUT" ? "put" : "call",
            bid: c.bid_price ?? null,
            ask: c.ask_price ?? null,
            last: c.last_price ?? null,
            openInterest: c.open_interest ?? null,
            iv: c.implied_volatility ?? null,
            delta: c.delta ?? null,
          });
        }
        if (contracts.length > 0) {
          chains[sym] = contracts;
          liveChains++;
        }
      } catch (e) {
        errors.push(
          `Option chain for ${sym} unavailable (${e instanceof Error ? e.message : "unknown"})`,
        );
      }
    }
  }

  // Yahoo Finance fallback for every symbol SnapTrade (or its absence)
  // did not cover — real market data without a brokerage connection.
  const missing = unique.filter((s) => !chains[s]);
  if (missing.length > 0) {
    try {
      const ySpots = await getSpotsWithFallback(missing);
      for (const [k, v] of Object.entries(ySpots)) {
        if (!spots[k]) spots[k] = v;
      }
    } catch (e) {
      errors.push(
        `Quotes unavailable (${e instanceof Error ? e.message : "unknown error"})`,
      );
    }
    for (const sym of missing) {
      try {
        const contracts = await getYahooChain(sym);
        if (contracts.length > 0) chains[sym] = contracts;
      } catch (e) {
        errors.push(
          `Yahoo option chain for ${sym} unavailable (${e instanceof Error ? e.message : "unknown"})`,
        );
      }
    }
  }

  if (Object.keys(chains).length > 0) {
    // Fill any remaining gaps with demo data per symbol.
    for (const sym of unique) {
      if (!chains[sym]) {
        const d = demoChain(sym, spots[sym]);
        chains[sym] = d.contracts;
        if (!spots[sym]) spots[sym] = d.spot;
      }
      if (!spots[sym]) spots[sym] = demoSpot(sym);
    }
    return { mode: liveChains > 0 ? "live" : "yahoo", spots, chains, errors };
  }

  // Full demo mode
  for (const sym of unique) {
    const d = demoChain(sym);
    chains[sym] = d.contracts;
    spots[sym] = d.spot;
  }
  return { mode: "demo", spots, chains, errors };
}

import { and, eq, sql } from "drizzle-orm";
import { getDb } from "./connection";
import {
  watchlists,
  watchlistItems,
  type Watchlist,
  type WatchlistItem,
} from "@db/schema";

let tablesEnsured = false;
async function ensureTables(db: NonNullable<ReturnType<typeof getDb>>) {
  if (tablesEnsured) return;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`watchlists\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`userId\` bigint unsigned NOT NULL,
        \`name\` varchar(128) NOT NULL DEFAULT 'My Watchlist',
        \`description\` varchar(255),
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`watchlists_user_idx\` (\`userId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS \`watchlist_items\` (
        \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
        \`watchlistId\` bigint unsigned NOT NULL,
        \`userId\` bigint unsigned NOT NULL,
        \`symbol\` varchar(32) NOT NULL,
        \`notes\` varchar(255),
        \`targetStrike\` double,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`watchlist_items_wl_idx\` (\`watchlistId\`),
        KEY \`watchlist_items_user_sym_idx\` (\`watchlistId\`,\`symbol\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    tablesEnsured = true;
  } catch (err) {
    console.warn("[watchlist] ensureTables notice:", err);
  }
}

// ---- In-memory fallback stores ---------------------------------------------

interface InMemoryWatchlist {
  id: number;
  userId: number;
  name: string;
  description: string | null;
  createdAt: Date;
}

interface InMemoryWatchlistItem {
  id: number;
  watchlistId: number;
  userId: number;
  symbol: string;
  notes: string | null;
  targetStrike: number | null;
  createdAt: Date;
}

let nextWatchlistId = 1;
let nextItemId = 1;

const inMemoryWatchlists: InMemoryWatchlist[] = [
  {
    id: nextWatchlistId++,
    userId: 1,
    name: "Wheel Strategy Targets",
    description: "High quality liquid tickers for Cash Secured Puts & Covered Calls",
    createdAt: new Date(),
  },
];

const inMemoryItems: InMemoryWatchlistItem[] = [
  {
    id: nextItemId++,
    watchlistId: 1,
    userId: 1,
    symbol: "NVDA",
    notes: "Top AI compute leader · Target 30-45 DTE 0.20Δ CSP",
    targetStrike: 120.0,
    createdAt: new Date(),
  },
  {
    id: nextItemId++,
    watchlistId: 1,
    userId: 1,
    symbol: "AAPL",
    notes: "High cash generator · Steady CC candidate",
    targetStrike: 220.0,
    createdAt: new Date(),
  },
  {
    id: nextItemId++,
    watchlistId: 1,
    userId: 1,
    symbol: "TSLA",
    notes: "High IV rank · Great premium yield",
    targetStrike: 200.0,
    createdAt: new Date(),
  },
  {
    id: nextItemId++,
    watchlistId: 1,
    userId: 1,
    symbol: "AMD",
    notes: "Semiconductor beta hedge",
    targetStrike: 140.0,
    createdAt: new Date(),
  },
  {
    id: nextItemId++,
    watchlistId: 1,
    userId: 1,
    symbol: "SPY",
    notes: "Core index anchor",
    targetStrike: 540.0,
    createdAt: new Date(),
  },
];

export async function listUserWatchlists(userId: number): Promise<Watchlist[]> {
  const db = getDb();
  if (db) {
    try {
      await ensureTables(db);
      const userWls = await db
        .select()
        .from(watchlists)
        .where(eq(watchlists.userId, userId));

      if (userWls.length === 0) {
        // Create initial default watchlist
        await db.insert(watchlists).values({
          userId,
          name: "Wheel Strategy Targets",
          description: "High quality liquid tickers for Cash Secured Puts & Covered Calls",
        });
        const created = await db
          .select()
          .from(watchlists)
          .where(eq(watchlists.userId, userId));
        
        if (created.length > 0) {
          const defaultWlId = created[0].id;
          const initialSymbols = ["NVDA", "AAPL", "TSLA", "AMD", "SPY"];
          for (const s of initialSymbols) {
            await db.insert(watchlistItems).values({
              watchlistId: defaultWlId,
              userId,
              symbol: s,
              notes: "Default Wheel candidate",
            });
          }
          return created;
        }
      }
      return userWls;
    } catch (err) {
      console.warn("[watchlist] DB listUserWatchlists error, fallback to memory:", err);
    }
  }

  // In-memory fallback
  let userWls = inMemoryWatchlists.filter((w) => w.userId === userId);
  if (userWls.length === 0) {
    const newWl: InMemoryWatchlist = {
      id: nextWatchlistId++,
      userId,
      name: "Wheel Strategy Targets",
      description: "High quality liquid tickers for Cash Secured Puts & Covered Calls",
      createdAt: new Date(),
    };
    inMemoryWatchlists.push(newWl);
    userWls = [newWl];

    const initialSymbols = ["NVDA", "AAPL", "TSLA", "AMD", "SPY"];
    for (const s of initialSymbols) {
      inMemoryItems.push({
        id: nextItemId++,
        watchlistId: newWl.id,
        userId,
        symbol: s,
        notes: "Default Wheel candidate",
        targetStrike: null,
        createdAt: new Date(),
      });
    }
  }

  return userWls as Watchlist[];
}

export async function getWatchlistWithItems(
  userId: number,
  watchlistId: number,
): Promise<{ watchlist: Watchlist; items: WatchlistItem[] } | null> {
  const db = getDb();
  if (db) {
    try {
      await ensureTables(db);
      const [wl] = await db
        .select()
        .from(watchlists)
        .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)));
      if (!wl) return null;

      const items = await db
        .select()
        .from(watchlistItems)
        .where(
          and(
            eq(watchlistItems.watchlistId, watchlistId),
            eq(watchlistItems.userId, userId),
          ),
        );
      return { watchlist: wl, items };
    } catch (err) {
      console.warn("[watchlist] DB getWatchlistWithItems error, fallback to memory:", err);
    }
  }

  const wl = inMemoryWatchlists.find(
    (w) => w.id === watchlistId && w.userId === userId,
  );
  if (!wl) return null;

  const items = inMemoryItems.filter(
    (i) => i.watchlistId === watchlistId && i.userId === userId,
  );
  return { watchlist: wl as Watchlist, items: items as WatchlistItem[] };
}

export async function createWatchlist(
  userId: number,
  name: string,
  description?: string,
): Promise<Watchlist> {
  const db = getDb();
  if (db) {
    try {
      await ensureTables(db);
      await db.insert(watchlists).values({
        userId,
        name: name.trim() || "My Watchlist",
        description: description?.trim() || null,
      });
      const userWls = await db
        .select()
        .from(watchlists)
        .where(eq(watchlists.userId, userId));
      return userWls[userWls.length - 1];
    } catch (err) {
      console.warn("[watchlist] DB createWatchlist error, fallback to memory:", err);
    }
  }

  const newWl: InMemoryWatchlist = {
    id: nextWatchlistId++,
    userId,
    name: name.trim() || "My Watchlist",
    description: description?.trim() || null,
    createdAt: new Date(),
  };
  inMemoryWatchlists.push(newWl);
  return newWl as Watchlist;
}

export async function deleteWatchlist(
  userId: number,
  watchlistId: number,
): Promise<boolean> {
  const db = getDb();
  if (db) {
    try {
      await ensureTables(db);
      await db
        .delete(watchlistItems)
        .where(
          and(
            eq(watchlistItems.watchlistId, watchlistId),
            eq(watchlistItems.userId, userId),
          ),
        );
      await db
        .delete(watchlists)
        .where(and(eq(watchlists.id, watchlistId), eq(watchlists.userId, userId)));
      return true;
    } catch (err) {
      console.warn("[watchlist] DB deleteWatchlist error, fallback to memory:", err);
    }
  }

  const wlIdx = inMemoryWatchlists.findIndex(
    (w) => w.id === watchlistId && w.userId === userId,
  );
  if (wlIdx >= 0) {
    inMemoryWatchlists.splice(wlIdx, 1);
    for (let i = inMemoryItems.length - 1; i >= 0; i--) {
      if (inMemoryItems[i].watchlistId === watchlistId && inMemoryItems[i].userId === userId) {
        inMemoryItems.splice(i, 1);
      }
    }
    return true;
  }
  return false;
}

export async function addWatchlistSymbol(
  userId: number,
  watchlistId: number,
  symbol: string,
  notes?: string,
  targetStrike?: number,
): Promise<WatchlistItem> {
  const cleanSym = symbol.trim().toUpperCase();
  const db = getDb();
  if (db) {
    try {
      await ensureTables(db);
      // Check if already in watchlist
      const existing = await db
        .select()
        .from(watchlistItems)
        .where(
          and(
            eq(watchlistItems.watchlistId, watchlistId),
            eq(watchlistItems.userId, userId),
            eq(watchlistItems.symbol, cleanSym),
          ),
        );
      if (existing.length > 0) {
        return existing[0];
      }

      await db.insert(watchlistItems).values({
        watchlistId,
        userId,
        symbol: cleanSym,
        notes: notes?.trim() || null,
        targetStrike: targetStrike || null,
      });

      const items = await db
        .select()
        .from(watchlistItems)
        .where(
          and(
            eq(watchlistItems.watchlistId, watchlistId),
            eq(watchlistItems.symbol, cleanSym),
          ),
        );
      return items[0];
    } catch (err) {
      console.warn("[watchlist] DB addWatchlistSymbol error, fallback to memory:", err);
    }
  }

  const existing = inMemoryItems.find(
    (i) =>
      i.watchlistId === watchlistId &&
      i.userId === userId &&
      i.symbol === cleanSym,
  );
  if (existing) return existing as WatchlistItem;

  const newItem: InMemoryWatchlistItem = {
    id: nextItemId++,
    watchlistId,
    userId,
    symbol: cleanSym,
    notes: notes?.trim() || null,
    targetStrike: targetStrike || null,
    createdAt: new Date(),
  };
  inMemoryItems.push(newItem);
  return newItem as WatchlistItem;
}

export async function removeWatchlistSymbol(
  userId: number,
  watchlistId: number,
  symbol: string,
): Promise<boolean> {
  const cleanSym = symbol.trim().toUpperCase();
  const db = getDb();
  if (db) {
    try {
      await ensureTables(db);
      await db
        .delete(watchlistItems)
        .where(
          and(
            eq(watchlistItems.watchlistId, watchlistId),
            eq(watchlistItems.userId, userId),
            eq(watchlistItems.symbol, cleanSym),
          ),
        );
      return true;
    } catch (err) {
      console.warn("[watchlist] DB removeWatchlistSymbol error, fallback to memory:", err);
    }
  }

  const idx = inMemoryItems.findIndex(
    (i) =>
      i.watchlistId === watchlistId &&
      i.userId === userId &&
      i.symbol === cleanSym,
  );
  if (idx >= 0) {
    inMemoryItems.splice(idx, 1);
    return true;
  }
  return false;
}

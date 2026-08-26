import { and, eq, inArray, isNull, notInArray, or } from "drizzle-orm";
import { getDb } from "./connection";
import {
  appSettings,
  brokerAccounts,
  positions,
  snaptradeIdentities,
  type BrokerAccount,
  type Position,
  type SnaptradeIdentity,
} from "@db/schema";
import { getQuotesWithFallback, getSpotsWithFallback, lookupSymbolInfo } from "../analytics/symbolInfo";
import { DEMO_POSITIONS, demoSpot } from "../snaptrade/demo";

/** Position enriched with the previous close, for day-change display. */
export type PositionWithQuote = Position & { prevClose?: number | null };

// ---- in-memory fallback stores ---------------------------------------------

const inMemorySettings = new Map<string, string>();
const inMemoryIdentities = new Map<number, SnaptradeIdentity>();
let nextAccountId = 1;
const inMemoryAccounts: BrokerAccount[] = [
  {
    id: nextAccountId++,
    userId: 1,
    snaptradeAccountId: null,
    name: "Primary Trading",
    institution: "Interactive Brokers",
    number: "U***8492",
    cash: 25480.0,
    currency: "USD",
    enabled: true,
    source: "demo",
    lastSyncedAt: new Date(),
    createdAt: new Date(),
  },
];

let nextPositionId = 1;
const inMemoryPositions: Position[] = DEMO_POSITIONS.map((p) => ({
  id: nextPositionId++,
  userId: 1,
  accountId: 1,
  symbol: p.symbol,
  description: p.description,
  assetType: "stock" as const,
  quantity: p.quantity,
  costBasis: p.costBasis,
  price: demoSpot(p.symbol),
  currency: "USD",
  source: "demo" as const,
  optionType: null,
  strike: null,
  expiry: null,
  rawSymbol: null,
  updatedAt: new Date(),
  createdAt: new Date(),
}));

// ---- settings --------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, key));
      return rows[0]?.value ?? null;
    } catch (err) {
      console.warn("[portfolio] getSetting db error, fallback to memory:", err);
    }
  }
  return inMemorySettings.get(key) ?? null;
}

export async function setSetting(key: string, value: string | null) {
  const db = getDb();
  if (db) {
    try {
      if (value === null) {
        await db.delete(appSettings).where(eq(appSettings.key, key));
        return;
      }
      await db
        .insert(appSettings)
        .values({ key, value })
        .onDuplicateKeyUpdate({ set: { value } });
      return;
    } catch (err) {
      console.warn("[portfolio] setSetting db error, fallback to memory:", err);
    }
  }
  if (value === null) {
    inMemorySettings.delete(key);
  } else {
    inMemorySettings.set(key, value);
  }
}

// ---- snaptrade identity ----------------------------------------------------

export async function getIdentity(userId: number): Promise<SnaptradeIdentity | null> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(snaptradeIdentities)
        .where(eq(snaptradeIdentities.userId, userId));
      return rows[0] ?? null;
    } catch (err) {
      console.warn("[portfolio] getIdentity db error, fallback to memory:", err);
    }
  }
  return inMemoryIdentities.get(userId) ?? null;
}

export async function saveIdentity(
  userId: number,
  snaptradeUserId: string,
  userSecret: string,
) {
  const db = getDb();
  if (db) {
    try {
      await db
        .insert(snaptradeIdentities)
        .values({ userId, snaptradeUserId, userSecret })
        .onDuplicateKeyUpdate({ set: { snaptradeUserId, userSecret } });
      return;
    } catch (err) {
      console.warn("[portfolio] saveIdentity db error, fallback to memory:", err);
    }
  }
  inMemoryIdentities.set(userId, {
    id: userId,
    userId,
    snaptradeUserId,
    userSecret,
    createdAt: new Date(),
  });
}

export async function deleteIdentity(userId: number) {
  const db = getDb();
  if (db) {
    try {
      await db
        .delete(snaptradeIdentities)
        .where(eq(snaptradeIdentities.userId, userId));
      return;
    } catch (err) {
      console.warn("[portfolio] deleteIdentity db error, fallback to memory:", err);
    }
  }
  inMemoryIdentities.delete(userId);
}

// ---- accounts --------------------------------------------------------------

export async function listAccounts(userId: number): Promise<BrokerAccount[]> {
  await ensureUserDemoData(userId);
  const db = getDb();
  if (db) {
    try {
      return await db
        .select()
        .from(brokerAccounts)
        .where(eq(brokerAccounts.userId, userId));
    } catch (err) {
      console.warn("[portfolio] listAccounts db error, fallback to memory:", err);
    }
  }
  return inMemoryAccounts.filter((a) => a.userId === userId);
}

export async function upsertSnaptradeAccount(
  userId: number,
  data: {
    snaptradeAccountId: string;
    name?: string;
    institution?: string;
    number?: string;
    cash?: number | null;
    currency?: string;
  },
): Promise<BrokerAccount> {
  const db = getDb();
  if (db) {
    try {
      await db
        .insert(brokerAccounts)
        .values({
          userId,
          snaptradeAccountId: data.snaptradeAccountId,
          name: data.name,
          institution: data.institution,
          number: data.number,
          cash: data.cash ?? null,
          currency: data.currency ?? "USD",
          source: "snaptrade",
          lastSyncedAt: new Date(),
        })
        .onDuplicateKeyUpdate({
          set: {
            name: data.name,
            institution: data.institution,
            number: data.number,
            cash: data.cash ?? null,
            lastSyncedAt: new Date(),
          },
        });
      const rows = await db
        .select()
        .from(brokerAccounts)
        .where(eq(brokerAccounts.snaptradeAccountId, data.snaptradeAccountId));
      if (rows[0]) return rows[0];
    } catch (err) {
      console.warn("[portfolio] upsertSnaptradeAccount db error, fallback to memory:", err);
    }
  }

  const existingIdx = inMemoryAccounts.findIndex(
    (a) => a.snaptradeAccountId === data.snaptradeAccountId && a.userId === userId,
  );
  if (existingIdx >= 0) {
    inMemoryAccounts[existingIdx] = {
      ...inMemoryAccounts[existingIdx],
      name: data.name ?? inMemoryAccounts[existingIdx].name,
      institution: data.institution ?? inMemoryAccounts[existingIdx].institution,
      number: data.number ?? inMemoryAccounts[existingIdx].number,
      cash: data.cash ?? inMemoryAccounts[existingIdx].cash,
      currency: data.currency ?? inMemoryAccounts[existingIdx].currency,
      lastSyncedAt: new Date(),
    };
    return inMemoryAccounts[existingIdx];
  } else {
    const acc: BrokerAccount = {
      id: nextAccountId++,
      userId,
      snaptradeAccountId: data.snaptradeAccountId,
      name: data.name ?? null,
      institution: data.institution ?? null,
      number: data.number ?? null,
      cash: data.cash ?? null,
      currency: data.currency ?? "USD",
      enabled: true,
      source: "snaptrade",
      lastSyncedAt: new Date(),
      createdAt: new Date(),
    };
    inMemoryAccounts.push(acc);
    return acc;
  }
}

/** Enable/disable an account — disabled accounts' positions are hidden
 *  from the portfolio, analytics and suggestions. */
export async function setAccountEnabled(
  userId: number,
  accountId: number,
  enabled: boolean,
) {
  const db = getDb();
  if (db) {
    try {
      await db
        .update(brokerAccounts)
        .set({ enabled })
        .where(
          and(eq(brokerAccounts.id, accountId), eq(brokerAccounts.userId, userId)),
        );
      return;
    } catch (err) {
      console.warn("[portfolio] setAccountEnabled db error, fallback to memory:", err);
    }
  }
  const acc = inMemoryAccounts.find((a) => a.id === accountId && a.userId === userId);
  if (acc) {
    acc.enabled = enabled;
  }
}

export async function deleteAccount(userId: number, accountId: number): Promise<boolean> {
  const db = getDb();
  if (db) {
    try {
      // First delete positions associated with this account
      await db
        .delete(positions)
        .where(
          and(eq(positions.userId, userId), eq(positions.accountId, accountId)),
        );
      // Delete the account
      await db
        .delete(brokerAccounts)
        .where(
          and(eq(brokerAccounts.userId, userId), eq(brokerAccounts.id, accountId)),
        );
      return true;
    } catch (err) {
      console.warn("[portfolio] deleteAccount db error, fallback to memory:", err);
    }
  }

  // In-memory fallback
  const pIdxs: number[] = [];
  inMemoryPositions.forEach((p, idx) => {
    if (p.userId === userId && p.accountId === accountId) {
      pIdxs.push(idx);
    }
  });
  for (let i = pIdxs.length - 1; i >= 0; i--) {
    inMemoryPositions.splice(pIdxs[i], 1);
  }

  const accIdx = inMemoryAccounts.findIndex(
    (a) => a.id === accountId && a.userId === userId,
  );
  if (accIdx >= 0) {
    inMemoryAccounts.splice(accIdx, 1);
    return true;
  }
  return false;
}

export async function getOrCreateImportAccount(userId: number): Promise<BrokerAccount> {
  const db = getDb();
  if (db) {
    try {
      const existing = await db
        .select()
        .from(brokerAccounts)
        .where(
          and(
            eq(brokerAccounts.userId, userId),
            eq(brokerAccounts.source, "import"),
          ),
        );
      if (existing[0]) return existing[0];
      await db.insert(brokerAccounts).values({
        userId,
        name: "Imported positions",
        institution: "File import",
        source: "import",
      });
      const created = await db
        .select()
        .from(brokerAccounts)
        .where(
          and(
            eq(brokerAccounts.userId, userId),
            eq(brokerAccounts.source, "import"),
          ),
        );
      if (created[0]) return created[0];
    } catch (err) {
      console.warn("[portfolio] getOrCreateImportAccount db error, fallback to memory:", err);
    }
  }

  const existing = inMemoryAccounts.find(
    (a) => a.userId === userId && a.source === "import",
  );
  if (existing) return existing;
  const acc: BrokerAccount = {
    id: nextAccountId++,
    userId,
    snaptradeAccountId: null,
    name: "Imported positions",
    institution: "File import",
    number: null,
    cash: null,
    currency: "USD",
    enabled: true,
    source: "import",
    lastSyncedAt: null,
    createdAt: new Date(),
  };
  inMemoryAccounts.push(acc);
  return acc;
}

// ---- positions -------------------------------------------------------------

/** All positions for a user, excluding ones in accounts they've disabled. */
export async function listPositions(
  userId: number,
): Promise<PositionWithQuote[]> {
  await ensureUserDemoData(userId);
  const db = getDb();
  let rows: PositionWithQuote[] = [];
  if (db) {
    try {
      const disabledRows = await db
        .select({ id: brokerAccounts.id })
        .from(brokerAccounts)
        .where(
          and(eq(brokerAccounts.userId, userId), eq(brokerAccounts.enabled, false)),
        );
      const disabledIds = disabledRows.map((r) => Number(r.id));
      rows = await db
        .select()
        .from(positions)
        .where(
          and(
            eq(positions.userId, userId),
            disabledIds.length > 0
              ? or(
                  isNull(positions.accountId),
                  notInArray(positions.accountId, disabledIds),
                )
              : undefined,
          ),
        );
    } catch (err) {
      console.warn("[portfolio] listPositions db error, fallback to memory:", err);
      const disabledIds = new Set(
        inMemoryAccounts
          .filter((a) => a.userId === userId && !a.enabled)
          .map((a) => a.id),
      );
      rows = inMemoryPositions.filter(
        (p) =>
          p.userId === userId &&
          (p.accountId == null || !disabledIds.has(p.accountId)),
      );
    }
  } else {
    const disabledIds = new Set(
      inMemoryAccounts
        .filter((a) => a.userId === userId && !a.enabled)
        .map((a) => a.id),
    );
    rows = inMemoryPositions.filter(
      (p) =>
        p.userId === userId &&
        (p.accountId == null || !disabledIds.has(p.accountId)),
    );
  }

  // Backfill missing company names/prices (Yahoo → stockanalysis fallback).
  const missing = rows.filter((r) => !r.description).slice(0, 8);
  if (missing.length > 0) {
    await Promise.all(
      missing.map(async (r) => {
        try {
          const info = await lookupSymbolInfo(r.symbol);
          if (info && info !== "not_found" && (info.name || info.price)) {
            const set: { description?: string; price?: number } = {};
            if (info.name) set.description = info.name;
            if (r.price == null && info.price != null) set.price = info.price;
            if (Object.keys(set).length > 0) {
              if (db) {
                try {
                  await db
                    .update(positions)
                    .set(set)
                    .where(
                      and(eq(positions.id, r.id), eq(positions.userId, userId)),
                    );
                } catch {
                  /* fallback */
                }
              }
              const memPos = inMemoryPositions.find((p) => p.id === r.id);
              if (memPos) {
                if (set.description) memPos.description = set.description;
                if (set.price != null) memPos.price = set.price;
              }
              if (set.description) r.description = set.description;
              if (set.price != null) r.price = set.price;
            }
          }
        } catch {
          /* best effort */
        }
      }),
    );
  }

  // Refresh equity prices (stocks/ETFs) with live quotes - keeps demo and
  // manually added positions on real market data instead of the price
  // captured when the row was created. Options keep their synced price
  // (no free option-quote source). Capped at 15 symbols per load.
  const equitySymbols = [
    ...new Set(
      rows
        .filter((r) => r.assetType !== "option")
        .map((r) => r.symbol.toUpperCase()),
    ),
  ].slice(0, 15);
  if (equitySymbols.length > 0) {
    try {
      const quotes = await getQuotesWithFallback(equitySymbols);
      for (const r of rows) {
        const q = quotes[r.symbol.toUpperCase()];
        if (!q) continue;
        r.prevClose = q.prevClose;
        if (r.assetType === "option" || q.price === r.price) continue;
        r.price = q.price;
        if (db) {
          try {
            await db
              .update(positions)
              .set({ price: q.price })
              .where(and(eq(positions.id, r.id), eq(positions.userId, userId)));
          } catch {
            /* best effort */
          }
        }
        const memPos = inMemoryPositions.find((p) => p.id === r.id);
        if (memPos) memPos.price = q.price;
      }
    } catch {
      /* quotes are best effort - stale prices still render */
    }
  }

  return rows;
}

export async function replacePositionsBySource(
  userId: number,
  source: "snaptrade" | "import" | "demo" | "manual",
  rows: Array<typeof positions.$inferInsert>,
) {
  const db = getDb();
  if (db) {
    try {
      await db
        .delete(positions)
        .where(and(eq(positions.userId, userId), eq(positions.source, source)));
      if (rows.length > 0) {
        await db.insert(positions).values(rows);
      }
      return;
    } catch (err) {
      console.warn("[portfolio] replacePositionsBySource db error, fallback to memory:", err);
    }
  }

  for (let i = inMemoryPositions.length - 1; i >= 0; i--) {
    if (
      inMemoryPositions[i].userId === userId &&
      inMemoryPositions[i].source === source
    ) {
      inMemoryPositions.splice(i, 1);
    }
  }

  for (const r of rows) {
    inMemoryPositions.push({
      id: nextPositionId++,
      userId,
      accountId: r.accountId ?? null,
      symbol: r.symbol,
      description: r.description ?? null,
      assetType: r.assetType ?? "stock",
      quantity: r.quantity,
      costBasis: r.costBasis ?? null,
      price: r.price ?? null,
      currency: r.currency ?? "USD",
      source: r.source ?? source,
      optionType: r.optionType ?? null,
      strike: r.strike ?? null,
      expiry: r.expiry ?? null,
      rawSymbol: r.rawSymbol ?? null,
      updatedAt: new Date(),
      createdAt: new Date(),
    });
  }
}

export async function insertManualPosition(
  userId: number,
  row: typeof positions.$inferInsert,
) {
  const db = getDb();
  if (db) {
    try {
      await db.insert(positions).values(row);
      return;
    } catch (err) {
      console.warn("[portfolio] insertManualPosition db error, fallback to memory:", err);
    }
  }

  inMemoryPositions.push({
    id: nextPositionId++,
    userId,
    accountId: row.accountId ?? null,
    symbol: row.symbol,
    description: row.description ?? null,
    assetType: row.assetType ?? "stock",
    quantity: row.quantity,
    costBasis: row.costBasis ?? null,
    price: row.price ?? null,
    currency: row.currency ?? "USD",
    source: row.source ?? "manual",
    optionType: row.optionType ?? null,
    strike: row.strike ?? null,
    expiry: row.expiry ?? null,
    rawSymbol: row.rawSymbol ?? null,
    updatedAt: new Date(),
    createdAt: new Date(),
  });
}

export async function deletePositionsByIds(userId: number, ids: number[]) {
  if (ids.length === 0) return;
  const db = getDb();
  if (db) {
    try {
      await db
        .delete(positions)
        .where(and(eq(positions.userId, userId), inArray(positions.id, ids)));
      return;
    } catch (err) {
      console.warn("[portfolio] deletePositionsByIds db error, fallback to memory:", err);
    }
  }

  const idSet = new Set(ids);
  for (let i = inMemoryPositions.length - 1; i >= 0; i--) {
    if (
      inMemoryPositions[i].userId === userId &&
      idSet.has(inMemoryPositions[i].id)
    ) {
      inMemoryPositions.splice(i, 1);
    }
  }
}

export async function updatePosition(
  userId: number,
  id: number,
  data: {
    quantity?: number;
    costBasis?: number | null;
    price?: number | null;
    accountId?: number | null;
  },
) {
  const db = getDb();
  if (db) {
    try {
      await db
        .update(positions)
        .set(data)
        .where(and(eq(positions.id, id), eq(positions.userId, userId)));
      return;
    } catch (err) {
      console.warn("[portfolio] updatePosition db error, fallback to memory:", err);
    }
  }

  const pos = inMemoryPositions.find((p) => p.id === id && p.userId === userId);
  if (pos) {
    if (data.quantity !== undefined) pos.quantity = data.quantity;
    if (data.costBasis !== undefined) pos.costBasis = data.costBasis;
    if (data.price !== undefined) pos.price = data.price;
    if (data.accountId !== undefined) pos.accountId = data.accountId;
    pos.updatedAt = new Date();
  }
}

// ---- demo lifecycle management ---------------------------------------------

/** Seeds standard demo positions and a demo broker account for a user. */
export async function seedDemoData(userId: number) {
  const db = getDb();
  let accountId: number | null = null;

  if (db) {
    try {
      const existingDemo = await db
        .select()
        .from(brokerAccounts)
        .where(
          and(
            eq(brokerAccounts.userId, userId),
            eq(brokerAccounts.source, "demo"),
          ),
        );
      if (existingDemo[0]) {
        accountId = existingDemo[0].id;
      } else {
        const [res] = await db.insert(brokerAccounts).values({
          userId,
          name: "Primary Trading",
          institution: "Interactive Brokers",
          number: "U***8492",
          cash: 25480.0,
          currency: "USD",
          enabled: true,
          source: "demo",
          lastSyncedAt: new Date(),
        });
        accountId = res ? Number(res.insertId) : null;
      }
    } catch (err) {
      console.warn("[portfolio] seedDemoData account db error, fallback to memory:", err);
    }
  }

  if (!accountId) {
    const existing = inMemoryAccounts.find(
      (a) => a.userId === userId && a.source === "demo",
    );
    if (existing) {
      accountId = existing.id;
    } else {
      const acc: BrokerAccount = {
        id: nextAccountId++,
        userId,
        snaptradeAccountId: null,
        name: "Primary Trading",
        institution: "Interactive Brokers",
        number: "U***8492",
        cash: 25480.0,
        currency: "USD",
        enabled: true,
        source: "demo",
        lastSyncedAt: new Date(),
        createdAt: new Date(),
      };
      inMemoryAccounts.push(acc);
      accountId = acc.id;
    }
  }

  // Live market prices when reachable; synthetic prices as fallback.
  const spots = await getSpotsWithFallback(
    DEMO_POSITIONS.map((p) => p.symbol),
  ).catch(() => ({}) as Record<string, number>);
  const rows = DEMO_POSITIONS.map((p) => ({
    userId,
    accountId,
    symbol: p.symbol,
    description: p.description,
    assetType: "stock" as const,
    quantity: p.quantity,
    costBasis: p.costBasis,
    price: spots[p.symbol] ?? demoSpot(p.symbol),
    currency: "USD",
    source: "demo" as const,
  }));

  await replacePositionsBySource(userId, "demo", rows);
}

/** Clears all demo positions and demo broker accounts for a user. */
export async function clearDemoData(userId: number) {
  // Clear demo positions
  await replacePositionsBySource(userId, "demo", []);

  // Clear demo accounts
  const db = getDb();
  if (db) {
    try {
      await db
        .delete(brokerAccounts)
        .where(
          and(
            eq(brokerAccounts.userId, userId),
            eq(brokerAccounts.source, "demo"),
          ),
        );
    } catch (err) {
      console.warn("[portfolio] clearDemoData accounts db error, fallback to memory:", err);
    }
  }

  for (let i = inMemoryAccounts.length - 1; i >= 0; i--) {
    if (
      inMemoryAccounts[i].userId === userId &&
      inMemoryAccounts[i].source === "demo"
    ) {
      inMemoryAccounts.splice(i, 1);
    }
  }
}

/** Ensures that a new user starts with demo data by default. */
export async function ensureUserDemoData(userId: number) {
  // 1. If user has a SnapTrade identity registered, never auto-seed demo data
  const identity = await getIdentity(userId);
  if (identity) return;

  // 2. Check if user already has positions or accounts in DB
  const db = getDb();
  if (db) {
    try {
      const [dbPositions, dbAccounts] = await Promise.all([
        db
          .select({ id: positions.id })
          .from(positions)
          .where(eq(positions.userId, userId))
          .limit(1),
        db
          .select({ id: brokerAccounts.id, source: brokerAccounts.source })
          .from(brokerAccounts)
          .where(eq(brokerAccounts.userId, userId)),
      ]);

      if (dbPositions.length > 0) return;
      if (dbAccounts.some((a) => a.source === "snaptrade" || a.source === "import")) return;
    } catch (err) {
      console.warn("[portfolio] ensureUserDemoData db check error, fallback to memory:", err);
    }
  }

  // Check in-memory state
  const memPositions = inMemoryPositions.filter((p) => p.userId === userId);
  if (memPositions.length > 0) return;

  const memAccounts = inMemoryAccounts.filter((a) => a.userId === userId);
  if (memAccounts.some((a) => a.source === "snaptrade" || a.source === "import")) return;

  // Auto-seed demo portfolio for this new user
  await seedDemoData(userId);
}

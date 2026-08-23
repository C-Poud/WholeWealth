import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "./connection";
import {
  appSettings,
  brokerAccounts,
  positions,
  snaptradeIdentities,
  type Position,
} from "@db/schema";

// ---- settings --------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  const rows = await getDb()
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key));
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string | null) {
  const db = getDb();
  if (value === null) {
    await db.delete(appSettings).where(eq(appSettings.key, key));
    return;
  }
  await db
    .insert(appSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

// ---- snaptrade identity ----------------------------------------------------

export async function getIdentity(userId: number) {
  const rows = await getDb()
    .select()
    .from(snaptradeIdentities)
    .where(eq(snaptradeIdentities.userId, userId));
  return rows[0] ?? null;
}

export async function saveIdentity(
  userId: number,
  snaptradeUserId: string,
  userSecret: string,
) {
  const db = getDb();
  await db
    .insert(snaptradeIdentities)
    .values({ userId, snaptradeUserId, userSecret })
    .onDuplicateKeyUpdate({ set: { snaptradeUserId, userSecret } });
}

export async function deleteIdentity(userId: number) {
  await getDb()
    .delete(snaptradeIdentities)
    .where(eq(snaptradeIdentities.userId, userId));
}

// ---- accounts --------------------------------------------------------------

export async function listAccounts(userId: number) {
  return getDb()
    .select()
    .from(brokerAccounts)
    .where(eq(brokerAccounts.userId, userId));
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
) {
  const db = getDb();
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
  return rows[0];
}

export async function getOrCreateImportAccount(userId: number) {
  const db = getDb();
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
  return created[0];
}

// ---- positions -------------------------------------------------------------

export async function listPositions(userId: number): Promise<Position[]> {
  return getDb()
    .select()
    .from(positions)
    .where(eq(positions.userId, userId));
}

export async function replacePositionsBySource(
  userId: number,
  source: "snaptrade" | "import" | "demo",
  rows: Array<typeof positions.$inferInsert>,
) {
  const db = getDb();
  await db
    .delete(positions)
    .where(and(eq(positions.userId, userId), eq(positions.source, source)));
  if (rows.length > 0) {
    await db.insert(positions).values(rows);
  }
}

export async function deletePositionsByIds(userId: number, ids: number[]) {
  if (ids.length === 0) return;
  await getDb()
    .delete(positions)
    .where(and(eq(positions.userId, userId), inArray(positions.id, ids)));
}

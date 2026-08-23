import { eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";

export async function findUserByUnionId(unionId: string) {
  const rows = await getDb()
    .select()
    .from(schema.users)
    .where(eq(schema.users.unionId, unionId))
    .limit(1);
  return rows.at(0);
}

export async function upsertUser(data: InsertUser) {
  const values = { ...data };
  const updateSet: Partial<InsertUser> = {
    lastSignInAt: new Date(),
    ...data,
  };

  if (
    values.role === undefined &&
    values.unionId &&
    values.unionId === env.ownerUnionId
  ) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  await getDb()
    .insert(schema.users)
    .values(values)
    .onDuplicateKeyUpdate({ set: updateSet });
}

const DEFAULT_UNION_ID = "workspace-default";

/**
 * No-auth mode: the app runs as a single shared workspace. Every request
 * without a valid session is mapped to this default (admin) user.
 */
export async function getOrCreateDefaultUser() {
  const existing = await findUserByUnionId(DEFAULT_UNION_ID);
  if (existing) return existing;
  await upsertUser({
    unionId: DEFAULT_UNION_ID,
    name: "My Workspace",
    role: "admin",
    lastSignInAt: new Date(),
  });
  const created = await findUserByUnionId(DEFAULT_UNION_ID);
  if (!created) throw new Error("Failed to create default workspace user");
  return created;
}

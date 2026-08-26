import { desc, eq } from "drizzle-orm";
import * as schema from "@db/schema";
import type { InsertUser, User } from "@db/schema";
import { getDb } from "./connection";
import { env } from "../lib/env";
import { ensureUserDemoData } from "./portfolio";

const DEFAULT_UNION_ID = "workspace-default";

const inMemoryUsers: User[] = [
  {
    id: 1,
    unionId: DEFAULT_UNION_ID,
    name: "My Workspace",
    email: "trader@networth.local",
    avatar: null,
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignInAt: new Date(),
  },
];

export async function findUserByUnionId(unionId: string): Promise<User | undefined> {
  const db = getDb();
  if (db) {
    try {
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.unionId, unionId))
        .limit(1);
      if (rows.length > 0) return rows[0];
    } catch (err) {
      console.warn("[users] findUserByUnionId db error, falling back to memory:", err);
    }
  }
  return inMemoryUsers.find((u) => u.unionId === unionId);
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

  // Google sign-in: emails listed in ADMIN_EMAILS become admins.
  if (
    values.email &&
    env.adminEmails.includes(values.email.trim().toLowerCase())
  ) {
    values.role = "admin";
    updateSet.role = "admin";
  }

  const db = getDb();
  if (db) {
    try {
      await db
        .insert(schema.users)
        .values(values)
        .onDuplicateKeyUpdate({ set: updateSet });
      const user = await findUserByUnionId(data.unionId);
      if (user) {
        await ensureUserDemoData(user.id);
      }
      return;
    } catch (err) {
      console.warn("[users] upsertUser db error, falling back to memory:", err);
    }
  }

  const existingIdx = inMemoryUsers.findIndex((u) => u.unionId === data.unionId);
  if (existingIdx >= 0) {
    inMemoryUsers[existingIdx] = {
      ...inMemoryUsers[existingIdx],
      ...updateSet,
      updatedAt: new Date(),
    } as User;
  } else {
    const newUser: User = {
      id: inMemoryUsers.length + 1,
      unionId: data.unionId,
      name: data.name ?? null,
      email: data.email ?? null,
      avatar: data.avatar ?? null,
      role: (values.role as "user" | "admin") ?? "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignInAt: new Date(),
    };
    inMemoryUsers.push(newUser);
    await ensureUserDemoData(newUser.id);
  }
}

/** Admin: list everyone who has signed in, most recent first. */
export async function listUsers(): Promise<Array<Pick<User, "id" | "name" | "email" | "avatar" | "role" | "createdAt" | "lastSignInAt">>> {
  const db = getDb();
  if (db) {
    try {
      return await db
        .select({
          id: schema.users.id,
          name: schema.users.name,
          email: schema.users.email,
          avatar: schema.users.avatar,
          role: schema.users.role,
          createdAt: schema.users.createdAt,
          lastSignInAt: schema.users.lastSignInAt,
        })
        .from(schema.users)
        .orderBy(desc(schema.users.lastSignInAt));
    } catch (err) {
      console.warn("[users] listUsers db error, falling back to memory:", err);
    }
  }
  return [...inMemoryUsers]
    .sort((a, b) => b.lastSignInAt.getTime() - a.lastSignInAt.getTime())
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      avatar: u.avatar,
      role: u.role,
      createdAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
    }));
}

/**
 * No-auth mode: the app runs as a single shared workspace. Every request
 * without a valid session is mapped to this default (admin) user.
 */
export async function getOrCreateDefaultUser(): Promise<User> {
  const existing = await findUserByUnionId(DEFAULT_UNION_ID);
  if (existing) return existing;
  await upsertUser({
    unionId: DEFAULT_UNION_ID,
    name: "My Workspace",
    role: "admin",
    lastSignInAt: new Date(),
  });
  const created = await findUserByUnionId(DEFAULT_UNION_ID);
  if (!created) {
    return inMemoryUsers[0];
  }
  return created;
}

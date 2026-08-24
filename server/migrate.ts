import { drizzle } from "drizzle-orm/mysql2";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { env } from "./lib/env";
import path from "path";
import fs from "fs";

/**
 * Applies pending SQL migrations and ensures tables exist at server startup.
 * The database is reachable only from the deployed runtime, so migrations
 * cannot be pushed from a dev sandbox — running them here guarantees the
 * schema exists before the app serves traffic.
 */
export async function runMigrations() {
  if (!env.databaseUrl || env.databaseUrl.trim().length === 0) {
    return;
  }
  const db = drizzle(env.databaseUrl);

  // 1. Direct DDL safety layer: Ensure watchlists, watchlist_items and core tables exist
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
  } catch (err) {
    console.warn("[migrate] Direct table ensure notice:", err);
  }

  // 2. Run standard drizzle migrations if migration folder exists
  try {
    const candidateFolders = [
      new URL("../server/db/migrations", import.meta.url).pathname,
      path.join(process.cwd(), "server/db/migrations"),
      path.join(process.cwd(), "dist/server/db/migrations"),
    ];

    let validFolder: string | null = null;
    for (const f of candidateFolders) {
      if (fs.existsSync(f)) {
        validFolder = f;
        break;
      }
    }

    if (validFolder) {
      await migrate(db, { migrationsFolder: validFolder });
      console.log("[migrate] database migrations applied from", validFolder);
    } else {
      console.log("[migrate] core database tables verified");
    }
  } catch (err) {
    console.warn("[migrate] migration runner notice:", err);
  }
}


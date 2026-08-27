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

  // 1. Run standard drizzle migrations first if migration folder exists
  let migrationRan = false;
  try {
    const candidateFolders = [
      new URL("../server/db/migrations", import.meta.url).pathname,
      path.join(process.cwd(), "server/db/migrations"),
      path.join(process.cwd(), "dist/server/db/migrations"),
      path.join(process.cwd(), "db/migrations"),
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
      migrationRan = true;
      console.log("[migrate] database migrations successfully applied from", validFolder);
    }
  } catch (err: any) {
    // If migration failed due to already-existing index or table, log info but don't crash
    if (err?.code === "ER_DUP_KEYNAME" || err?.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("[migrate] database schema already contains migration keys/tables:", err.sqlMessage || err.message);
      migrationRan = true;
    } else {
      console.warn("[migrate] migration runner notice:", err?.message || err);
    }
  }

  // 2. Direct safety layer only if migration did not run
  if (!migrationRan) {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS \`watchlists\` (
          \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
          \`userId\` bigint unsigned NOT NULL,
          \`name\` varchar(128) NOT NULL DEFAULT 'My Watchlist',
          \`description\` varchar(255),
          \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (\`id\`)
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
          PRIMARY KEY (\`id\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      console.log("[migrate] core database tables verified");
    } catch (err) {
      console.warn("[migrate] Direct table ensure notice:", err);
    }
  }
}


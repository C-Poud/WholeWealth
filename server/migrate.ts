import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { env } from "./lib/env";

/**
 * Applies pending SQL migrations at server startup.
 * The database is reachable only from the deployed runtime, so migrations
 * cannot be pushed from a dev sandbox — running them here guarantees the
 * schema exists before the app serves traffic.
 */
export async function runMigrations() {
  const db = drizzle(env.databaseUrl);
  // Resolved relative to the bundled dist/boot.js at runtime —
  // Docker copies server/db to /app/server/db.
  const migrationsFolder = new URL("../server/db/migrations", import.meta.url)
    .pathname;
  await migrate(db, { migrationsFolder });
  console.log("[migrate] database schema is up to date");
}

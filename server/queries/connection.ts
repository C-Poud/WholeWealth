import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

let instance: ReturnType<typeof drizzle<typeof fullSchema>> | null = null;

export function getDb() {
  if (!instance && env.databaseUrl && env.databaseUrl.trim().length > 0) {
    try {
      instance = drizzle(env.databaseUrl, {
        mode: "planetscale",
        schema: fullSchema,
      });
    } catch (err) {
      console.warn("[AI Studio] Database connection init failed:", err);
    }
  }
  return instance;
}

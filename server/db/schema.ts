import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  bigint,
  boolean,
  double,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: serial("id").primaryKey(),
  unionId: varchar("unionId", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 320 }),
  avatar: text("avatar"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
  lastSignInAt: timestamp("lastSignInAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// TODO: Add your tables here. See docs/Database.md for schema examples and patterns.
//
// Example:
// export const posts = mysqlTable("posts", {
//   id: serial("id").primaryKey(),
//   title: varchar("title", { length: 255 }).notNull(),
//   content: text("content"),
//   createdAt: timestamp("created_at").notNull().defaultNow(),
// });
//
// Note: FK columns referencing a serial() PK must use:
//   bigint("columnName", { mode: "number", unsigned: true }).notNull()

// ---------------------------------------------------------------------------
// WheelDesk tables
// ---------------------------------------------------------------------------

/** App-level settings (admin managed). Holds e.g. SnapTrade credentials. */
export const appSettings = mysqlTable("app_settings", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  value: text("value"),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
});
export type AppSetting = typeof appSettings.$inferSelect;

/** Per-user SnapTrade identity (userId + userSecret from SnapTrade). */
export const snaptradeIdentities = mysqlTable(
  "snaptrade_identities",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    snaptradeUserId: varchar("snaptradeUserId", { length: 255 }).notNull(),
    userSecret: varchar("userSecret", { length: 512 }).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: uniqueIndex("st_identity_user_idx").on(t.userId),
  }),
);
export type SnaptradeIdentity = typeof snaptradeIdentities.$inferSelect;

/** Brokerage accounts synced through SnapTrade (or created for imports). */
export const brokerAccounts = mysqlTable(
  "broker_accounts",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    snaptradeAccountId: varchar("snaptradeAccountId", { length: 64 }),
    name: varchar("name", { length: 255 }),
    institution: varchar("institution", { length: 255 }),
    number: varchar("number", { length: 64 }),
    cash: double("cash"),
    currency: varchar("currency", { length: 8 }).default("USD"),
    /** Whether this account's positions count toward the portfolio. */
    enabled: boolean("enabled").default(true).notNull(),
    source: mysqlEnum("source", ["snaptrade", "import", "demo"])
      .default("import")
      .notNull(),
    lastSyncedAt: timestamp("lastSyncedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("accounts_user_idx").on(t.userId),
    stIdx: uniqueIndex("accounts_st_idx").on(t.snaptradeAccountId),
  }),
);
export type BrokerAccount = typeof brokerAccounts.$inferSelect;

/** Positions (stocks & options) — synced, imported, manual or demo. */
export const positions = mysqlTable(
  "positions",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    accountId: bigint("accountId", { mode: "number", unsigned: true }),
    symbol: varchar("symbol", { length: 32 }).notNull(), // underlying ticker
    description: varchar("description", { length: 255 }),
    assetType: mysqlEnum("assetType", ["stock", "option", "etf", "other"])
      .default("stock")
      .notNull(),
    quantity: double("quantity").notNull(),
    costBasis: double("costBasis"), // per-unit average cost
    price: double("price"), // last known price
    currency: varchar("currency", { length: 8 }).default("USD"),
    source: mysqlEnum("source", ["snaptrade", "import", "manual", "demo"])
      .default("manual")
      .notNull(),
    // option-specific
    optionType: mysqlEnum("optionType", ["call", "put"]),
    strike: double("strike"),
    expiry: varchar("expiry", { length: 10 }), // YYYY-MM-DD
    rawSymbol: varchar("rawSymbol", { length: 64 }),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("positions_user_idx").on(t.userId),
    symbolIdx: index("positions_symbol_idx").on(t.userId, t.symbol),
  }),
);
export type Position = typeof positions.$inferSelect;

/** User-curated watchlists. */
export const watchlists = mysqlTable(
  "watchlists",
  {
    id: serial("id").primaryKey(),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 128 }).notNull().default("My Watchlist"),
    description: varchar("description", { length: 255 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("watchlists_user_idx").on(t.userId),
  }),
);
export type Watchlist = typeof watchlists.$inferSelect;

/** Individual ticker items in a user watchlist. */
export const watchlistItems = mysqlTable(
  "watchlist_items",
  {
    id: serial("id").primaryKey(),
    watchlistId: bigint("watchlistId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => watchlists.id),
    userId: bigint("userId", { mode: "number", unsigned: true })
      .notNull()
      .references(() => users.id),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    notes: varchar("notes", { length: 255 }),
    targetStrike: double("targetStrike"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (t) => ({
    watchlistIdx: index("watchlist_items_wl_idx").on(t.watchlistId),
    userSymIdx: index("watchlist_items_user_sym_idx").on(t.watchlistId, t.symbol),
  }),
);
export type WatchlistItem = typeof watchlistItems.$inferSelect;

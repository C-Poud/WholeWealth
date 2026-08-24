import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { positions } from "@db/schema";
import { lookupSymbolInfo } from "./analytics/symbolInfo";
import {
  getOrCreateImportAccount,
  listAccounts,
  listPositions,
  replacePositionsBySource,
} from "./queries/portfolio";
import { parsePositionsFile } from "./import/parser";
import { DEMO_POSITIONS, demoSpot } from "./snaptrade/demo";

export const portfolioRouter = createRouter({
  /** Positions + accounts for the signed-in user. */
  overview: authedQuery.query(async ({ ctx }) => {
    const [rows, accounts] = await Promise.all([
      listPositions(ctx.user.id),
      listAccounts(ctx.user.id),
    ]);
    return { positions: rows, accounts };
  }),

  /** Import a broker export (IBKR CSV) or generic xlsx/csv positions file. */
  importFile: authedQuery
    .input(
      z.object({
        filename: z.string().min(1),
        dataBase64: z.string().min(8),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const buffer = Buffer.from(input.dataBase64, "base64");
      const parsed = parsePositionsFile(buffer, input.filename);
      if (parsed.positions.length === 0) {
        return { ...parsed, imported: 0, updated: 0 };
      }

      const account = await getOrCreateImportAccount(ctx.user.id);
      const db = getDb();
      const existing = await db
        .select()
        .from(positions)
        .where(
          and(eq(positions.userId, ctx.user.id), eq(positions.source, "import")),
        );

      let imported = 0;
      let updated = 0;

      for (const p of parsed.positions) {
        const match = existing.find(
          (e) =>
            e.symbol === p.symbol &&
            (e.rawSymbol ?? "") === (p.rawSymbol ?? "") &&
            (e.expiry ?? "") === (p.expiry ?? "") &&
            (e.strike ?? 0) === (p.strike ?? 0),
        );
        if (match) {
          await db
            .update(positions)
            .set({
              quantity: p.quantity,
              costBasis: p.costBasis ?? match.costBasis,
              price: p.price ?? match.price,
              description: p.description ?? match.description,
            })
            .where(eq(positions.id, match.id));
          updated++;
        } else {
          await db.insert(positions).values({
            userId: ctx.user.id,
            accountId: account.id,
            symbol: p.symbol,
            description: p.description,
            assetType: p.assetType,
            quantity: p.quantity,
            costBasis: p.costBasis ?? null,
            price: p.price ?? null,
            currency: p.currency ?? "USD",
            source: "import",
            optionType: p.optionType ?? null,
            strike: p.strike ?? null,
            expiry: p.expiry ?? null,
            rawSymbol: p.rawSymbol ?? null,
          });
          imported++;
        }
      }

      return { ...parsed, imported, updated };
    }),

  /** Manually add a stock/ETF position — name, price and type are
   *  looked up from Yahoo Finance automatically. */
  addManual: authedQuery
    .input(
      z.object({
        symbol: z.string().min(1).max(16),
        quantity: z.number().positive(),
        costBasis: z.number().positive().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const symbol = input.symbol.toUpperCase();
      const info = await lookupSymbolInfo(symbol);
      if (info === "not_found") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Couldn't find "${symbol}" on Yahoo Finance — check the ticker and try again.`,
        });
      }
      // info === null → Yahoo is rate-limiting/unreachable right now;
      // add the position anyway, quotes will fill in on next refresh.
      await getDb()
        .insert(positions)
        .values({
          userId: ctx.user.id,
          symbol,
          description: info ? (info.name ?? undefined) : undefined,
          assetType: info?.instrumentType === "ETF" ? "etf" : "stock",
          quantity: input.quantity,
          costBasis: input.costBasis ?? null,
          price: info ? info.price : null,
          currency: info?.currency ?? "USD",
          source: "manual",
        });
      return {
        ok: true,
        name: info ? info.name : null,
        price: info ? info.price : null,
      };
    }),

  /** Delete positions by id (must belong to the user). */
  remove: authedQuery
    .input(z.object({ ids: z.array(z.number()).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const mine = await db
        .select({ id: positions.id })
        .from(positions)
        .where(eq(positions.userId, ctx.user.id));
      const valid = new Set(mine.map((m) => m.id));
      const toDelete = input.ids.filter((id) => valid.has(id));
      for (const id of toDelete) {
        await db.delete(positions).where(eq(positions.id, id));
      }
      return { deleted: toDelete.length };
    }),

  /** Seed a demo portfolio (uses deterministic synthetic market data). */
  loadDemo: authedQuery.mutation(async ({ ctx }) => {
    const rows = DEMO_POSITIONS.map((p) => ({
      userId: ctx.user.id,
      symbol: p.symbol,
      description: p.description,
      assetType: "stock" as const,
      quantity: p.quantity,
      costBasis: p.costBasis,
      price: demoSpot(p.symbol),
      currency: "USD",
      source: "demo" as const,
    }));
    await replacePositionsBySource(ctx.user.id, "demo", rows);
    return { loaded: rows.length };
    }),

  /** Clear demo positions. */
  clearDemo: authedQuery.mutation(async ({ ctx }) => {
    await replacePositionsBySource(ctx.user.id, "demo", []);
    return { ok: true };
  }),
});

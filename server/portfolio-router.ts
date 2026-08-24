import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedQuery, createRouter } from "./middleware";
import { lookupSymbolInfo } from "./analytics/symbolInfo";
import {
  deletePositionsByIds,
  getOrCreateImportAccount,
  insertManualPosition,
  listAccounts,
  listPositions,
  replacePositionsBySource,
  updatePosition,
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
      const existing = await listPositions(ctx.user.id);
      const importExisting = existing.filter((e) => e.source === "import");

      let imported = 0;
      let updated = 0;
      const rowsToInsert: Array<Parameters<typeof insertManualPosition>[1]> = [];

      for (const p of parsed.positions) {
        const match = importExisting.find(
          (e) =>
            e.symbol === p.symbol &&
            (e.rawSymbol ?? "") === (p.rawSymbol ?? "") &&
            (e.expiry ?? "") === (p.expiry ?? "") &&
            (e.strike ?? 0) === (p.strike ?? 0),
        );
        if (match) {
          updated++;
        } else {
          rowsToInsert.push({
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

      for (const row of rowsToInsert) {
        await insertManualPosition(ctx.user.id, row);
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
      await insertManualPosition(ctx.user.id, {
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
      const mine = await listPositions(ctx.user.id);
      const valid = new Set(mine.map((m) => m.id));
      const toDelete = input.ids.filter((id) => valid.has(id));
      await deletePositionsByIds(ctx.user.id, toDelete);
      return { deleted: toDelete.length };
    }),

  /** Update quantity, cost basis, or account for a position. */
  update: authedQuery
    .input(
      z.object({
        id: z.number(),
        quantity: z.number().positive().optional(),
        costBasis: z.number().positive().nullable().optional(),
        accountId: z.number().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      await updatePosition(ctx.user.id, id, data);
      return { ok: true };
    }),

  /** Move a position to a different account. */
  movePosition: authedQuery
    .input(
      z.object({
        positionId: z.number(),
        targetAccountId: z.number().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await updatePosition(ctx.user.id, input.positionId, {
        accountId: input.targetAccountId,
      });
      return { ok: true };
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

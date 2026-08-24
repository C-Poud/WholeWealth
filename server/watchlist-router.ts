import { z } from "zod";
import { authedQuery, createRouter } from "./middleware";
import {
  listUserWatchlists,
  getWatchlistWithItems,
  createWatchlist,
  deleteWatchlist,
  addWatchlistSymbol,
  removeWatchlistSymbol,
} from "./queries/watchlist";
import { getWatchlistQuotes, type WatchlistQuote } from "./analytics/yahoo";

export const watchlistRouter = createRouter({
  /** Lists all user watchlists */
  list: authedQuery.query(async ({ ctx }) => {
    const lists = await listUserWatchlists(ctx.user.id);
    return lists;
  }),

  /** Get a watchlist by ID with live enriched quotes & metrics */
  get: authedQuery
    .input(z.object({ watchlistId: z.number().optional() }))
    .query(async ({ ctx, input }) => {
      let targetId = input.watchlistId;
      if (!targetId) {
        const lists = await listUserWatchlists(ctx.user.id);
        if (lists.length === 0) return null;
        targetId = lists[0].id;
      }

      const res = await getWatchlistWithItems(ctx.user.id, targetId);
      if (!res) return null;

      const symbols = res.items.map((i) => i.symbol);
      let quotes: Record<string, WatchlistQuote> = {};
      try {
        quotes = await getWatchlistQuotes(symbols);
      } catch (err) {
        console.warn("[watchlist] quotes fetch error:", err);
      }

      const enrichedItems = await Promise.all(
        res.items.map(async (item) => {
          const sym = item.symbol.toUpperCase();
          const q = quotes[sym];

          const beta = q?.beta ?? 1.0;
          return {
            id: item.id,
            watchlistId: item.watchlistId,
            symbol: sym,
            name: q?.name ?? sym,
            notes: item.notes,
            targetStrike: item.targetStrike,
            price: q?.price ?? null,
            change: q?.change ?? 0,
            changePct: q?.changePct ?? 0,
            ytdChangePct: q?.ytdChangePct ?? null,
            dayHigh: q?.dayHigh ?? null,
            dayLow: q?.dayLow ?? null,
            volume: q?.volume ?? null,
            beta,
            fiftyTwoWeekHigh: q?.fiftyTwoWeekHigh ?? null,
            fiftyTwoWeekLow: q?.fiftyTwoWeekLow ?? null,
            fiftyTwoWeekPos: q?.fiftyTwoWeekPos ?? null,
            ivRank: q?.ivRank ?? null,
            iv30: q?.iv30 ?? null,
            createdAt: item.createdAt,
          };
        }),
      );

      return {
        watchlist: res.watchlist,
        items: enrichedItems,
      };
    }),

  /** Create a new watchlist */
  create: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(128),
        description: z.string().max(255).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await createWatchlist(
        ctx.user.id,
        input.name,
        input.description,
      );
      return created;
    }),

  /** Delete a watchlist */
  delete: authedQuery
    .input(z.object({ watchlistId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const ok = await deleteWatchlist(ctx.user.id, input.watchlistId);
      return { ok };
    }),

  /** Add a ticker symbol to a watchlist */
  addSymbol: authedQuery
    .input(
      z.object({
        watchlistId: z.number(),
        symbol: z.string().min(1).max(16),
        notes: z.string().max(255).optional(),
        targetStrike: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const item = await addWatchlistSymbol(
        ctx.user.id,
        input.watchlistId,
        input.symbol,
        input.notes,
        input.targetStrike,
      );
      return item;
    }),

  /** Remove a ticker symbol from a watchlist */
  removeSymbol: authedQuery
    .input(
      z.object({
        watchlistId: z.number(),
        symbol: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ok = await removeWatchlistSymbol(
        ctx.user.id,
        input.watchlistId,
        input.symbol,
      );
      return { ok };
    }),
});

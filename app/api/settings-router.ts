import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedQuery, createRouter } from "./middleware";
import { getSetting, setSetting } from "./queries/portfolio";
import { checkApiStatus } from "./snaptrade/client";
import { env } from "./lib/env";

function requireOwnerOrAdmin(user: { role: string; unionId: string }) {
  if (user.role !== "admin" && user.unionId !== env.ownerUnionId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the app owner or an admin can manage integration settings.",
    });
  }
}

function mask(v: string): string {
  if (v.length <= 6) return "••••••";
  return `${v.slice(0, 3)}••••••${v.slice(-3)}`;
}

export const settingsRouter = createRouter({
  /** SnapTrade integration status (owner/admin only). */
  get: authedQuery.query(async ({ ctx }) => {
    requireOwnerOrAdmin(ctx.user);
    const stored = await getSetting("snaptrade");
    const parsed = stored
      ? (JSON.parse(stored) as { clientId?: string; consumerKey?: string })
      : {};
    const envClient = process.env.SNAPTRADE_CLIENT_ID ?? "";
    const envKey = process.env.SNAPTRADE_CONSUMER_KEY ?? "";

    const clientId = parsed.clientId?.trim() || envClient;
    const consumerKey = parsed.consumerKey?.trim() || envKey;

    return {
      configured: !!(clientId && consumerKey),
      source: parsed.clientId ? "settings" : envClient ? "env" : null,
      clientIdMasked: clientId ? mask(clientId) : null,
      consumerKeySet: !!consumerKey,
    };
  }),

  /** Save SnapTrade credentials and verify them against the API. */
  setSnaptrade: authedQuery
    .input(
      z.object({
        clientId: z.string().trim().min(1),
        consumerKey: z.string().trim().min(1),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      requireOwnerOrAdmin(ctx.user);
      // Verify credentials against the SnapTrade API before saving.
      const status = await checkApiStatus({
        clientId: input.clientId,
        consumerKey: input.consumerKey,
      }).catch((e) => {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Could not verify credentials with SnapTrade: ${e instanceof Error ? e.message : "unknown error"}`,
        });
      });

      await setSetting(
        "snaptrade",
        JSON.stringify({
          clientId: input.clientId,
          consumerKey: input.consumerKey,
        }),
      );
      return { ok: true, apiOnline: status.online ?? true };
    }),

  /** Remove stored credentials (env vars, if any, still apply). */
  clearSnaptrade: authedQuery.mutation(async ({ ctx }) => {
    requireOwnerOrAdmin(ctx.user);
    await setSetting("snaptrade", null);
    return { ok: true };
  }),
});

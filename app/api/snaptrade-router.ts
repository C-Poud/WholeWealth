import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedQuery, createRouter } from "./middleware";
import {
  deleteIdentity,
  getIdentity,
  listAccounts,
  replacePositionsBySource,
  saveIdentity,
  upsertSnaptradeAccount,
} from "./queries/portfolio";
import {
  getConnectionPortalLink,
  getSnaptradeConfig,
  listAccountPositions,
  listAccounts as stListAccounts,
  registerSnaptradeUser,
} from "./snaptrade/client";
import crypto from "node:crypto";

export const snaptradeRouter = createRouter({
  /** Integration + connection status for the current user. */
  status: authedQuery.query(async ({ ctx }) => {
    const config = await getSnaptradeConfig();
    const identity = await getIdentity(ctx.user.id);
    const accounts = identity ? await listAccounts(ctx.user.id) : [];
    const stAccounts = accounts.filter((a) => a.source === "snaptrade");
    const lastSync = stAccounts
      .map((a) => a.lastSyncedAt?.getTime() ?? 0)
      .reduce((a, b) => Math.max(a, b), 0);
    return {
      configured: !!config,
      registered: !!identity,
      accountCount: stAccounts.length,
      lastSyncedAt: lastSync ? new Date(lastSync) : null,
    };
  }),

  /**
   * Ensures a SnapTrade user exists for this account and returns a
   * Connection Portal URL (valid ~5 minutes) to link a brokerage.
   */
  connect: authedQuery
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      const config = await getSnaptradeConfig();
      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "SnapTrade is not configured. Add your Client ID and Consumer Key in Settings.",
        });
      }

      let identity = await getIdentity(ctx.user.id);
      if (!identity) {
        const snaptradeUserId = `wd_${ctx.user.id}_${crypto.randomBytes(6).toString("hex")}`;
        const registered = await registerSnaptradeUser(config, snaptradeUserId);
        if (!registered.userSecret) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "SnapTrade did not return a user secret.",
          });
        }
        await saveIdentity(ctx.user.id, registered.userId, registered.userSecret);
        identity = await getIdentity(ctx.user.id);
      }
      if (!identity) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Identity save failed" });
      }

      const portal = await getConnectionPortalLink(
        config,
        identity.snaptradeUserId,
        identity.userSecret,
        `${input.origin}/portfolio?connected=1`,
      );
      if (!portal.redirectURI) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "SnapTrade did not return a Connection Portal URL.",
        });
      }
      return { url: portal.redirectURI };
    }),

  /** Pull accounts + positions from SnapTrade and replace synced data. */
  sync: authedQuery.mutation(async ({ ctx }) => {
    const config = await getSnaptradeConfig();
    const identity = await getIdentity(ctx.user.id);
    if (!config || !identity) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Connect a brokerage first.",
      });
    }

    const accounts = await stListAccounts(
      config,
      identity.snaptradeUserId,
      identity.userSecret,
    );

    let imported = 0;
    const rows: Array<{
      userId: number;
      accountId: number;
      symbol: string;
      description?: string;
      assetType: "stock" | "option" | "etf" | "other";
      quantity: number;
      costBasis?: number | null;
      price?: number | null;
      currency?: string;
      source: "snaptrade";
      optionType?: "call" | "put";
      strike?: number | null;
      expiry?: string | null;
      rawSymbol?: string;
    }> = [];

    for (const acc of accounts) {
      const dbAcc = await upsertSnaptradeAccount(ctx.user.id, {
        snaptradeAccountId: acc.id,
        name: acc.name ?? "Brokerage account",
        institution: acc.institution_name ?? undefined,
        number: acc.number ?? undefined,
        cash: acc.balance?.total?.amount ?? null,
        currency: acc.balance?.total?.currency ?? "USD",
      });

      const stPositions = await listAccountPositions(
        config,
        acc.id,
        identity.snaptradeUserId,
        identity.userSecret,
      );

      for (const p of stPositions) {
        const units = p.units ?? 0;
        if (!units) continue;
        const opt = p.symbol?.option_symbol;
        const symObj = p.symbol?.symbol;
        const baseSymbol = (
          opt?.underlying_symbol?.symbol ??
          symObj?.symbol ??
          p.symbol?.raw_symbol ??
          ""
        ).toUpperCase();
        if (!baseSymbol) continue;

        if (opt) {
          rows.push({
            userId: ctx.user.id,
            accountId: dbAcc.id,
            symbol: baseSymbol,
            description: symObj?.description ?? undefined,
            assetType: "option",
            quantity: units,
            costBasis: p.average_purchase_price ?? null,
            price: p.price ?? null,
            currency: p.currency?.code ?? "USD",
            source: "snaptrade",
            optionType: String(opt.option_type ?? "").toUpperCase() === "PUT" ? "put" : "call",
            strike: opt.strike_price ?? null,
            expiry: opt.expiration_date ?? null,
            rawSymbol: opt.ticker ?? p.symbol?.raw_symbol ?? undefined,
          });
        } else {
          const typeCode = symObj?.security_type?.code?.toLowerCase() ?? "";
          rows.push({
            userId: ctx.user.id,
            accountId: dbAcc.id,
            symbol: baseSymbol,
            description: symObj?.description ?? undefined,
            assetType: typeCode === "etf" ? "etf" : "stock",
            quantity: units,
            costBasis: p.average_purchase_price ?? null,
            price: p.price ?? null,
            currency: p.currency?.code ?? "USD",
            source: "snaptrade",
          });
        }
        imported++;
      }
    }

    await replacePositionsBySource(ctx.user.id, "snaptrade", rows);
    return { accounts: accounts.length, positions: imported };
  }),

  /** Remove the SnapTrade identity and all synced data. */
  disconnect: authedQuery.mutation(async ({ ctx }) => {
    await deleteIdentity(ctx.user.id);
    await replacePositionsBySource(ctx.user.id, "snaptrade", []);
    return { ok: true };
  }),
});

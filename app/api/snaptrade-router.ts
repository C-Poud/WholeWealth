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
  listAllAccountPositions,
  listAccounts as stListAccounts,
  registerSnaptradeUser,
  SnaptradeError,
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

  /**
   * Pull accounts + positions from SnapTrade and replace synced data.
   * Uses the modern /accounts/{id}/positions/all endpoint which returns
   * stocks, ETFs AND option contracts (the legacy /positions endpoint
   * silently omits options). A 503 means the brokerage's initial sync is
   * still running — we report that as syncBusy instead of failing.
   */
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
    let syncBusy = false;
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

    const num = (v: unknown): number | null => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };

    for (const acc of accounts) {
      const dbAcc = await upsertSnaptradeAccount(ctx.user.id, {
        snaptradeAccountId: acc.id,
        name: acc.name ?? "Brokerage account",
        institution: acc.institution_name ?? undefined,
        number: acc.number ?? undefined,
        cash: acc.balance?.total?.amount ?? null,
        currency: acc.balance?.total?.currency ?? "USD",
      });

      let items: Awaited<ReturnType<typeof listAllAccountPositions>>;
      try {
        items = await listAllAccountPositions(
          config,
          acc.id,
          identity.snaptradeUserId,
          identity.userSecret,
        );
      } catch (err) {
        if (err instanceof SnaptradeError && err.status === 503) {
          // Brokerage is still performing its initial sync — try again shortly.
          syncBusy = true;
          continue;
        }
        throw err;
      }

      for (const p of items) {
        const units = num(p.units) ?? 0;
        if (!units) continue;
        const inst = p.instrument ?? {};
        const kind = (inst.kind ?? "").toLowerCase();
        const price = num(p.price);
        const costBasis = num(p.cost_basis);
        const currency = p.currency ?? "USD";

        if (kind === "option") {
          const underlying = (
            inst.underlying?.symbol ??
            inst.underlying?.raw_symbol ??
            ""
          ).toUpperCase();
          if (!underlying) continue;
          rows.push({
            userId: ctx.user.id,
            accountId: dbAcc.id,
            symbol: underlying,
            description: inst.description ?? undefined,
            assetType: "option",
            quantity: units,
            costBasis,
            price,
            currency,
            source: "snaptrade",
            optionType:
              String(inst.option_type ?? "").toUpperCase() === "PUT" ? "put" : "call",
            strike: num(inst.strike_price),
            expiry: inst.expiration_date ?? null,
            rawSymbol: inst.symbol ?? inst.raw_symbol ?? undefined,
          });
        } else {
          const baseSymbol = (inst.raw_symbol ?? inst.symbol ?? "").toUpperCase();
          if (!baseSymbol) continue;
          rows.push({
            userId: ctx.user.id,
            accountId: dbAcc.id,
            symbol: baseSymbol,
            description: inst.description ?? undefined,
            assetType: kind === "etf" ? "etf" : kind === "stock" ? "stock" : "other",
            quantity: units,
            costBasis,
            price,
            currency,
            source: "snaptrade",
          });
        }
        imported++;
      }
    }

    await replacePositionsBySource(ctx.user.id, "snaptrade", rows);
    // Real data landed — drop the demo sample positions.
    if (rows.length > 0) {
      await replacePositionsBySource(ctx.user.id, "demo", []);
    }
    return { accounts: accounts.length, positions: imported, syncBusy };
  }),

  /** Remove the SnapTrade identity and all synced data. */
  disconnect: authedQuery.mutation(async ({ ctx }) => {
    await deleteIdentity(ctx.user.id);
    await replacePositionsBySource(ctx.user.id, "snaptrade", []);
    return { ok: true };
  }),
});

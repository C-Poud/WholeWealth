import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { authedQuery, createRouter } from "./middleware";
import {
  clearDemoData,
  deleteAccount,
  deleteIdentity,
  getIdentity,
  listAccounts,
  replacePositionsBySource,
  saveIdentity,
  setAccountEnabled,
  upsertSnaptradeAccount,
} from "./queries/portfolio";
import {
  getConnectionPortalLink,
  getSnaptradeConfig,
  listAllAccountPositions,
  listAccounts as stListAccounts,
  getAccountBalances,
  registerSnaptradeUser,
  SnaptradeError,
} from "./snaptrade/client";
import { getAudToUsdRate } from "./analytics/yahoo";
import { getBrokerFiguresForUser } from "./snaptrade/balances";
import crypto from "node:crypto";

export function isAussieBroker(
  institution?: string | null,
  accountName?: string | null,
): boolean {
  const text = `${institution ?? ""} ${accountName ?? ""}`.toLowerCase();
  const aussieKeywords = [
    "stake",
    "superhero",
    "commsec",
    "commonwealth bank",
    "nabtrade",
    "national australia bank",
    "anz",
    "westpac",
    "selfwealth",
    "pearler",
    "cmc markets",
    "cmc",
    "ig australia",
    "moomoo au",
    "tiger au",
    "australia",
    "australian",
    "asx",
    "(au)",
    "au broker",
  ];
  return aussieKeywords.some((kw) => text.includes(kw));
}

/**
 * Accurately extracts per-unit (per-share or per-contract) cost basis from SnapTrade position payload.
 * Handles:
 * 1. average_purchase_price / avg_cost / open_price (direct per-share basis)
 * 2. tax_lots (lot-weighted purchase price)
 * 3. cost_basis / book_value (normalizing total dollar cost to per-unit cost when needed)
 */
export function extractPositionCostBasis(
  p: any,
  units: number,
  price: number | null,
  isOption: boolean,
): number | null {
  const toNum = (v: unknown): number | null => {
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // 1. Direct per-share / per-unit average purchase price fields
  const directPerUnit = toNum(
    p.average_purchase_price ??
      p.avg_cost ??
      p.avg_purchase_price ??
      p.open_price ??
      p.unit_cost,
  );
  if (directPerUnit != null && directPerUnit > 0) {
    if (isOption && price != null && price > 0 && directPerUnit > price * 20) {
      return +(directPerUnit / 100).toFixed(4);
    }
    return +directPerUnit.toFixed(4);
  }

  // 2. Tax lots weighted average
  if (Array.isArray(p.tax_lots) && p.tax_lots.length > 0) {
    let totalQty = 0;
    let totalDollarCost = 0;
    for (const lot of p.tax_lots) {
      const lotQty = Math.abs(toNum(lot.quantity ?? lot.units) ?? 0);
      const lotPrice = toNum(lot.purchased_price ?? lot.purchase_price ?? lot.price);
      const lotCost = toNum(lot.cost_basis ?? lot.total_cost);
      if (lotQty > 0) {
        if (lotPrice != null && lotPrice > 0) {
          totalDollarCost += lotQty * lotPrice;
          totalQty += lotQty;
        } else if (lotCost != null && lotCost > 0) {
          totalDollarCost += lotCost;
          totalQty += lotQty;
        }
      }
    }
    if (totalQty > 0 && totalDollarCost > 0) {
      const avg = totalDollarCost / totalQty;
      if (isOption && price != null && price > 0 && avg > price * 20) {
        return +(avg / 100).toFixed(4);
      }
      return +avg.toFixed(4);
    }
  }

  // 3. Fallback to cost_basis / book_value / book_cost / total_cost
  const rawCostBasis = toNum(
    p.cost_basis ?? p.book_value ?? p.book_cost ?? p.total_cost,
  );
  if (rawCostBasis != null && rawCostBasis > 0) {
    const absUnits = Math.abs(units);
    if (!isOption) {
      if (absUnits > 0) {
        if (price != null && price > 0) {
          const perUnit = rawCostBasis / absUnits;
          if (absUnits > 1 && Math.abs(perUnit - price) < Math.abs(rawCostBasis - price)) {
            return +perUnit.toFixed(4);
          }
          if (rawCostBasis > price * 1.5 && absUnits > 1.2) {
            return +perUnit.toFixed(4);
          }
        } else if (absUnits > 1 && rawCostBasis > 500) {
          return +(rawCostBasis / absUnits).toFixed(4);
        }
      }
      return +rawCostBasis.toFixed(4);
    } else {
      // Option position
      if (absUnits > 0) {
        if (price != null && price > 0) {
          const perShare100 = rawCostBasis / (absUnits * 100);
          const perContract = rawCostBasis / absUnits;
          if (Math.abs(perShare100 - price) < Math.abs(rawCostBasis - price)) {
            return +perShare100.toFixed(4);
          }
          if (Math.abs(perContract - price) < Math.abs(rawCostBasis - price)) {
            return +perContract.toFixed(4);
          }
        }
        if (rawCostBasis > 30) {
          return +(rawCostBasis / (absUnits * 100)).toFixed(4);
        }
      }
      return +rawCostBasis.toFixed(4);
    }
  }

  return null;
}

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

    const audUsdRate = await getAudToUsdRate();

    for (const acc of accounts) {
      const isAussie = isAussieBroker(acc.institution_name, acc.name);
      let rawCash: number | null = null;
      let accCurrency = String(acc.balance?.total?.currency ?? "USD").toUpperCase();

      // Fetch actual cash balance from SnapTrade /balances endpoint
      try {
        const balData = await getAccountBalances(
          config,
          acc.id,
          identity.snaptradeUserId,
          identity.userSecret,
        );
        const balList: any[] = Array.isArray(balData) ? balData : balData ? [balData] : [];
        for (const b of balList) {
          if (!b) continue;
          const curr = String(b.currency?.code ?? b.currency ?? accCurrency).toUpperCase();
          const cashVal = typeof b.cash === "number" ? b.cash : (b.cash?.amount ?? b.amount ?? null);
          if (cashVal != null && Number.isFinite(Number(cashVal))) {
            rawCash = (rawCash ?? 0) + Number(cashVal);
            accCurrency = curr;
          }
        }
      } catch (err) {
        console.warn(`[snaptrade-sync] Could not fetch balances for account ${acc.id}:`, err);
      }

      // If pulling AUD on a US broker (not an Aussie broker), convert AUD to USD.
      // If it's an Aussie broker pulling AUD, leave it untouched.
      if (accCurrency === "AUD" && !isAussie) {
        if (rawCash != null) {
          rawCash = +(rawCash * audUsdRate).toFixed(2);
        }
        accCurrency = "USD";
      }

      const dbAcc = await upsertSnaptradeAccount(ctx.user.id, {
        snaptradeAccountId: acc.id,
        name: acc.name ?? "Brokerage account",
        institution: acc.institution_name ?? undefined,
        number: acc.number ?? undefined,
        cash: rawCash,
        currency: accCurrency,
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
        const inst = (p.instrument ?? {}) as any;
        const kind = (inst.kind ?? "").toLowerCase();
        const isOption = kind === "option" || !!inst.option_type;
        let price = num(p.price);
        let costBasis = extractPositionCostBasis(p, units, price, isOption);

        // Extract currency safely (p.currency could be string or object { code: string })
        const rawCurr =
          typeof p.currency === "object" && p.currency !== null
            ? (p.currency.code ?? p.currency.currency ?? "USD")
            : p.currency;
        let currency = String(rawCurr ?? accCurrency ?? "USD").toUpperCase();

        // If pulling AUD on a US broker, convert position price & costBasis to USD.
        // If it's an Aussie broker pulling AUD, leave it untouched.
        if (currency === "AUD" && !isAussie) {
          if (price != null) price = +(price * audUsdRate).toFixed(2);
          if (costBasis != null) costBasis = +(costBasis * audUsdRate).toFixed(2);
          currency = "USD";
        }

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
    // Real SnapTrade data connected/synced — purge all demo sample data (positions + demo accounts).
    if (accounts.length > 0 || rows.length > 0) {
      await clearDemoData(ctx.user.id);
    }
    return { accounts: accounts.length, positions: imported, syncBusy };
  }),

  /** This user's connected accounts with their enabled flags. */
  accounts: authedQuery.query(async ({ ctx }) => {
    const accounts = await listAccounts(ctx.user.id);
    return accounts.map((a) => ({
      id: Number(a.id),
      name: a.name ?? "Brokerage account",
      institution: a.institution ?? null,
      number: a.number ?? null,
      cash: a.cash ?? null,
      currency: a.currency ?? "USD",
      source: a.source,
      enabled: a.enabled,
      lastSyncedAt: a.lastSyncedAt ?? null,
    }));
  }),

  /** Include/exclude an account's positions from the portfolio. */
  setAccountEnabled: authedQuery
    .input(z.object({ accountId: z.number(), enabled: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await setAccountEnabled(ctx.user.id, input.accountId, input.enabled);
      return { ok: true };
    }),

  /** Delete a connected account and its positions completely. */
  deleteAccount: authedQuery
    .input(z.object({ accountId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await deleteAccount(ctx.user.id, input.accountId);
      return { ok: true };
    }),

  /** Pull broker-reported figures: Total Account Value, Multi-Currency Cash & Buying Power */
  brokerFigures: authedQuery.query(async ({ ctx }) => {
    return await getBrokerFiguresForUser(ctx.user.id);
  }),

  /** Remove the SnapTrade identity and all synced data. */
  disconnect: authedQuery.mutation(async ({ ctx }) => {
    await deleteIdentity(ctx.user.id);
    await replacePositionsBySource(ctx.user.id, "snaptrade", []);
    return { ok: true };
  }),
});

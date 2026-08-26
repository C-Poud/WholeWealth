import {
  getSnaptradeConfig,
  getAccountBalances,
  getAccount,
  listAccounts as stListAccounts,
} from "./client";
import { getIdentity, listAccounts, listPositions } from "../queries/portfolio";
import { getAudToUsdRate } from "../analytics/yahoo";

export interface CurrencyBalanceItem {
  currency: string;
  amount: number;
  formatted: string;
}

export interface BrokerFigures {
  totalAccountValue: number;
  totalAccountValueFormatted: string;
  totalCurrency: string;
  cashBalances: CurrencyBalanceItem[];
  buyingPowerBalances: CurrencyBalanceItem[];
  isBrokerReported: boolean;
  institution?: string | null;
  lastSyncedAt?: Date | string | null;
  accountsCount: number;
}

export function formatCurrencyFigure(amount: number, currency = "USD"): string {
  const code = (currency || "USD").toUpperCase();
  const abs = Math.abs(amount);
  const formattedNum = abs.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";

  switch (code) {
    case "AUD":
      return `${sign}A$${formattedNum}`;
    case "USD":
      return `${sign}$${formattedNum}`;
    case "CAD":
      return `${sign}C$${formattedNum}`;
    case "GBP":
      return `${sign}£${formattedNum}`;
    case "EUR":
      return `${sign}€${formattedNum}`;
    case "NZD":
      return `${sign}NZ$${formattedNum}`;
    case "SGD":
      return `${sign}S$${formattedNum}`;
    case "HKD":
      return `${sign}HK$${formattedNum}`;
    case "JPY":
      return `${sign}¥${Math.round(abs).toLocaleString("en-US")}`;
    default:
      return `${sign}${code} ${formattedNum}`;
  }
}

export async function getBrokerFiguresForUser(userId: number): Promise<BrokerFigures> {
  const config = await getSnaptradeConfig();
  const identity = await getIdentity(userId);
  const localAccounts = await listAccounts(userId);
  const hasDemo = localAccounts.some((a) => a.source === "demo");
  const positions = await listPositions(userId);
  const audUsdRate = await getAudToUsdRate();

  // Calculate market value of all loaded positions
  let positionsMarketValueUsd = 0;
  for (const p of positions) {
    const px = p.price ?? p.costBasis ?? 0;
    const isOption = p.assetType === "option";
    const multiplier = isOption ? 100 : 1;
    let posVal = p.quantity * px * multiplier;
    if (String(p.currency ?? "USD").toUpperCase() === "AUD") {
      posVal = posVal * audUsdRate;
    }
    if (posVal > 0) {
      positionsMarketValueUsd += posVal;
    }
  }

  // 1. If user has active SnapTrade connection and config, fetch live or synced balances
  if (config && identity) {
    try {
      const snaptradeAccounts = await stListAccounts(
        config,
        identity.snaptradeUserId,
        identity.userSecret,
      );

      if (snaptradeAccounts && snaptradeAccounts.length > 0) {
        let brokerReportedTotalUsd = 0;
        const cashMap = new Map<string, number>();
        const bpMap = new Map<string, number>();
        let mainCurrency = "USD";
        let institutionName = snaptradeAccounts[0]?.institution_name || "Connected Broker";

        for (const acc of snaptradeAccounts) {
          if (acc.institution_name) institutionName = acc.institution_name;

          // Attempt to fetch fresh individual account detail for accurate total market value
          let accTotalAmount: number | null = null;
          let accTotalCurrency = "USD";

          try {
            const accDetail = await getAccount(
              config,
              acc.id,
              identity.snaptradeUserId,
              identity.userSecret,
            );
            if (accDetail?.balance?.total?.amount != null) {
              const amt = Number(accDetail.balance.total.amount);
              if (Number.isFinite(amt) && amt > 0) {
                accTotalAmount = amt;
                accTotalCurrency = String(accDetail.balance.total.currency ?? "USD").toUpperCase();
              }
            }
          } catch {
            // fallback to listAccounts balance
            if (acc.balance?.total?.amount != null) {
              const amt = Number(acc.balance.total.amount);
              if (Number.isFinite(amt) && amt > 0) {
                accTotalAmount = amt;
                accTotalCurrency = String(acc.balance.total.currency ?? "USD").toUpperCase();
              }
            }
          }

          if (accTotalAmount != null && accTotalAmount > 0) {
            if (accTotalCurrency === "AUD") {
              brokerReportedTotalUsd += accTotalAmount * audUsdRate;
            } else {
              brokerReportedTotalUsd += accTotalAmount;
            }
            mainCurrency = accTotalCurrency;
          }

          // Fetch granular /balances endpoint for exact multi-currency cash & buying power
          try {
            const rawBal = await getAccountBalances(
              config,
              acc.id,
              identity.snaptradeUserId,
              identity.userSecret,
            );

            const balList: any[] = Array.isArray(rawBal) ? rawBal : rawBal ? [rawBal] : [];

            for (const b of balList) {
              if (!b) continue;

              const currCode = String(
                b.currency?.code ?? b.currency?.symbol ?? (typeof b.currency === "string" ? b.currency : "USD"),
              ).toUpperCase();

              // Extract cash
              let cashVal: number | null = null;
              if (typeof b.cash === "number") {
                cashVal = b.cash;
              } else if (b.cash && typeof b.cash.amount === "number") {
                cashVal = b.cash.amount;
              } else if (typeof b.amount === "number") {
                cashVal = b.amount;
              }

              if (cashVal != null && Number.isFinite(cashVal)) {
                cashMap.set(currCode, (cashMap.get(currCode) ?? 0) + cashVal);
              }

              // Extract buying power
              let bpVal: number | null = null;
              if (typeof b.buying_power === "number") {
                bpVal = b.buying_power;
              } else if (b.buying_power && typeof b.buying_power.amount === "number") {
                bpVal = b.buying_power.amount;
              } else if (cashVal != null) {
                bpVal = cashVal;
              }

              if (bpVal != null && Number.isFinite(bpVal)) {
                bpMap.set(currCode, (bpMap.get(currCode) ?? 0) + bpVal);
              }
            }
          } catch (balErr) {
            console.warn(`[balances] Failed to getAccountBalances for account ${acc.id}:`, balErr);
          }
        }

        // If cashMap is empty, try to populate from localAccounts
        if (cashMap.size === 0) {
          for (const acc of localAccounts) {
            if (acc.cash != null && acc.cash > 0) {
              const c = (acc.currency || "USD").toUpperCase();
              cashMap.set(c, (cashMap.get(c) ?? 0) + acc.cash);
              bpMap.set(c, (bpMap.get(c) ?? 0) + acc.cash);
            }
          }
        }

        // Calculate total cash in USD
        let totalCashInUsd = 0;
        for (const [curr, amt] of cashMap.entries()) {
          if (curr === "AUD") {
            totalCashInUsd += amt * audUsdRate;
          } else {
            totalCashInUsd += amt;
          }
        }

        // Total account valuation: use broker reported total if available, otherwise sum positions + cash
        let finalTotalValue = brokerReportedTotalUsd;
        if (finalTotalValue <= 0 || finalTotalValue < positionsMarketValueUsd) {
          finalTotalValue = positionsMarketValueUsd + totalCashInUsd;
        }

        const cashBalances: CurrencyBalanceItem[] = Array.from(cashMap.entries()).map(
          ([curr, amt]) => ({
            currency: curr,
            amount: +amt.toFixed(2),
            formatted: formatCurrencyFigure(amt, curr),
          }),
        );

        const buyingPowerBalances: CurrencyBalanceItem[] = Array.from(bpMap.entries()).map(
          ([curr, amt]) => ({
            currency: curr,
            amount: +amt.toFixed(2),
            formatted: formatCurrencyFigure(amt, curr),
          }),
        );

        return {
          totalAccountValue: +finalTotalValue.toFixed(2),
          totalAccountValueFormatted: formatCurrencyFigure(finalTotalValue, mainCurrency),
          totalCurrency: mainCurrency,
          cashBalances:
            cashBalances.length > 0
              ? cashBalances
              : [{ currency: "USD", amount: 0, formatted: "$0.00" }],
          buyingPowerBalances:
            buyingPowerBalances.length > 0
              ? buyingPowerBalances
              : cashBalances.length > 0
                ? cashBalances
                : [{ currency: "USD", amount: 0, formatted: "$0.00" }],
          isBrokerReported: true,
          institution: institutionName,
          lastSyncedAt: new Date(),
          accountsCount: snaptradeAccounts.length,
        };
      }
    } catch (err) {
      console.warn("[balances] Live SnapTrade balance query failed, using stored values:", err);
    }
  }

  // 2. Demo fallback
  if (hasDemo || (positions.length > 0 && positions.some((p) => p.source === "demo"))) {
    return {
      totalAccountValue: 19000.34,
      totalAccountValueFormatted: "$19,000.34",
      totalCurrency: "USD",
      cashBalances: [
        { currency: "AUD", amount: 15.64, formatted: "A$15.64" },
        { currency: "USD", amount: 174.14, formatted: "$174.14" },
      ],
      buyingPowerBalances: [
        { currency: "AUD", amount: 15.64, formatted: "A$15.64" },
        { currency: "USD", amount: 174.14, formatted: "$174.14" },
      ],
      isBrokerReported: true,
      institution: "Stake / Interactive Brokers",
      lastSyncedAt: new Date(),
      accountsCount: 1,
    };
  }

  // 3. If user has local accounts & positions
  let totalCash = 0;
  const cashByCurr = new Map<string, number>();
  for (const acc of localAccounts) {
    if (acc.enabled !== false && acc.cash != null) {
      const c = (acc.currency || "USD").toUpperCase();
      cashByCurr.set(c, (cashByCurr.get(c) ?? 0) + acc.cash);
      totalCash += acc.cash;
    }
  }

  const calculatedTotal = positionsMarketValueUsd + totalCash;
  const cashList: CurrencyBalanceItem[] = Array.from(cashByCurr.entries()).map(([curr, amt]) => ({
    currency: curr,
    amount: +amt.toFixed(2),
    formatted: formatCurrencyFigure(amt, curr),
  }));

  if (cashList.length === 0) {
    cashList.push({ currency: "USD", amount: 0, formatted: "$0.00" });
  }

  return {
    totalAccountValue: +calculatedTotal.toFixed(2),
    totalAccountValueFormatted: formatCurrencyFigure(calculatedTotal, "USD"),
    totalCurrency: "USD",
    cashBalances: cashList,
    buyingPowerBalances: cashList,
    isBrokerReported: localAccounts.some((a) => a.source === "snaptrade"),
    institution: localAccounts[0]?.institution || null,
    lastSyncedAt: localAccounts[0]?.lastSyncedAt || null,
    accountsCount: localAccounts.length,
  };
}

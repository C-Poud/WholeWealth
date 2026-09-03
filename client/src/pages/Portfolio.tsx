import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtMoney, fmtNum } from "@/lib/format";
import {
  Link2,
  RefreshCw,
  Upload,
  Plus,
  Trash2,
  FlaskConical,
  Unlink,
  ArrowRightLeft,
  Building2,
  Edit2,
  Briefcase,
  Zap,
  Activity,
  ArrowUpRight,
} from "lucide-react";
import { AddPositionModal } from "@/components/AddPositionModal";
import { CompanyLogo } from "@/components/CompanyLogo";
import { BrokerFiguresCards } from "@/components/BrokerFiguresCards";

export default function Portfolio() {
  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [prefilledSymbol, setPrefilledSymbol] = useState("");

  // Move / Edit position state
  const [editingPos, setEditingPos] = useState<{
    id: number;
    symbol: string;
    quantity: number;
    costBasis: number | null;
    accountId: number | null;
  } | null>(null);

  const status = trpc.snaptrade.status.useQuery();
  const overview = trpc.portfolio.overview.useQuery();
  const greeksQuery = trpc.analytics.portfolioGreeks.useQuery(undefined, { staleTime: 30_000 });

  const isBrokerConnected = Boolean(status.data?.registered && (status.data.accountCount > 0));

  const invalidateAll = async () => {
    await Promise.all([
      utils.portfolio.overview.invalidate(),
      utils.snaptrade.status.invalidate(),
      utils.analytics.basisSuggestions.invalidate(),
      utils.analytics.riskReports.invalidate(),
      utils.analytics.portfolioGreeks.invalidate(),
    ]);
  };

  const connectMut = trpc.snaptrade.connect.useMutation({
    onSuccess: (d) => {
      window.open(d.url, "_blank", "noopener");
      toast.info("Finish connecting in the SnapTrade portal, then click Sync.");
    },
    onError: (e) => toast.error(e.message),
  });

  const syncMut = trpc.snaptrade.sync.useMutation({
    onSuccess: async (d) => {
      if (d.positions > 0) {
        toast.success(`Synced ${d.accounts} account(s), ${d.positions} position(s).`);
      } else if (d.syncBusy) {
        toast.warning(
          "SnapTrade is still syncing your brokerage account — hit Sync again in a minute.",
        );
      } else {
        toast.warning(
          "SnapTrade returned no positions. If you just connected, the first sync can take a few minutes — try Sync again shortly.",
        );
      }
      await invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const disconnectMut = trpc.snaptrade.disconnect.useMutation({
    onSuccess: async () => {
      toast.success("Brokerage disconnected.");
      await invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const connected = searchParams.get("connected") === "1";
  useEffect(() => {
    if (connected) {
      toast.success("Brokerage connected — syncing your accounts…");
      setSearchParams({}, { replace: true });
      syncMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  const importMut = trpc.portfolio.importFile.useMutation({
    onSuccess: async (d) => {
      if (d.positions.length === 0) {
        toast.warning(d.warnings[0] ?? "No positions found in the file.");
      } else {
        toast.success(
          `Imported ${d.imported} new, updated ${d.updated} position(s) (${d.format} format).`,
        );
        d.warnings.slice(0, 3).forEach((w) => toast.warning(w));
      }
      await invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePosMut = trpc.portfolio.update.useMutation({
    onSuccess: async () => {
      toast.success("Position updated successfully.");
      setEditingPos(null);
      await invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeMut = trpc.portfolio.remove.useMutation({
    onSuccess: async () => {
      toast.success("Position removed.");
      await invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const demoMut = trpc.portfolio.loadDemo.useMutation({
    onSuccess: async () => {
      toast.success("Demo portfolio loaded.");
      await invalidateAll();
    },
    onError: (e) => toast.error(e.message),
  });

  const clearDemoMut = trpc.portfolio.clearDemo.useMutation({
    onSuccess: async () => {
      toast.success("Demo positions cleared.");
      await invalidateAll();
    },
  });

  const onFile = async (f: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = reject;
    });
    const base64 = dataUrl.split(",")[1] ?? "";
    importMut.mutate({ filename: f.name, dataBase64: base64 });
  };

  const st = status.data;
  const positions = useMemo(() => overview.data?.positions ?? [], [overview.data?.positions]);
  const accounts = useMemo(() => overview.data?.accounts ?? [], [overview.data?.accounts]);
  const _accountMap = useMemo(() => new Map(accounts.map((a) => [a.id, a])), [accounts]);

  const greeksData = greeksQuery.data;
  const greeksPosMap = useMemo(() => {
    const map = new Map<number, NonNullable<typeof greeksData>["greeks"]["positions"][0]>();
    if (greeksData?.greeks?.positions) {
      for (const p of greeksData.greeks.positions) {
        if (p.id != null) map.set(p.id, p);
      }
    }
    return map;
  }, [greeksData]);

  const metrics = useMemo(() => {
    let stockCostBasis = 0;
    let cash = 0;
    let cspCollateral = 0;
    let totalShares = 0;
    let coveredShares = 0;
    let shortCallCount = 0;
    let shortPutCount = 0;

    for (const a of accounts) if (a.enabled !== false) cash += a.cash ?? 0;

    const sharesBySym = new Map<string, number>();
    const callsBySym = new Map<string, number>();

    for (const p of positions) {
      const px = p.price ?? p.costBasis ?? 0;
      if (p.assetType === "option") {
        if (p.optionType === "put" && p.quantity < 0) {
          const strike = p.strike ?? px;
          cspCollateral += strike * 100 * Math.abs(p.quantity);
          shortPutCount += Math.abs(p.quantity);
        } else if (p.optionType === "call" && p.quantity < 0) {
          const sym = p.symbol.toUpperCase();
          callsBySym.set(sym, (callsBySym.get(sym) ?? 0) + Math.abs(p.quantity));
          shortCallCount += Math.abs(p.quantity);
        }
      } else if (p.quantity > 0) {
        stockCostBasis += p.quantity * (p.costBasis ?? px);
        totalShares += p.quantity;
        const sym = p.symbol.toUpperCase();
        sharesBySym.set(sym, (sharesBySym.get(sym) ?? 0) + p.quantity);
      }
    }

    for (const [sym, shares] of sharesBySym.entries()) {
      const calls = callsBySym.get(sym) ?? 0;
      const coveredLots = Math.min(Math.floor(shares / 100), calls);
      coveredShares += coveredLots * 100;
    }

    const capitalAtWork = stockCostBasis + cspCollateral;
    const availableBuyingPower = Math.max(0, cash - cspCollateral);
    const roundLotShares = Math.floor(totalShares / 100) * 100;
    const coveragePct = roundLotShares > 0 ? (coveredShares / roundLotShares) * 100 : 0;

    return {
      capitalAtWork,
      availableBuyingPower,
      cash,
      stockCostBasis,
      cspCollateral,
      totalShares,
      roundLotShares,
      coveredShares,
      coveragePct,
      shortCallCount,
      shortPutCount,
    };
  }, [accounts, positions]);

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 space-y-5 sm:space-y-8 max-w-[1750px] mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold tracking-tight text-white leading-tight">
            Portfolio
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!st?.registered ? (
            <Button
              size="sm"
              className="text-xs font-mono font-bold bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer h-9 px-3"
              onClick={() =>
                connectMut.mutate({ origin: window.location.origin })
              }
              disabled={!st?.configured || connectMut.isPending}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" />
              {connectMut.isPending ? "Connecting…" : "Connect Broker"}
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-white/10 hover:bg-white/5 cursor-pointer h-9 px-3"
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${syncMut.isPending ? "animate-spin" : ""}`}
              />
              {syncMut.isPending ? "Syncing…" : "Sync Broker"}
            </Button>
          )}
        </div>
      </header>

      {/* Broker Reported Balances (Total Account Value, Multi-Currency Cash, Buying Power & Inline Broker Integration in Same Row) */}
      <BrokerFiguresCards showSyncButton={accounts.length > 0} />

      {/* Summary KPI section */}
      {positions.length > 0 && (
        <section className="rounded-lg border border-white/[0.08] bg-[#111318] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.06] overflow-hidden">
          <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
            <div className="text-[11px] sm:text-xs text-zinc-400">Capital at Work</div>
            <div className="stat-value text-white text-xl sm:text-2xl mt-1 font-bold font-mono">
              {fmtMoney(metrics.capitalAtWork)}
            </div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono">
              {fmtMoney(metrics.stockCostBasis)} stock · {fmtMoney(metrics.cspCollateral)} CSP
            </div>
          </div>

          <div className="p-4 sm:p-5 flex flex-col justify-between space-y-2">
            <div className="text-[11px] sm:text-xs text-zinc-400">Option Coverage</div>
            <div className="stat-value text-white text-xl sm:text-2xl mt-1 font-bold font-mono">
              {metrics.coveragePct.toFixed(0)}%
            </div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono">
              {fmtNum(metrics.coveredShares, 0)}/{fmtNum(metrics.roundLotShares, 0)} sh · {metrics.shortCallCount} CC / {metrics.shortPutCount} CSP
            </div>
          </div>

          <div
            onClick={() => navigate("/risk?tab=greeks")}
            className="p-4 sm:p-5 flex flex-col justify-between space-y-2 hover:bg-white/[0.02] cursor-pointer transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-sky-400 flex items-center gap-1">
                <Zap className="h-3.5 w-3.5" /> Portfolio Beta (vs SPX)
              </span>
              <span className="text-[10px] text-zinc-500 group-hover:text-sky-400 flex items-center transition-colors">
                View Greeks <ArrowUpRight className="h-3 w-3 ml-0.5" />
              </span>
            </div>
            <div className="stat-value text-white text-xl sm:text-2xl mt-1 font-bold font-mono">
              {greeksQuery.data?.greeks?.effectivePortfolioBeta != null
                ? `${greeksQuery.data.greeks.effectivePortfolioBeta.toFixed(2)}β`
                : "—"}
            </div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono">
              {greeksQuery.data?.greeks?.totalSpxBetaDelta != null
                ? `${greeksQuery.data.greeks.totalSpxBetaDelta >= 0 ? "+" : ""}${greeksQuery.data.greeks.totalSpxBetaDelta.toFixed(2)} Δ SPX (${greeksQuery.data.greeks.totalSpyBetaDelta >= 0 ? "+" : ""}${greeksQuery.data.greeks.totalSpyBetaDelta.toFixed(1)} SPY)`
                : "S&P 500 sensitivity"}
            </div>
          </div>

          <div
            onClick={() => navigate("/risk?tab=greeks")}
            className="p-4 sm:p-5 flex flex-col justify-between space-y-2 hover:bg-white/[0.02] cursor-pointer transition-colors group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] sm:text-xs text-zinc-300 flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-emerald-400" /> Portfolio Net Delta
              </span>
              <span className="text-[10px] text-zinc-500 group-hover:text-zinc-300 flex items-center transition-colors">
                Greeks <ArrowUpRight className="h-3 w-3 ml-0.5" />
              </span>
            </div>
            <div className="stat-value text-white text-xl sm:text-2xl mt-1 font-bold font-mono">
              {greeksQuery.data?.greeks?.netPortfolioDelta != null
                ? `${greeksQuery.data.greeks.netPortfolioDelta >= 0 ? "+" : ""}${greeksQuery.data.greeks.netPortfolioDelta.toFixed(0)} Shares`
                : "—"}
            </div>
            <div className="text-[10px] sm:text-xs text-zinc-500 mt-1 font-mono">
              {greeksQuery.data?.greeks?.totalOptionDelta != null && greeksQuery.data.greeks.totalOptionDelta !== 0
                ? `${greeksQuery.data.greeks.totalOptionDelta >= 0 ? "+" : ""}${greeksQuery.data.greeks.totalOptionDelta.toFixed(0)} Δ options hedge`
                : "Raw share directional"}
            </div>
          </div>
        </section>
      )}

      {/* Positions Table (Prominently Placed Above Integration Cards) */}
      <div className="panel-box p-4 sm:p-7 overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-white/[0.06] pb-3">
          <div className="flex items-center gap-2">
            <span className="meta-label font-bold text-white uppercase text-xs">
              Positions ({positions.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="font-mono text-xs border-white/10 hover:bg-white/5 cursor-pointer h-8 px-2.5"
              onClick={() => setManualOpen(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1 text-primary" /> Add Position
            </Button>
          </div>
        </div>

        {positions.length === 0 ? (
          <div className="text-center py-10 sm:py-12 space-y-3 font-mono">
            <Briefcase className="h-10 w-10 mx-auto text-muted-foreground/40 stroke-1" />
            <p className="text-sm font-semibold text-white">Your portfolio is clean and ready</p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              No positions loaded. Connect your brokerage account, import a statement CSV, or add lots manually.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button
                size="sm"
                className="text-xs font-mono font-semibold bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer h-9 px-3"
                onClick={() => fileRef.current?.click()}
                disabled={importMut.isPending}
              >
                <Upload className="h-3.5 w-3.5 mr-1" /> Import CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs font-mono border-white/10 hover:bg-white/5 text-zinc-300 cursor-pointer h-9 px-3"
                onClick={() => setManualOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Manual Entry
              </Button>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-full text-left border-collapse text-xs sm:text-sm font-mono min-w-full">
              <thead>
                <tr className="border-b border-white/[0.08] text-muted-foreground text-xs font-mono">
                  <th className="pb-3 font-medium meta-label">Symbol</th>
                  <th className="pb-3 font-medium meta-label hidden sm:table-cell">Type</th>
                  <th className="pb-3 font-medium meta-label text-right">Qty</th>
                  <th className="pb-3 font-medium meta-label text-right hidden md:table-cell">Avg Price</th>
                  <th className="pb-3 font-medium meta-label text-right">Last Price</th>
                  <th className="pb-3 font-medium meta-label text-right hidden lg:table-cell">Market Value</th>
                  <th className="pb-3 font-medium meta-label text-right hidden sm:table-cell">Unrealised P&L</th>
                  <th className="pb-3 font-medium meta-label text-right text-sky-400">SPX Delta</th>
                  <th className="pb-3 font-medium meta-label text-right hidden xl:table-cell">Source</th>
                  <th className="pb-3 font-medium meta-label text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {positions.map((p) => {
                  const px = p.price ?? p.costBasis ?? 0;
                  const mult = p.assetType === "option" ? 100 : 1;
                  const mv = p.quantity * px * mult;
                  const cb = p.costBasis ?? px;
                  const pnl = p.quantity * (px - cb) * mult;
                  const pnlPct = cb > 0 ? (p.quantity < 0 ? ((cb - px) / cb) * 100 : ((px - cb) / cb) * 100) : 0;
                  const posGreek = p.id ? greeksPosMap.get(p.id) : null;
                  return (
                    <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-2.5 sm:py-3 font-mono font-bold text-white">
                        <div className="flex items-center gap-2.5">
                          <CompanyLogo symbol={p.symbol} size="sm" />
                          <span>
                            {p.assetType === "option"
                              ? `${p.symbol} ${p.expiry ?? ""} ${p.strike ?? ""}${p.optionType === "put" ? "P" : "C"}`
                              : p.symbol}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 sm:py-3 capitalize text-muted-foreground text-xs font-sans hidden sm:table-cell">
                        {p.assetType}
                      </td>
                      <td className="py-2.5 sm:py-3 text-right font-mono text-muted-foreground">
                        {fmtNum(p.quantity, 0)}
                      </td>
                      <td className="py-2.5 sm:py-3 text-right font-mono text-muted-foreground hidden md:table-cell">
                        {fmtMoney(p.costBasis)}
                      </td>
                      <td className="py-2.5 sm:py-3 text-right font-mono text-white">
                        {fmtMoney(p.price)}
                      </td>
                      <td className="py-2.5 sm:py-3 text-right font-mono font-medium text-white hidden lg:table-cell">
                        {fmtMoney(mv)}
                      </td>
                      <td className="py-2.5 sm:py-3 text-right font-mono text-xs hidden sm:table-cell">
                        <span
                          className={`font-semibold ${
                            pnl >= 0 ? "text-primary" : "text-rose-400"
                          }`}
                        >
                          {pnl >= 0 ? "+" : ""}{fmtMoney(pnl)}
                          <span className="text-[10px] opacity-75 ml-1">
                            ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%)
                          </span>
                        </span>
                      </td>
                      {/* SPX Beta-Weighted Delta */}
                      <td className="py-2.5 sm:py-3 text-right font-mono text-xs">
                        {posGreek ? (
                          <span
                            className={`font-semibold ${
                              posGreek.spxBetaDelta > 0
                                ? "text-sky-400"
                                : posGreek.spxBetaDelta < 0
                                ? "text-rose-400"
                                : "text-zinc-400"
                            }`}
                            title={`Beta: ${posGreek.beta.toFixed(2)}β | Underlying Spot: $${posGreek.spot.toFixed(2)}`}
                          >
                            {posGreek.spxBetaDelta >= 0 ? "+" : ""}
                            {posGreek.spxBetaDelta.toFixed(3)}
                          </span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-2.5 sm:py-3 text-right hidden xl:table-cell">
                        <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                          {p.source}
                        </span>
                      </td>
                      <td className="py-2.5 sm:py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Move / Edit Position Dialog Trigger */}
                          <button
                            onClick={() =>
                              setEditingPos({
                                id: p.id,
                                symbol: p.symbol,
                                quantity: p.quantity,
                                costBasis: p.costBasis,
                                accountId: p.accountId,
                              })
                            }
                            className="p-1.5 sm:p-2 hover:bg-white/10 active:bg-white/20 rounded text-muted-foreground hover:text-white transition-colors cursor-pointer"
                            title="Move Account / Edit Position"
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                          </button>
                          <button
                            onClick={() => removeMut.mutate({ ids: [p.id] })}
                            className="p-1.5 sm:p-2 hover:bg-red-500/10 active:bg-red-500/20 rounded text-muted-foreground hover:text-red-400 transition-colors cursor-pointer"
                            title="Remove"
                          >
                            <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Connected Accounts */}
      {accounts.length > 0 && (
        <div className="panel-box p-4">
          <div className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-zinc-300">
            <Building2 className="h-3.5 w-3.5 text-emerald-400" />
            <span>Connected Accounts ({accounts.length})</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="rounded border border-white/10 bg-white/[0.02] px-3 py-1.5 text-xs flex items-center gap-2.5 font-mono"
              >
                <span className="font-semibold text-white">{a.name ?? "Account"}</span>
                {a.institution && (
                  <span className="text-zinc-400">{a.institution}</span>
                )}
                {a.number && (
                  <span className="text-zinc-500">
                    #{a.number}
                  </span>
                )}
                {a.cash != null && (
                  <span className="text-emerald-400 font-semibold">
                    {fmtMoney(a.cash)} {a.currency ?? "USD"}
                  </span>
                )}
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/10">
                  {a.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clean Quick Actions Strip */}
      <div className="panel-box p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {!isBrokerConnected ? (
            <Button
              size="sm"
              className="text-xs font-medium bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer"
              onClick={() =>
                connectMut.mutate({ origin: window.location.origin })
              }
              disabled={!st?.configured || connectMut.isPending}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" /> Connect Broker
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
              onClick={() => syncMut.mutate()}
              disabled={syncMut.isPending}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${syncMut.isPending ? "animate-spin" : ""}`}
              />
              {syncMut.isPending ? "Syncing…" : "Sync Broker"}
            </Button>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
              e.target.value = "";
            }}
          />
          <Button
            size="sm"
            variant="outline"
            className="text-xs border-white/10 hover:bg-white/5 cursor-pointer text-zinc-300"
            onClick={() => fileRef.current?.click()}
            disabled={importMut.isPending}
          >
            <Upload className="h-3.5 w-3.5 mr-1 text-zinc-400" />
            {importMut.isPending ? "Importing…" : "Import CSV"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs border-white/10 hover:bg-white/5 cursor-pointer text-zinc-300"
            onClick={() => {
              setPrefilledSymbol("");
              setManualOpen(true);
            }}
          >
            <Plus className="h-3.5 w-3.5 mr-1 text-emerald-400" /> Add Position
          </Button>
        </div>

        <div className="flex items-center gap-2">
          {!isBrokerConnected && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-zinc-400 hover:text-white cursor-pointer"
                onClick={() => demoMut.mutate()}
                disabled={demoMut.isPending}
              >
                <FlaskConical className="h-3.5 w-3.5 mr-1" /> Demo Data
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs text-zinc-500 hover:text-red-400 cursor-pointer"
                onClick={() => clearDemoMut.mutate()}
                disabled={clearDemoMut.isPending}
              >
                Clear Demo
              </Button>
            </>
          )}
          {st?.registered && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs text-red-400 hover:bg-red-500/10 cursor-pointer"
              onClick={() => disconnectMut.mutate()}
              disabled={disconnectMut.isPending}
            >
              <Unlink className="h-3.5 w-3.5 mr-1" /> Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* Move Account / Edit Position Dialog */}
      {editingPos && (
        <Dialog open={!!editingPos} onOpenChange={(open) => !open && setEditingPos(null)}>
          <DialogContent className="bg-[#111113] border-white/10 text-white sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display font-bold uppercase tracking-tight flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" />
                Edit / Move {editingPos.symbol}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2 font-mono">
              <div className="space-y-1.5">
                <Label className="meta-label">Assign to Account</Label>
                <select
                  value={editingPos.accountId ?? ""}
                  onChange={(e) =>
                    setEditingPos((prev) =>
                      prev
                        ? {
                            ...prev,
                            accountId: e.target.value ? Number(e.target.value) : null,
                          }
                        : null,
                    )
                  }
                  className="w-full bg-[#0a0a0b] border border-white/10 rounded px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-primary"
                >
                  <option value="">Unassigned</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} {acc.institution ? `(${acc.institution})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="meta-label">Quantity</Label>
                <Input
                  type="number"
                  value={editingPos.quantity}
                  onChange={(e) =>
                    setEditingPos((prev) =>
                      prev
                        ? {
                            ...prev,
                            quantity: Number(e.target.value),
                          }
                        : null,
                    )
                  }
                  className="bg-[#0a0a0b] border-white/10 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="meta-label">Cost Basis (per unit)</Label>
                <Input
                  type="number"
                  value={editingPos.costBasis ?? ""}
                  onChange={(e) =>
                    setEditingPos((prev) =>
                      prev
                        ? {
                            ...prev,
                            costBasis: e.target.value ? Number(e.target.value) : null,
                          }
                        : null,
                    )
                  }
                  placeholder="0.00"
                  className="bg-[#0a0a0b] border-white/10 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingPos(null)}
                  className="text-muted-foreground hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (!editingPos) return;
                    updatePosMut.mutate({
                      id: editingPos.id,
                      quantity: editingPos.quantity,
                      costBasis: editingPos.costBasis,
                      accountId: editingPos.accountId,
                    });
                  }}
                  disabled={updatePosMut.isPending}
                  className="bg-primary text-black font-bold uppercase hover:bg-primary/90"
                >
                  {updatePosMut.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Add Position Modal with Interactive Suggestions & Recommendations */}
      <AddPositionModal
        open={manualOpen}
        onOpenChange={setManualOpen}
        onSuccess={invalidateAll}
        accounts={accounts}
        initialSymbol={prefilledSymbol}
      />
    </div>
  );
}

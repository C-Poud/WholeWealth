import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/format";
import {
  Link2,
  RefreshCw,
  Upload,
  Plus,
  Trash2,
  FlaskConical,
  Unlink,
} from "lucide-react";

export default function Portfolio() {
  const utils = trpc.useUtils();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileRef = useRef<HTMLInputElement>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({ symbol: "", quantity: "", costBasis: "" });

  const status = trpc.snaptrade.status.useQuery();
  const overview = trpc.portfolio.overview.useQuery();

  const invalidateAll = async () => {
    await Promise.all([
      utils.portfolio.overview.invalidate(),
      utils.snaptrade.status.invalidate(),
      utils.analytics.basisSuggestions.invalidate(),
      utils.analytics.riskReports.invalidate(),
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

  const addManualMut = trpc.portfolio.addManual.useMutation({
    onSuccess: async (d) => {
      toast.success(
        d.name
          ? `Added ${d.name} (${d.price != null ? fmtMoney(d.price) : "price pending"}).`
          : "Position added.",
      );
      setManualOpen(false);
      setManual({ symbol: "", quantity: "", costBasis: "" });
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
      r.readAsDataURL(f);
    });
    const base64 = dataUrl.split(",")[1] ?? "";
    importMut.mutate({ filename: f.name, dataBase64: base64 });
  };

  const st = status.data;
  const positions = overview.data?.positions ?? [];
  const accounts = overview.data?.accounts ?? [];

  const metrics = (() => {
    let stockCostBasis = 0;
    let cash = 0;
    let cspCollateral = 0;
    let totalShares = 0;
    let coveredShares = 0;
    let shortCallCount = 0;
    let shortPutCount = 0;

    for (const a of accounts) if (a.enabled !== false) cash += a.cash ?? 0;

    const bySym = new Map<string, { shares: number; calls: number }>();

    for (const p of positions) {
      const px = p.price ?? p.costBasis ?? 0;
      const sym = p.symbol.toUpperCase();
      const cur = bySym.get(sym) ?? { shares: 0, calls: 0 };

      if (p.assetType === "option") {
        if (p.optionType === "put" && p.quantity < 0) {
          const strike = p.strike ?? px;
          cspCollateral += strike * 100 * Math.abs(p.quantity);
          shortPutCount += Math.abs(p.quantity);
        } else if (p.optionType === "call" && p.quantity < 0) {
          shortCallCount += Math.abs(p.quantity);
          cur.calls += Math.abs(p.quantity);
        }
      } else if (p.quantity > 0) {
        stockCostBasis += p.quantity * (p.costBasis ?? px);
        totalShares += p.quantity;
        cur.shares += p.quantity;
      }
      bySym.set(sym, cur);
    }

    for (const [, symData] of bySym.entries()) {
      const coveredLots = Math.min(Math.floor(symData.shares / 100), symData.calls);
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
      cspCollateral,
      stockCostBasis,
      coveredShares,
      roundLotShares,
      coveragePct,
      shortCallCount,
      shortPutCount,
    };
  })();

  return (
    <div className="p-4 sm:p-10 space-y-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[-0.05em] text-[#f0f0f2] leading-none uppercase">
            Portfolio
          </h1>
          <p className="meta-label mt-2">
            Connect a brokerage, import a broker export, or manage positions manually.
          </p>
        </div>
      </header>

      {/* Capital & Strategy Metrics Bar */}
      {positions.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="stat-card">
            <div className="meta-label">Capital at Work</div>
            <div className="stat-value text-white">
              {fmtMoney(metrics.capitalAtWork)}
            </div>
            <div className="text-xs text-muted-foreground mt-2 font-mono">
              {fmtMoney(metrics.stockCostBasis)} stock basis · {fmtMoney(metrics.cspCollateral)} CSP collateral
            </div>
          </div>

          <div className="stat-card">
            <div className="meta-label">Available Buying Power</div>
            <div className="stat-value text-primary">
              {fmtMoney(metrics.availableBuyingPower)}
            </div>
            <div className="text-xs text-muted-foreground mt-2 font-mono">
              {fmtMoney(metrics.cash)} total account cash
            </div>
          </div>

          <div className="stat-card">
            <div className="meta-label">Option Coverage</div>
            <div className="stat-value text-white">
              {metrics.coveragePct.toFixed(0)}%
            </div>
            <div className="text-xs text-muted-foreground mt-2 font-mono">
              {fmtNum(metrics.coveredShares, 0)} / {fmtNum(metrics.roundLotShares, 0)} eligible shares · {metrics.shortCallCount} CC / {metrics.shortPutCount} CSP
            </div>
          </div>
        </section>
      )}

      {/* Data sources */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Brokerage connection */}
        <div className="panel-box p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="meta-label flex items-center gap-2 mb-3">
              <Link2 className="h-4 w-4 text-primary" /> Brokerage Connection
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans">
              {st?.configured ? (
                st.registered ? (
                  <>
                    SnapTrade registered.{" "}
                    {st.accountCount > 0
                      ? `${st.accountCount} account(s) linked${
                          st.lastSyncedAt
                            ? `, last sync ${fmtDate(st.lastSyncedAt)}`
                            : ""
                        }.`
                      : "No accounts linked yet."}
                  </>
                ) : (
                  "SnapTrade is configured — connect your first brokerage."
                )
              ) : (
                "SnapTrade is not configured. Add API keys in Settings — until then the app runs on demo market data."
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.08]">
            <Button
              size="sm"
              className="font-mono text-xs font-bold bg-primary text-black hover:bg-primary/90"
              onClick={() =>
                connectMut.mutate({ origin: window.location.origin })
              }
              disabled={!st?.configured || connectMut.isPending}
            >
              <Link2 className="h-3.5 w-3.5 mr-1" /> Connect
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="font-mono text-xs border-white/10 hover:bg-white/5"
              onClick={() => syncMut.mutate()}
              disabled={!st?.registered || syncMut.isPending}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`}
              />
              Sync
            </Button>
            {st?.registered && (
              <Button
                size="sm"
                variant="ghost"
                className="font-mono text-xs text-destructive hover:bg-destructive/10"
                onClick={() => disconnectMut.mutate()}
                disabled={disconnectMut.isPending}
              >
                <Unlink className="h-3.5 w-3.5 mr-1" /> Disconnect
              </Button>
            )}
          </div>
        </div>

        {/* Import positions */}
        <div className="panel-box p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="meta-label flex items-center gap-2 mb-3">
              <Upload className="h-4 w-4 text-primary" /> Import Positions
            </span>
            <p className="text-sm text-muted-foreground leading-relaxed font-sans">
              Upload an IBKR Activity/Open Positions CSV, or any CSV/Excel spreadsheet with
              Symbol, Quantity and Cost Basis columns.
            </p>
          </div>

          <div className="pt-2 border-t border-white/[0.08]">
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
              className="font-mono text-xs border-white/10 hover:bg-white/5"
              onClick={() => fileRef.current?.click()}
              disabled={importMut.isPending}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              {importMut.isPending ? "Importing…" : "Upload File"}
            </Button>
          </div>
        </div>

        {/* Manual & Demo */}
        <div className="panel-box p-6 flex flex-col justify-between space-y-4">
          <div>
            <span className="meta-label flex items-center gap-2 mb-3">
              <Plus className="h-4 w-4 text-primary" /> Manual & Demo
            </span>
            <p className="text-xs text-muted-foreground leading-relaxed font-sans">
              Demo mode includes pre-populated stocks and synthetic option chains so all features are explorable immediately.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-white/[0.08]">
            <Dialog open={manualOpen} onOpenChange={setManualOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="font-mono text-xs border-white/10 hover:bg-white/5">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Position
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-[#111113] border-white/10 text-white">
                <DialogHeader>
                  <DialogTitle className="font-display font-bold text-xl uppercase tracking-tight">
                    Add Stock Position
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className="meta-label">
                      Symbol
                    </Label>
                    <Input
                      value={manual.symbol}
                      onChange={(e) =>
                        setManual((m) => ({ ...m, symbol: e.target.value.toUpperCase() }))
                      }
                      placeholder="AAPL"
                      className="bg-[#0a0a0b] border-white/10 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="meta-label">
                      Quantity (Shares)
                    </Label>
                    <Input
                      type="number"
                      value={manual.quantity}
                      onChange={(e) =>
                        setManual((m) => ({ ...m, quantity: e.target.value }))
                      }
                      placeholder="100"
                      className="bg-[#0a0a0b] border-white/10 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="meta-label">
                      Cost Basis (Per Share)
                    </Label>
                    <Input
                      type="number"
                      value={manual.costBasis}
                      onChange={(e) =>
                        setManual((m) => ({ ...m, costBasis: e.target.value }))
                      }
                      placeholder="150.00"
                      className="bg-[#0a0a0b] border-white/10 font-mono"
                    />
                  </div>
                  <Button
                    className="w-full font-mono text-xs font-bold bg-primary text-black hover:bg-primary/90 uppercase tracking-wider"
                    onClick={() =>
                      addManualMut.mutate({
                        symbol: manual.symbol,
                        quantity: Number(manual.quantity),
                        costBasis: manual.costBasis
                          ? Number(manual.costBasis)
                          : undefined,
                      })
                    }
                    disabled={
                      !manual.symbol ||
                      !Number(manual.quantity) ||
                      addManualMut.isPending
                    }
                  >
                    {addManualMut.isPending
                      ? "Fetching from Yahoo…"
                      : "Save Position"}
                  </Button>
                  <p className="text-[11px] text-muted-foreground font-mono text-center">
                    Name, current price and type are pulled from Yahoo Finance automatically.
                  </p>
                </div>
              </DialogContent>
            </Dialog>

            <Button
              size="sm"
              variant="outline"
              className="font-mono text-xs border-primary/40 text-primary hover:bg-primary/10"
              onClick={() => demoMut.mutate()}
              disabled={demoMut.isPending}
            >
              <FlaskConical className="h-3.5 w-3.5 mr-1" /> Load Demo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="font-mono text-xs text-muted-foreground hover:text-white"
              onClick={() => clearDemoMut.mutate()}
              disabled={clearDemoMut.isPending}
            >
              Clear Demo
            </Button>
          </div>
        </div>
      </div>

      {/* Accounts */}
      {accounts.length > 0 && (
        <div className="panel-box p-6">
          <span className="meta-label block mb-4">
            Connected Accounts
          </span>
          <div className="flex flex-wrap gap-3">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="rounded border border-white/10 bg-white/[0.02] px-4 py-2.5 text-sm flex items-center gap-3 font-mono"
              >
                <span className="font-bold text-white">{a.name ?? "Account"}</span>
                {a.institution && (
                  <span className="text-muted-foreground text-xs">{a.institution}</span>
                )}
                {a.number && (
                  <span className="text-muted-foreground text-xs">
                    {a.number}
                  </span>
                )}
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-primary border border-primary/20">
                  {a.source}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Positions Table */}
      <div className="panel-box p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4">
          <span className="meta-label">
            Positions ({positions.length})
          </span>
        </div>

        {positions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center font-mono">
            Nothing here yet — connect, import, or load demo positions above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-muted-foreground text-xs">
                  <th className="pb-3 font-normal meta-label">Symbol</th>
                  <th className="pb-3 font-normal meta-label">Description</th>
                  <th className="pb-3 font-normal meta-label">Type</th>
                  <th className="pb-3 font-normal meta-label text-right">Qty</th>
                  <th className="pb-3 font-normal meta-label text-right">Cost Basis</th>
                  <th className="pb-3 font-normal meta-label text-right">Last Price</th>
                  <th className="pb-3 font-normal meta-label text-right">Source</th>
                  <th className="pb-3 font-normal meta-label text-right" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03]">
                {positions.map((p) => (
                  <tr key={p.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 font-mono font-bold text-white">
                      {p.assetType === "option"
                        ? `${p.symbol} ${p.expiry ?? ""} ${p.strike ?? ""}${p.optionType === "put" ? "P" : "C"}`
                        : p.symbol}
                    </td>
                    <td className="py-3 text-muted-foreground max-w-[220px] truncate text-xs font-sans">
                      {p.description ?? "—"}
                    </td>
                    <td className="py-3 capitalize text-muted-foreground text-xs font-sans">
                      {p.assetType}
                    </td>
                    <td className="py-3 text-right font-mono text-muted-foreground">
                      {fmtNum(p.quantity, 0)}
                    </td>
                    <td className="py-3 text-right font-mono text-muted-foreground">
                      {fmtMoney(p.costBasis)}
                    </td>
                    <td className="py-3 text-right font-mono text-white">
                      {fmtMoney(p.price)}
                    </td>
                    <td className="py-3 text-right">
                      <span className="font-mono text-[10px] uppercase px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">
                        {p.source}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => removeMut.mutate({ ids: [p.id] })}
                        className="p-1 hover:text-destructive text-muted-foreground transition-colors cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

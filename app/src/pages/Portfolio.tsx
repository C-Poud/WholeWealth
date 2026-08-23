import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { useSearchParams } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

  const connected = searchParams.get("connected") === "1";
  useEffect(() => {
    if (connected) {
      toast.success("Brokerage connected — syncing your accounts…");
      setSearchParams({}, { replace: true });
      syncMut.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

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
      toast.success(`Synced ${d.accounts} account(s), ${d.positions} position(s).`);
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
    onSuccess: async () => {
      toast.success("Position added.");
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

  return (
    <div className="p-6 space-y-6 max-w-[1400px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Connect a brokerage, import a broker export, or manage positions manually.
        </p>
      </div>

      {/* Data sources */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Link2 className="h-4 w-4 text-amber-300" /> Brokerage connection
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-sm text-muted-foreground">
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
                "SnapTrade is not configured. Add API keys in Settings (owner only) — until then the app runs on demo market data."
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                onClick={() =>
                  connectMut.mutate({ origin: window.location.origin })
                }
                disabled={!st?.configured || connectMut.isPending}
              >
                <Link2 className="h-4 w-4 mr-1" /> Connect brokerage
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => syncMut.mutate()}
                disabled={!st?.registered || syncMut.isPending}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`}
                />
                Sync
              </Button>
              {st?.registered && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending}
                >
                  <Unlink className="h-4 w-4 mr-1" /> Disconnect
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-amber-300" /> Import positions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload an IBKR Activity/Open&nbsp;Positions CSV, or any Excel/CSV with
              Symbol, Quantity and Cost&nbsp;Basis columns.
            </p>
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
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={importMut.isPending}
            >
              <Upload className="h-4 w-4 mr-1" />
              {importMut.isPending ? "Importing…" : "Upload file"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4 text-amber-300" /> Manual & demo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Dialog open={manualOpen} onOpenChange={setManualOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-4 w-4 mr-1" /> Add position
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add stock position</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 pt-2">
                    <div className="space-y-1">
                      <Label>Symbol</Label>
                      <Input
                        value={manual.symbol}
                        onChange={(e) =>
                          setManual((m) => ({ ...m, symbol: e.target.value }))
                        }
                        placeholder="AAPL"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Quantity</Label>
                      <Input
                        type="number"
                        value={manual.quantity}
                        onChange={(e) =>
                          setManual((m) => ({ ...m, quantity: e.target.value }))
                        }
                        placeholder="100"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Cost basis (per share)</Label>
                      <Input
                        type="number"
                        value={manual.costBasis}
                        onChange={(e) =>
                          setManual((m) => ({ ...m, costBasis: e.target.value }))
                        }
                        placeholder="150.00"
                      />
                    </div>
                    <Button
                      className="w-full"
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
                      Add
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Button
                size="sm"
                variant="outline"
                onClick={() => demoMut.mutate()}
                disabled={demoMut.isPending}
              >
                <FlaskConical className="h-4 w-4 mr-1" /> Load demo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => clearDemoMut.mutate()}
                disabled={clearDemoMut.isPending}
              >
                Clear demo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Demo mode uses synthetic quotes and option chains so every analytic
              stays explorable without a live connection.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accounts</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            {accounts.map((a) => (
              <div
                key={a.id}
                className="rounded-lg border px-4 py-2 text-sm flex items-center gap-3"
              >
                <span className="font-medium">{a.name ?? "Account"}</span>
                {a.institution && (
                  <span className="text-muted-foreground">{a.institution}</span>
                )}
                {a.number && (
                  <span className="text-muted-foreground font-mono text-xs">
                    {a.number}
                  </span>
                )}
                <Badge variant="secondary" className="capitalize">
                  {a.source}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Positions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Positions ({positions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nothing here yet — connect, import, or add a position above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Cost basis</TableHead>
                  <TableHead className="text-right">Last price</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {positions.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">
                      {p.assetType === "option"
                        ? `${p.symbol} ${p.expiry ?? ""} ${p.strike ?? ""}${p.optionType === "put" ? "P" : "C"}`
                        : p.symbol}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[220px] truncate">
                      {p.description ?? "—"}
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">
                      {p.assetType}
                    </TableCell>
                    <TableCell className="text-right">{fmtNum(p.quantity, 0)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(p.costBasis)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(p.price)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {p.source}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeMut.mutate({ ids: [p.id] })}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

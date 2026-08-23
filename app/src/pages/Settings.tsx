import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { KeyRound, Trash2 } from "lucide-react";

export default function Settings() {
  const utils = trpc.useUtils();
  const { data, isLoading, error } = trpc.settings.get.useQuery();
  const [form, setForm] = useState({ clientId: "", consumerKey: "" });

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  const saveMut = trpc.settings.setSnaptrade.useMutation({
    onSuccess: async (d) => {
      toast.success(
        `SnapTrade credentials verified and saved (API ${d.apiOnline ? "online" : "reachable"}).`,
      );
      setForm({ clientId: "", consumerKey: "" });
      await utils.settings.get.invalidate();
      await utils.snaptrade.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const clearMut = trpc.settings.clearSnaptrade.useMutation({
    onSuccess: async () => {
      toast.success("Stored credentials removed.");
      await utils.settings.get.invalidate();
      await utils.snaptrade.status.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[900px]">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Integrations and market-data configuration. Owner/admin only.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-300" /> SnapTrade integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Status:</span>
              {data?.configured ? (
                <>
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40">
                    Configured
                  </Badge>
                  <span className="text-muted-foreground">
                    Client ID {data.clientIdMasked} · source: {data.source}
                  </span>
                </>
              ) : (
                <Badge variant="outline" className="border-amber-400/60 text-amber-300">
                  Not configured — demo mode
                </Badge>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Client ID</Label>
              <Input
                value={form.clientId}
                onChange={(e) =>
                  setForm((f) => ({ ...f, clientId: e.target.value }))
                }
                placeholder="YOUR-CLIENT-ID"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label>Consumer Key</Label>
              <Input
                type="password"
                value={form.consumerKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, consumerKey: e.target.value }))
                }
                placeholder="••••••••••••••••"
                autoComplete="off"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => saveMut.mutate(form)}
              disabled={!form.clientId || !form.consumerKey || saveMut.isPending}
            >
              {saveMut.isPending ? "Verifying…" : "Verify & save"}
            </Button>
            {data?.configured && data.source === "settings" && (
              <Button
                variant="ghost"
                onClick={() => clearMut.mutate()}
                disabled={clearMut.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" /> Remove
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground leading-5">
            Credentials are verified against the SnapTrade API status endpoint
            before saving, then stored server-side in the app database. Each
            user connects their own brokerage through the SnapTrade Connection
            Portal; positions sync read-only. Without credentials the app runs
            on deterministic demo market data.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

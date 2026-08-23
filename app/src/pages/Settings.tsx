import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Trash2, Webhook } from "lucide-react";

export default function Settings() {
  const utils = trpc.useUtils();
  const me = trpc.auth.me.useQuery(undefined, { staleTime: 60_000 });
  const isAdmin = me.data?.role === "admin";
  const { data, isLoading, error } = trpc.settings.get.useQuery(undefined, {
    enabled: isAdmin,
  });
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

  // ── Broker Trade API (per user, everyone) ──
  const broker = trpc.settings.getBrokerApi.useQuery();
  const [brokerForm, setBrokerForm] = useState({ endpoint: "", apiKey: "" });

  const saveBrokerMut = trpc.settings.setBrokerApi.useMutation({
    onSuccess: async () => {
      toast.success("Broker API saved. Suggested trades can now be pushed.");
      setBrokerForm({ endpoint: "", apiKey: "" });
      await utils.settings.getBrokerApi.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const clearBrokerMut = trpc.settings.clearBrokerApi.useMutation({
    onSuccess: async () => {
      toast.success("Broker API removed.");
      await utils.settings.getBrokerApi.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const brokerPanel = (
    <div className="panel-card p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" /> Broker Trade API
        </span>
        {broker.isLoading ? (
          <span className="text-xs text-muted-foreground font-mono">Loading…</span>
        ) : broker.data?.configured ? (
          <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 font-bold">
            Configured
          </span>
        ) : (
          <span className="neon-badge">Not configured</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed font-mono">
        When you press “Push to broker” on a suggested trade, we POST the trade
        as JSON to this endpoint with your API key as a Bearer token. Point it
        at your broker’s order API (or an automation webhook) to route
        suggestions straight to your account.
      </p>

      {broker.data?.configured && (
        <div className="p-4 rounded bg-white/[0.02] border border-white/5 font-mono text-xs text-muted-foreground space-y-1">
          <div>
            Endpoint: <span className="text-white font-bold break-all">{broker.data.endpoint}</span>
          </div>
          <div>
            API key: <span className="text-white">{broker.data.apiKeyMasked}</span>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="font-mono text-xs uppercase text-muted-foreground">
            API Endpoint URL
          </Label>
          <Input
            value={brokerForm.endpoint}
            onChange={(e) =>
              setBrokerForm((f) => ({ ...f, endpoint: e.target.value }))
            }
            placeholder="https://api.yourbroker.com/v1/orders"
            autoComplete="off"
            className="bg-[#0c0c0e] border-white/10 font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="font-mono text-xs uppercase text-muted-foreground">
            API Key
          </Label>
          <Input
            type="password"
            value={brokerForm.apiKey}
            onChange={(e) =>
              setBrokerForm((f) => ({ ...f, apiKey: e.target.value }))
            }
            placeholder="••••••••••••••••"
            autoComplete="off"
            className="bg-[#0c0c0e] border-white/10 font-mono text-sm"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          className="font-mono text-xs font-bold bg-primary text-black hover:bg-primary/90 uppercase tracking-wider"
          onClick={() => saveBrokerMut.mutate(brokerForm)}
          disabled={
            !brokerForm.endpoint || !brokerForm.apiKey || saveBrokerMut.isPending
          }
        >
          {saveBrokerMut.isPending ? "Saving…" : "Save API"}
        </Button>
        {broker.data?.configured && (
          <Button
            variant="ghost"
            className="font-mono text-xs text-destructive hover:bg-destructive/10"
            onClick={() => clearBrokerMut.mutate()}
            disabled={clearBrokerMut.isPending}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Remove
          </Button>
        )}
      </div>
    </div>
  );

  // Normal users: only their broker trade API is configurable.
  if (me.data && !isAdmin) {
    return (
      <div className="p-4 sm:p-10 space-y-8 max-w-[1000px] mx-auto">
        <header>
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#f0f0f2] leading-tight">
            Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Connect your broker API to push suggested trades.
          </p>
        </header>
        {brokerPanel}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-10 space-y-8 max-w-[1000px] mx-auto">
      {/* Header */}
      <header>
        <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#f0f0f2] leading-tight">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Integrations and market-data configuration.
        </p>
      </header>

      {brokerPanel}

      <div className="panel-card p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> SnapTrade Integration
          </span>
          {isLoading ? (
            <span className="text-xs text-muted-foreground font-mono">Loading…</span>
          ) : data?.configured ? (
            <span className="font-mono text-xs uppercase px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/30 font-bold">
              Configured
            </span>
          ) : (
            <span className="neon-badge">Demo mode</span>
          )}
        </div>

        {data?.configured && (
          <div className="p-4 rounded bg-white/[0.02] border border-white/5 font-mono text-xs text-muted-foreground space-y-1">
            <div>
              Client ID: <span className="text-white font-bold">{data.clientIdMasked}</span>
            </div>
            <div>
              Source: <span className="text-white">{data.source}</span>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase text-muted-foreground">
              Client ID
            </Label>
            <Input
              value={form.clientId}
              onChange={(e) =>
                setForm((f) => ({ ...f, clientId: e.target.value }))
              }
              placeholder="YOUR-CLIENT-ID"
              autoComplete="off"
              className="bg-[#0c0c0e] border-white/10 font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="font-mono text-xs uppercase text-muted-foreground">
              Consumer Key
            </Label>
            <Input
              type="password"
              value={form.consumerKey}
              onChange={(e) =>
                setForm((f) => ({ ...f, consumerKey: e.target.value }))
              }
              placeholder="••••••••••••••••"
              autoComplete="off"
              className="bg-[#0c0c0e] border-white/10 font-mono text-sm"
            />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            className="font-mono text-xs font-bold bg-primary text-black hover:bg-primary/90 uppercase tracking-wider"
            onClick={() => saveMut.mutate(form)}
            disabled={!form.clientId || !form.consumerKey || saveMut.isPending}
          >
            {saveMut.isPending ? "Verifying…" : "Verify & Save"}
          </Button>
          {data?.configured && data.source === "settings" && (
            <Button
              variant="ghost"
              className="font-mono text-xs text-destructive hover:bg-destructive/10"
              onClick={() => clearMut.mutate()}
              disabled={clearMut.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed font-mono pt-4 border-t border-white/5">
          Credentials are verified against the SnapTrade API before saving, then stored securely in the app database. Without credentials the app runs on deterministic demo market data.
        </p>
      </div>
    </div>
  );
}

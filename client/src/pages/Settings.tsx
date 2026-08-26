import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Compass, KeyRound, Trash2, Webhook } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { fmtMoney } from "@/lib/format";
import { startAppTour, TOUR_STORAGE_KEY } from "@/components/OnboardingTour";

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

  // ── Connected accounts (per user, everyone) ──
  const accounts = trpc.snaptrade.accounts.useQuery();
  const toggleAccountMut = trpc.snaptrade.setAccountEnabled.useMutation({
    onSuccess: async (_d, vars) => {
      toast.success(vars.enabled ? "Account included." : "Account excluded.");
      await utils.snaptrade.accounts.invalidate();
      await utils.portfolio.overview.invalidate();
      await utils.analytics.invalidate();
      await utils.suggestions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteAccountMut = trpc.snaptrade.deleteAccount.useMutation({
    onSuccess: async () => {
      toast.success("Account and its positions deleted. Data will no longer pull.");
      await utils.snaptrade.accounts.invalidate();
      await utils.portfolio.overview.invalidate();
      await utils.analytics.invalidate();
      await utils.suggestions.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const accountsPanel = (
    <div className="panel-box p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <span className="meta-label flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" /> Connected Accounts
        </span>
        <span className="meta-label">
          {accounts.data?.length ?? 0} account(s)
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed font-sans">
        Manage connected brokerages. Toggle an account off to temporarily exclude its positions, or delete it completely so data is no longer pulled into your portfolio.
      </p>

      {accounts.isLoading ? (
        <div className="text-xs text-muted-foreground font-mono">Loading…</div>
      ) : !accounts.data || accounts.data.length === 0 ? (
        <div className="p-4 rounded bg-white/[0.02] border border-white/[0.06] font-mono text-xs text-muted-foreground">
          No accounts connected yet — head to Portfolio and hit{" "}
          <span className="text-primary font-bold">Connect</span> to link a
          brokerage.
        </div>
      ) : (
        <div className="divide-y divide-white/[0.04]">
          {accounts.data.map((a) => (
            <div
              key={a.id}
              className="flex items-center justify-between gap-4 py-4"
            >
              <div className="min-w-0">
                <div className="font-bold text-sm text-white truncate">
                  {a.name}
                  {a.number ? (
                    <span className="text-muted-foreground font-mono font-normal">
                      {" "}
                      ···{a.number.slice(-4)}
                    </span>
                  ) : null}
                </div>
                <div className="font-mono text-xs text-muted-foreground mt-0.5 truncate">
                  {[a.institution, a.source, a.cash != null ? fmtMoney(a.cash, a.currency) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-mono text-muted-foreground">
                    {a.enabled ? "Active" : "Disabled"}
                  </span>
                  <Switch
                    checked={a.enabled}
                    disabled={toggleAccountMut.isPending || deleteAccountMut.isPending}
                    onCheckedChange={(checked) =>
                      toggleAccountMut.mutate({ accountId: a.id, enabled: checked })
                    }
                    aria-label={`Include ${a.name}`}
                  />
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={deleteAccountMut.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Delete ${a.name}? Its positions will be removed and no new data will pull.`
                      )
                    ) {
                      deleteAccountMut.mutate({ accountId: a.id });
                    }
                  }}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Delete account"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const brokerPanel = (
    <div className="panel-box p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <span className="meta-label flex items-center gap-2">
          <Webhook className="h-4 w-4 text-primary" /> Broker Trade API
        </span>
        {broker.isLoading ? (
          <span className="text-xs text-muted-foreground font-mono">Loading…</span>
        ) : broker.data?.configured ? (
          <span className="neon-badge">
            Configured
          </span>
        ) : (
          <span className="neon-badge">Not configured</span>
        )}
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed font-sans">
        When you press “Push to broker” on a suggested trade, we POST the trade
        as JSON to this endpoint with your API key as a Bearer token. Point it
        at your broker’s order API (or an automation webhook) to route
        suggestions straight to your account.
      </p>

      {broker.data?.configured && (
        <div className="p-4 rounded bg-white/[0.02] border border-white/[0.06] font-mono text-xs text-muted-foreground space-y-1">
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
          <Label className="meta-label">
            API Endpoint URL
          </Label>
          <Input
            value={brokerForm.endpoint}
            onChange={(e) =>
              setBrokerForm((f) => ({ ...f, endpoint: e.target.value }))
            }
            placeholder="https://api.yourbroker.com/v1/orders"
            autoComplete="off"
            className="bg-[#0a0a0b] border-white/10 font-mono text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="meta-label">
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
            className="bg-[#0a0a0b] border-white/10 font-mono text-sm"
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

  const tourPanel = (
    <div className="panel-box p-6 sm:p-8 space-y-6">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <span className="meta-label flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" /> Product Tour & Walkthrough
        </span>
        <span className="text-xs font-mono text-emerald-400 font-medium px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
          Guided Mode
        </span>
      </div>

      <p className="text-xs text-muted-foreground leading-relaxed font-sans">
        Review the NetWorth.io architecture, delta-neutral Greek modeling ($\Delta = 0$), portfolio data integration methods (SnapTrade, CSV, manual entry), and algorithmic hedging engine.
      </p>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Button
          onClick={() => startAppTour()}
          className="font-mono text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-400 cursor-pointer"
        >
          <Compass className="h-3.5 w-3.5 mr-1.5" /> Start Product Tour
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            try {
              localStorage.removeItem(TOUR_STORAGE_KEY);
              toast.success("Tour status reset. It will appear on next page refresh or when launched.");
            } catch {
              // ignore
            }
          }}
          className="font-mono text-xs border-white/10 hover:bg-white/5 text-zinc-300 cursor-pointer"
        >
          Reset Tour Status
        </Button>
      </div>
    </div>
  );

  // Normal users: only their broker trade API and tour are configurable.
  if (me.data && !isAdmin) {
    return (
      <div className="p-4 sm:p-10 space-y-8 max-w-[1000px] mx-auto">
        <header className="pb-6 border-b border-white/[0.08]">
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[-0.05em] text-[#f0f0f2] leading-none uppercase">
            Settings
          </h1>
          <p className="meta-label mt-2">
            Manage connected accounts, product walkthrough, and broker API.
          </p>
        </header>
        {tourPanel}
        {accountsPanel}
        {brokerPanel}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-10 space-y-8 max-w-[1000px] mx-auto">
      {/* Header */}
      <header className="pb-6 border-b border-white/[0.08]">
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[-0.05em] text-[#f0f0f2] leading-none uppercase">
          Settings
        </h1>
        <p className="meta-label mt-2">
          Integrations, walkthrough, and market-data configuration.
        </p>
      </header>

      {tourPanel}

      {accountsPanel}

      {brokerPanel}

      <div className="panel-box p-6 sm:p-8 space-y-6">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <span className="meta-label flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> SnapTrade Integration
          </span>
          {isLoading ? (
            <span className="text-xs text-muted-foreground font-mono">Loading…</span>
          ) : data?.configured ? (
            <span className="neon-badge">
              Configured
            </span>
          ) : (
            <span className="neon-badge">Demo mode</span>
          )}
        </div>

        {data?.configured && (
          <div className="p-4 rounded bg-white/[0.02] border border-white/[0.06] font-mono text-xs text-muted-foreground space-y-1">
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
            <Label className="meta-label">
              Client ID
            </Label>
            <Input
              value={form.clientId}
              onChange={(e) =>
                setForm((f) => ({ ...f, clientId: e.target.value }))
              }
              placeholder="YOUR-CLIENT-ID"
              autoComplete="off"
              className="bg-[#0a0a0b] border-white/10 font-mono text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="meta-label">
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
              className="bg-[#0a0a0b] border-white/10 font-mono text-sm"
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

        <p className="text-xs text-muted-foreground leading-relaxed font-sans pt-4 border-t border-white/[0.08]">
          Credentials are verified against the SnapTrade API before saving, then stored securely in the app database. Without credentials the app runs on deterministic demo market data.
        </p>
      </div>
    </div>
  );
}

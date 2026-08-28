import { useState, useRef } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Link2,
  ShieldCheck,
  Zap,
  TrendingUp,
  Lock,
  ArrowRight,
  Upload,
  Layers,
  Building2,
  CheckCircle2,
  X,
} from "lucide-react";

interface ConnectBrokerCardProps {
  variant?: "banner" | "card" | "compact";
  onOpenManual?: () => void;
  className?: string;
}

const SUPPORTED_BROKERS = [
  { name: "Interactive Brokers", tier: "institutional" },
  { name: "Charles Schwab", tier: "major" },
  { name: "Fidelity", tier: "major" },
  { name: "Robinhood", tier: "retail" },
  { name: "E*TRADE", tier: "major" },
  { name: "Webull", tier: "retail" },
  { name: "Alpaca", tier: "api" },
  { name: "TD Ameritrade", tier: "major" },
  { name: "Vanguard", tier: "major" },
  { name: "Stake / CommSec", tier: "international" },
];

export function ConnectBrokerCard({
  variant = "card",
  onOpenManual,
  className = "",
}: ConnectBrokerCardProps) {
  const utils = trpc.useUtils();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  const status = trpc.snaptrade.status.useQuery();
  const st = status.data;

  const connectMut = trpc.snaptrade.connect.useMutation({
    onSuccess: (d) => {
      window.open(d.url, "_blank", "noopener");
      toast.info("Finish connecting in the SnapTrade portal, then click Sync in your portfolio.");
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
      await Promise.all([
        utils.portfolio.overview.invalidate(),
        utils.snaptrade.status.invalidate(),
        utils.analytics.basisSuggestions.invalidate(),
        utils.analytics.riskReports.invalidate(),
      ]);
    },
    onError: (e) => toast.error(e.message),
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

  // If user already connected a broker account, don't show the prompt card unless forced
  if (st?.registered && st.accountCount > 0 && !isDismissed) {
    return null;
  }

  if (isDismissed) {
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-white/[0.08] bg-[#0c0d12] text-xs font-mono">
        <span className="text-zinc-400 flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-zinc-300" />
          <span>Broker connection recommended for live quantitative Greek modeling</span>
        </span>
        <button
          onClick={() => setIsDismissed(false)}
          className="text-zinc-300 hover:text-white underline text-[11px] cursor-pointer"
        >
          Show Connect Options
        </button>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        id="connect-broker-compact-card"
        className={`p-4 rounded-xl border border-white/[0.1] bg-[#12141a] flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white/[0.06] border border-white/10 text-white shrink-0">
            <Building2 className="h-4 w-4" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white font-sans">
                Recommended: Connect Your Brokerage
              </span>
              <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 bg-white/10 text-zinc-300 rounded border border-white/10">
                Live Sync
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-sans">
              Sync holdings automatically to run real-time delta-neutral and volatility risk simulations.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            onClick={() => connectMut.mutate({ origin: window.location.origin })}
            disabled={connectMut.isPending}
            className="text-xs font-mono font-semibold bg-white text-black hover:bg-zinc-200 cursor-pointer"
          >
            <Link2 className="h-3.5 w-3.5 mr-1" />
            {connectMut.isPending ? "Connecting..." : "Connect Broker"}
          </Button>
          <button
            onClick={() => setIsDismissed(true)}
            className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded hover:bg-white/5 cursor-pointer"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section
      id="connect-broker-recommendation-card"
      className={`rounded-xl border border-white/[0.1] bg-[#12141a] p-5 sm:p-8 shadow-xl relative overflow-hidden ${className}`}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 sm:pb-6 border-b border-white/[0.08]">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-300 px-2 py-0.5 rounded bg-white/[0.06] border border-white/10 flex items-center gap-1.5">
              <Zap className="h-3 w-3 text-zinc-400" /> Recommended Step
            </span>
            <span className="text-xs font-mono text-zinc-400 hidden sm:inline">Direct Brokerage Integration</span>
          </div>
          <h2 className="text-lg sm:text-2xl font-bold tracking-tight text-white font-sans">
            Connect Your Broker for Real-Time Risk and Hedging
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 font-sans leading-relaxed max-w-3xl">
            Connecting your account allows WholeWealth to automatically import your equities, options, and cash balances to compute your exact portfolio beta-weighted delta, Greek sensitivities, and optimal delta-neutral hedge trades.
          </p>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="text-zinc-500 hover:text-zinc-300 p-1.5 rounded hover:bg-white/5 cursor-pointer self-start sm:self-auto"
          title="Dismiss card"
          aria-label="Dismiss recommendation"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Feature / Value Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 my-5 sm:my-6">
        <div className="p-3.5 sm:p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5 sm:space-y-2">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
            <Zap className="h-4 w-4 text-zinc-300" />
          </div>
          <div className="text-sm font-semibold text-white font-sans">Zero Manual Entry</div>
          <p className="text-xs text-zinc-400 font-sans leading-normal">
            Positions, lots, strikes, and expirations update automatically with real-time mark-to-market prices.
          </p>
        </div>

        <div className="p-3.5 sm:p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5 sm:space-y-2">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
            <TrendingUp className="h-4 w-4 text-zinc-300" />
          </div>
          <div className="text-sm font-semibold text-white font-sans">Institutional Greeks</div>
          <p className="text-xs text-zinc-400 font-sans leading-normal">
            Real-time pricing models calculate beta-weighted Delta, Gamma, and Theta against the S&P 500 index.
          </p>
        </div>

        <div className="p-3.5 sm:p-4 rounded-lg bg-white/[0.02] border border-white/[0.06] space-y-1.5 sm:space-y-2">
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-md bg-white/[0.06] border border-white/10 flex items-center justify-center text-white">
            <Lock className="h-4 w-4 text-zinc-300" />
          </div>
          <div className="text-sm font-semibold text-white font-sans">Bank-Grade Security</div>
          <p className="text-xs text-zinc-400 font-sans leading-normal">
            Read-only portfolio syncing via official SnapTrade OAuth. Credentials are never stored on WholeWealth servers.
          </p>
        </div>
      </div>

      {/* Supported Brokers Logos / Pills - hidden on mobile to optimize layout */}
      <div className="hidden sm:block space-y-2.5 pb-6 border-b border-white/[0.08]">
        <div className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 font-medium flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-zinc-300" /> Supported Brokerages (20+ Integrations)
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {SUPPORTED_BROKERS.map((b) => (
            <span
              key={b.name}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-xs font-mono text-zinc-300"
            >
              <CheckCircle2 className="h-3 w-3 text-zinc-400" />
              {b.name}
            </span>
          ))}
          <span className="px-2 py-1 text-xs font-mono text-zinc-500">+ more via SnapTrade</span>
        </div>
      </div>

      {/* Bottom CTA Action Bar */}
      <div className="pt-4 sm:pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <Button
            size="lg"
            onClick={() => connectMut.mutate({ origin: window.location.origin })}
            disabled={connectMut.isPending}
            className="w-full sm:w-auto text-xs sm:text-sm font-mono font-bold bg-white text-black hover:bg-zinc-200 uppercase tracking-wider px-5 sm:px-6 cursor-pointer"
          >
            <Link2 className="h-4 w-4 mr-2" />
            {connectMut.isPending ? "Opening Portal..." : "Connect Broker via SnapTrade"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>

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
            size="lg"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={importMut.isPending}
            className="w-full sm:w-auto text-xs sm:text-sm font-mono border-white/10 hover:bg-white/5 text-zinc-300 cursor-pointer"
          >
            <Upload className="h-4 w-4 mr-2 text-zinc-300" />
            {importMut.isPending ? "Importing..." : "Upload Statement CSV"}
          </Button>

          {onOpenManual && (
            <Button
              size="lg"
              variant="ghost"
              onClick={onOpenManual}
              className="w-full sm:w-auto text-xs sm:text-sm font-mono text-zinc-400 hover:text-white cursor-pointer"
            >
              <Layers className="h-4 w-4 mr-2 text-zinc-400" />
              Manual Entry
            </Button>
          )}
        </div>

        <div className="text-[11px] font-mono text-zinc-500 text-center sm:text-right">
          Takes under 2 minutes · Read-only access
        </div>
      </div>
    </section>
  );
}

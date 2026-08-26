import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { trpc } from "@/providers/trpc";
import {
  Briefcase,
  Coins,
  ShieldAlert,
  Lightbulb,
  Link2,
  Send,
  ArrowRight,
  TrendingUp,
  Zap,
  Lock,
} from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  missing_code: "Google did not return an authorization code.",
  google_auth_failed: "Google sign-in failed. Please try again.",
};

const FEATURES = [
  {
    icon: Link2,
    title: "Live Brokerage Sync",
    desc: "Connect your brokerage through SnapTrade and your positions flow in automatically — stocks, ETFs and options.",
  },
  {
    icon: Coins,
    title: "Basis Improvement",
    desc: "Covered-call suggestions ranked by yield, annualized return and mechanic score — squeeze income from positions you already hold.",
  },
  {
    icon: ShieldAlert,
    title: "Risk Analysis",
    desc: "Per-position expected move, implied-vol regime and concentration scoring so you see the tail risk before it sees you.",
  },
  {
    icon: Lightbulb,
    title: "Delta-Neutral Ideas",
    desc: "Your book's SPX beta-weighted delta, plus concrete hedge trades to bring it back to neutral.",
  },
  {
    icon: TrendingUp,
    title: "Real Market Data",
    desc: "Live quotes and option chains — no brokerage required. Works with manually added positions too.",
  },
  {
    icon: Send,
    title: "Push to Broker",
    desc: "Send suggested trades straight to your own broker API or automation webhook with one tap.",
  },
];

const STEPS = [
  { n: "01", title: "Sign in", desc: "One tap with your Google account — no passwords, no forms." },
  { n: "02", title: "Add your book", desc: "Connect a brokerage, import a file, or add positions manually." },
  { n: "03", title: "Optimize", desc: "Get covered-call, risk and delta-hedge ideas tailored to your positions." },
];

export default function Login() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const providers = trpc.auth.providers.useQuery(undefined, {
    staleTime: 60_000,
  });
  const me = trpc.auth.me.useQuery(undefined, { retry: false });

  const googleEnabled = providers.data?.google ?? false;
  const errorCode = params.get("error");

  useEffect(() => {
    if (providers.data && !providers.data.google) {
      navigate("/", { replace: true });
    } else if (me.data) {
      navigate("/", { replace: true });
    }
  }, [providers.data, me.data, navigate]);

  const signIn = () => {
    window.location.href = "/api/oauth/google";
  };

  const googleButton = (label: string, className = "") => (
    <Button
      className={`font-mono text-xs font-bold uppercase tracking-wider bg-primary text-black hover:bg-primary/90 py-6 ${className}`}
      size="lg"
      disabled={!googleEnabled}
      onClick={signIn}
    >
      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
        <path
          fill="currentColor"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
          fill="currentColor"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          opacity=".7"
        />
        <path
          fill="currentColor"
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          opacity=".5"
        />
        <path
          fill="currentColor"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          opacity=".9"
        />
      </svg>
      {label}
    </Button>
  );

  return (
    <div className="min-h-screen app-dot-grid text-[#f0f0f2]">
      {/* ── Nav ── */}
      <nav className="max-w-[1200px] mx-auto flex items-center justify-between px-4 sm:px-8 py-5">
        <Logo size={34} />
        <Button
          variant="outline"
          className="font-mono text-xs font-bold uppercase tracking-wider border-primary/40 text-primary hover:bg-primary/10 shadow-[0_0_15px_rgba(212,255,0,0.12)]"
          disabled={!googleEnabled}
          onClick={signIn}
        >
          Sign in
        </Button>
      </nav>

      {/* ── Hero ── */}
      <header className="max-w-[1200px] mx-auto px-4 sm:px-8 pt-14 sm:pt-24 pb-16 text-center">
        <div className="flex justify-center mb-6">
          <span className="neon-badge">Phase One · Beta</span>
        </div>
        <h1 className="font-display text-5xl sm:text-7xl font-extrabold tracking-tight leading-[0.95] uppercase">
          Run your book
          <br />
          <span className="text-primary">like a terminal</span>
        </h1>
        <p className="mt-6 text-muted-foreground max-w-xl mx-auto leading-relaxed text-sm sm:text-base">
          NetWorth.io turns your portfolio into an income machine — covered-call
          basis improvement, tail-risk detection and SPX delta-neutral trade
          ideas, synced live from your brokerage.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4">
          {errorCode && (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-mono text-destructive max-w-md">
              {ERROR_MESSAGES[errorCode] ?? `Sign-in error: ${errorCode}`}
            </div>
          )}
          {googleButton("Sign in with Google", "w-full max-w-xs")}
          <a
            href="#features"
            className="font-mono text-xs text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider flex items-center gap-1.5"
          >
            See what it does <ArrowRight className="h-3.5 w-3.5" />
          </a>
          {providers.data && !googleEnabled && (
            <p className="text-center text-xs font-mono text-muted-foreground">
              Redirecting to your workspace…
            </p>
          )}
        </div>

        {/* Ticker strip */}
        <div className="mt-16 panel-card px-6 py-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3 font-mono text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <Zap className="h-3.5 w-3.5 text-primary" /> REAL-TIME QUOTES
          </span>
          <span className="flex items-center gap-2">
            <Briefcase className="h-3.5 w-3.5 text-primary" /> MULTI-ACCOUNT
          </span>
          <span className="flex items-center gap-2">
            <ShieldAlert className="h-3.5 w-3.5 text-primary" /> RISK ENGINE
          </span>
          <span className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-primary" /> READ-ONLY SYNC
          </span>
        </div>
      </header>

      {/* ── Features ── */}
      <section id="features" className="max-w-[1200px] mx-auto px-4 sm:px-8 py-16">
        <div className="mb-10">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            // the toolkit
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 uppercase">
            Everything the wheel needs
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="panel-card stat-card-border p-6">
              <f.icon className="h-6 w-6 text-primary mb-4" />
              <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-8 py-16">
        <div className="mb-10">
          <span className="font-mono text-xs uppercase tracking-widest text-primary">
            // getting started
          </span>
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight mt-2 uppercase">
            Three steps
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="panel-card p-6">
              <div className="font-mono text-3xl font-bold text-primary/40 mb-3">
                {s.n}
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="max-w-[1200px] mx-auto px-4 sm:px-8 py-16">
        <div className="panel-card p-8 sm:p-14 text-center">
          <h2 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight uppercase">
            Your basis isn't going to
            <br />
            <span className="text-primary">improve itself</span>
          </h2>
          <div className="mt-8 flex justify-center">
            {googleButton("Get started free", "w-full max-w-xs")}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="max-w-[1200px] mx-auto px-4 sm:px-8 py-8 border-t border-white/5">
        <p className="font-mono text-[11px] text-muted-foreground text-center leading-relaxed">
          NetWorth.io © 2026 · Market data delayed ~15 min · Nothing here is
          financial advice. Options involve risk of loss.
        </p>
      </footer>
    </div>
  );
}

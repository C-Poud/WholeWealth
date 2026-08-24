import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { trpc } from "@/providers/trpc";
import { Lock, ShieldCheck, AlertCircle } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: "Sign-in was cancelled.",
  missing_code: "Google did not return an authorization code.",
  google_auth_failed: "Google sign-in failed. Please try again.",
};

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

  return (
    <div className="min-h-screen login-animated-bg flex flex-col justify-between text-[#f0f0f2] p-4 sm:p-8 relative overflow-hidden">
      {/* Background Slow-Animated Elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Soft floating neon radial glow orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary/10 blur-[100px] animate-pulse-slow" />
        <div className="absolute -bottom-40 -right-32 w-[30rem] h-[30rem] rounded-full bg-primary/10 blur-[130px] animate-pulse-slow-reverse" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] rounded-full bg-primary/[0.03] blur-[140px]" />

        {/* Slow floating financial chart curves & candlestick silhouettes */}
        <div className="absolute inset-0 opacity-[0.14] animate-chart-drift">
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 800" fill="none">
            {/* Options payoff / volatility wave curves */}
            <path
              d="M-50 480 C 250 560, 450 320, 750 420 C 1050 520, 1250 240, 1500 300"
              stroke="#d4ff00"
              strokeWidth="2"
              strokeDasharray="6 6"
            />
            <path
              d="M-50 350 C 300 200, 600 480, 950 280 C 1200 120, 1380 340, 1500 240"
              stroke="rgba(240, 240, 242, 0.4)"
              strokeWidth="1.5"
            />
            <path
              d="M-50 600 C 400 680, 700 450, 1100 580 C 1300 620, 1420 510, 1500 540"
              stroke="#d4ff00"
              strokeWidth="1"
              strokeOpacity="0.4"
            />

            {/* Stylized background candlestick bars with slow glow */}
            <g className="animate-pulse-slow" opacity="0.6">
              {/* Bar 1 */}
              <line x1="160" y1="260" x2="160" y2="420" stroke="#d4ff00" strokeWidth="1" />
              <rect x="154" y="300" width="12" height="70" fill="#d4ff00" rx="2" opacity="0.8" />

              {/* Bar 2 */}
              <line x1="220" y1="210" x2="220" y2="390" stroke="#d4ff00" strokeWidth="1" />
              <rect x="214" y="240" width="12" height="90" fill="#d4ff00" rx="2" opacity="0.9" />

              {/* Bar 3 */}
              <line x1="280" y1="290" x2="280" y2="460" stroke="#ff5555" strokeWidth="1" opacity="0.5" />
              <rect x="274" y="330" width="12" height="80" fill="#ff5555" rx="2" opacity="0.6" />

              {/* Bar 4 */}
              <line x1="1180" y1="180" x2="1180" y2="360" stroke="#d4ff00" strokeWidth="1" />
              <rect x="1174" y="220" width="12" height="95" fill="#d4ff00" rx="2" opacity="0.8" />

              {/* Bar 5 */}
              <line x1="1240" y1="230" x2="1240" y2="410" stroke="#d4ff00" strokeWidth="1" />
              <rect x="1234" y="260" width="12" height="100" fill="#d4ff00" rx="2" opacity="0.9" />

              {/* Bar 6 */}
              <line x1="1300" y1="310" x2="1300" y2="480" stroke="#ff5555" strokeWidth="1" opacity="0.5" />
              <rect x="1294" y="350" width="12" height="75" fill="#ff5555" rx="2" opacity="0.6" />
            </g>

            {/* Matrix Coordinate Crosses */}
            <g stroke="#d4ff00" strokeWidth="1" opacity="0.3">
              <path d="M120 180 h 12 M126 174 v 12" />
              <path d="M480 140 h 12 M486 134 v 12" />
              <path d="M960 160 h 12 M966 154 v 12" />
              <path d="M1320 120 h 12 M1326 114 v 12" />
              <path d="M240 680 h 12 M246 674 v 12" />
              <path d="M840 690 h 12 M846 684 v 12" />
              <path d="M1200 660 h 12 M1206 654 v 12" />
            </g>
          </svg>
        </div>

        {/* Ambient subtle ticker stream watermark in background */}
        <div className="absolute top-1/4 -left-10 text-[7rem] font-mono font-black text-white/[0.015] select-none tracking-widest uppercase">
          SPX · NVDA · AAPL · TSLA
        </div>
        <div className="absolute bottom-1/4 -right-10 text-[7rem] font-mono font-black text-white/[0.015] select-none tracking-widest uppercase">
          WHEEL · DELTA · THETA · VEGA
        </div>
      </div>

      {/* Top Bar */}
      <header className="max-w-[1200px] w-full mx-auto flex items-center justify-between py-2 relative z-10">
        <Logo size={36} />
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-muted-foreground backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Terminal Auth Gateway
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md mx-auto my-auto py-10 relative z-10">
        <div className="panel-card p-8 sm:p-10 border border-white/[0.1] shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(212,255,0,0.08)] text-center relative overflow-hidden backdrop-blur-md">
          {/* Neon accent line at top of card */}
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent" />

          {/* Logo & Headline */}
          <div className="flex justify-center mb-5">
            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] shadow-[0_0_20px_rgba(212,255,0,0.1)]">
              <Logo size={42} showText={false} />
            </div>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white">
            Sign In to <span className="text-primary">NetWorth.io</span>
          </h1>
          <p className="meta-label mt-2 text-muted-foreground font-mono text-xs">
            Portfolio & Options Terminal Access
          </p>

          {/* Error Message if any */}
          {errorCode && (
            <div className="mt-6 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs font-mono text-destructive flex items-center gap-2 text-left">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{ERROR_MESSAGES[errorCode] ?? `Authentication error: ${errorCode}`}</span>
            </div>
          )}

          {/* Direct Google Sign-In Action */}
          <div className="mt-8 space-y-4">
            <Button
              className="w-full font-mono text-xs font-bold uppercase tracking-wider bg-primary text-black hover:bg-primary/90 h-13 py-3.5 shadow-[0_0_20px_rgba(212,255,0,0.25)] transition-all active:scale-[0.98]"
              size="lg"
              disabled={!googleEnabled}
              onClick={signIn}
            >
              <svg className="mr-2.5 h-4 w-4" viewBox="0 0 24 24">
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
              Sign in with Google
            </Button>

            {providers.data && !googleEnabled && (
              <div className="rounded border border-yellow-500/20 bg-yellow-500/5 p-3 text-xs font-mono text-yellow-400 text-left">
                Google OAuth is not configured. Redirecting to default workspace…
              </div>
            )}
          </div>

          {/* Security details */}
          <div className="mt-8 pt-6 border-t border-white/[0.06] flex items-center justify-center gap-4 text-[11px] font-mono text-muted-foreground">
            <span className="flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Read-only sync
            </span>
            <span className="text-white/20">·</span>
            <span className="flex items-center gap-1">
              <Lock className="h-3.5 w-3.5 text-primary" /> Encrypted session
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-[1200px] w-full mx-auto py-4 text-center relative z-10">
        <p className="font-mono text-[11px] text-muted-foreground">
          NetWorth.io Terminal · Single Sign-On via Google
        </p>
      </footer>
    </div>
  );
}

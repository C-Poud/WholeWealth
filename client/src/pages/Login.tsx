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
    <div className="min-h-screen app-dot-grid flex flex-col justify-between text-[#f0f0f2] p-4 sm:p-8">
      {/* Top Bar */}
      <header className="max-w-[1200px] w-full mx-auto flex items-center justify-between py-2">
        <Logo size={36} />
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.04] border border-white/[0.08] text-[11px] font-mono text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Terminal Auth Gateway
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-md mx-auto my-auto py-10">
        <div className="panel-card p-8 sm:p-10 border border-white/[0.1] shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_30px_rgba(212,255,0,0.08)] text-center relative overflow-hidden">
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
      <footer className="max-w-[1200px] w-full mx-auto py-4 text-center">
        <p className="font-mono text-[11px] text-muted-foreground">
          NetWorth.io Terminal · Single Sign-On via Google
        </p>
      </footer>
    </div>
  );
}

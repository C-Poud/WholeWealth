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
    <div className="min-h-screen app-pattern-bg flex flex-col justify-between text-[#f1f2f4] p-4 sm:p-8 relative">
      {/* Top Bar */}
      <header className="max-w-[1200px] w-full mx-auto flex items-center justify-between py-3 relative z-10 border-b border-white/[0.06]">
        <Logo size={32} />
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-white/[0.03] border border-white/[0.08] text-[11px] font-mono text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Market Feeds Online · 15m Delayed
          </span>
        </div>
      </header>

      {/* Main Login Card */}
      <main className="w-full max-w-sm mx-auto my-auto py-8 relative z-10">
        <div className="panel-card p-6 sm:p-8 border border-white/[0.08] text-center bg-[#13151b] shadow-lg">
          {/* Logo */}
          <div className="flex justify-center mb-4">
            <Logo size={36} showText={false} />
          </div>

          <h1 className="font-semibold text-lg text-white">
            Sign in to NetWorth.io
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Portfolio risk & options management
          </p>

          {/* Error Message if any */}
          {errorCode && (
            <div className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2 text-left">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{ERROR_MESSAGES[errorCode] ?? `Authentication error: ${errorCode}`}</span>
            </div>
          )}

          {/* Direct Google Sign-In Action */}
          <div className="mt-6 space-y-3">
            <Button
              className="w-full text-xs font-medium bg-emerald-500 text-black hover:bg-emerald-400 h-10 py-2.5 transition-colors cursor-pointer"
              size="default"
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
              Continue with Google
            </Button>

            {providers.data && !googleEnabled && (
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-400 text-left">
                Google OAuth is not configured. Redirecting to default workspace…
              </div>
            )}
          </div>

          {/* Security details */}
          <div className="mt-6 pt-4 border-t border-white/[0.06] flex items-center justify-center gap-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Read-only broker sync
            </span>
            <span className="text-zinc-600">·</span>
            <span className="flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-400" /> Encrypted session
            </span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-[1200px] w-full mx-auto py-3 text-center relative z-10 border-t border-white/[0.04]">
        <p className="text-xs text-zinc-500">
          NetWorth.io · Secure Portfolio Management
        </p>
      </footer>
    </div>
  );
}

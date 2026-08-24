import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";

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

  return (
    <div className="min-h-screen flex items-center justify-center app-dot-grid p-4 text-[#f0f0f2]">
      <div className="w-full max-w-md panel-card p-8 sm:p-10 space-y-6">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-white/5 border border-white/10">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="text-primary"
            >
              <path d="M12 2v20M2 12h20M4.93 4.93l14.14 14.14M4.93 19.07L19.07 4.93" />
            </svg>
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white uppercase">
            WHEELDESK
          </h1>
          <p className="text-sm text-muted-foreground">
            Portfolio &amp; options toolkit — sign in to continue
          </p>
        </div>

        <div className="space-y-4">
          {errorCode && (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs font-mono text-destructive">
              {ERROR_MESSAGES[errorCode] ?? `Sign-in error: ${errorCode}`}
            </div>
          )}

          <Button
            className="w-full font-mono text-xs font-bold uppercase tracking-wider bg-primary text-black hover:bg-primary/90 py-6"
            size="lg"
            disabled={!googleEnabled}
            onClick={() => {
              window.location.href = "/api/oauth/google";
            }}
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
            Sign in with Google
          </Button>

          {providers.data && !googleEnabled && (
            <p className="text-center text-xs font-mono text-muted-foreground">
              Redirecting to your workspace…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

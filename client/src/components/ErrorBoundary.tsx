import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface State {
  error: Error | null;
}

/** Catches render errors and shows them instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-lg border border-destructive/40 bg-destructive/10 p-6 space-y-3">
            <h1 className="text-lg font-semibold text-destructive">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground break-words">
              {this.state.error.message}
            </p>
            <pre className="text-xs text-muted-foreground overflow-auto max-h-48 whitespace-pre-wrap">
              {this.state.error.stack}
            </pre>
            <Button
              variant="secondary"
              onClick={() => {
                this.setState({ error: null });
                window.location.href = "/";
              }}
            >
              Back to dashboard
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

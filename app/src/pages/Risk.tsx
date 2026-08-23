import { useMemo, useState } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScoreBar } from "@/components/Gauges";
import { fmtMoney, fmtPct } from "@/lib/format";
import { ShieldAlert } from "lucide-react";

function scoreLabel(s: number): string {
  if (s < 4) return `${s.toFixed(1)} Low`;
  if (s < 6) return `${s.toFixed(1)} Moderate`;
  if (s < 8) return `${s.toFixed(1)} Elevated`;
  return `${s.toFixed(1)} High`;
}

export default function Risk() {
  const { data, isLoading, error, refetch } = trpc.analytics.riskReports.useQuery();
  const [selected, setSelected] = useState<string | null>(null);

  const reports = useMemo(() => data?.reports ?? [], [data]);
  const current = reports.find((r) => r.symbol === selected) ?? reports[0];

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4 max-w-[1400px]">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Extreme Risk Detection
          </h1>
          <p className="text-sm text-muted-foreground">
            Expected-move ranges derived from implied volatility, plus portfolio
            concentration risk. Total portfolio value{" "}
            <b className="text-foreground">{fmtMoney(data?.portfolioValue)}</b>.
          </p>
        </div>
        {data?.mode === "demo" && (
          <Badge variant="outline" className="border-amber-400/60 text-amber-300">
            Demo market data
          </Badge>
        )}
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-destructive">
              Failed to load risk analysis: {error.message}
            </p>
            <button
              onClick={() => refetch()}
              className="text-sm underline text-foreground"
            >
              Retry
            </button>
          </CardContent>
        </Card>
      )}

      {reports.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">No positions to analyze</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Add positions on the Portfolio page to see expected-move and
              outlier-risk analysis.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Position</div>
            <Select value={current?.symbol} onValueChange={setSelected}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose a symbol" />
              </SelectTrigger>
              <SelectContent>
                {reports.map((r) => (
                  <SelectItem key={r.symbol} value={r.symbol}>
                    {r.symbol} · {fmtPct(r.portfolioWeight, 1)} of portfolio
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {current && (
            <Card>
              <CardContent className="pt-6 space-y-5">
                <div className="flex items-baseline justify-between flex-wrap gap-2">
                  <div className="font-medium">
                    Extreme Risk Detection: {current.symbol}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Implied-volatility regime:{" "}
                    <b className="text-foreground">
                      {current.iv30 != null
                        ? `${(current.iv30 * 100).toFixed(1)}%`
                        : "unavailable"}
                    </b>{" "}
                    · Weight{" "}
                    <b className="text-foreground">
                      {fmtPct(current.portfolioWeight, 1)}
                    </b>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1.5">
                    Risk Score
                  </div>
                  <ScoreBar
                    score={current.riskScore}
                    invert
                    label={scoreLabel(current.riskScore)}
                  />
                </div>

                {current.lower2 != null ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border bg-muted/30 p-4 text-center">
                        <div className="text-xs text-muted-foreground">
                          −2σ Boundary
                        </div>
                        <div className="mt-1 text-2xl font-semibold">
                          {fmtMoney(current.lower2)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-amber-300 p-4 text-center text-zinc-900">
                        <div className="text-xs font-medium">Current Price</div>
                        <div className="mt-1 text-2xl font-bold">
                          {fmtMoney(current.spot)}
                        </div>
                      </div>
                      <div className="rounded-lg border bg-muted/30 p-4 text-center">
                        <div className="text-xs text-muted-foreground">
                          +2σ Boundary
                        </div>
                        <div className="mt-1 text-2xl font-semibold">
                          {fmtMoney(current.upper2)}
                        </div>
                      </div>
                    </div>

                    {/* 95% probable range bar */}
                    <div>
                      <div className="flex text-[10px] text-muted-foreground">
                        <span className="w-[15%] text-center">2.5%</span>
                        <span className="flex-1 text-center text-indigo-300">
                          95% Probable Range
                        </span>
                        <span className="w-[15%] text-center">2.5%</span>
                      </div>
                      <div className="flex h-3 overflow-hidden rounded">
                        <div className="w-[15%] bg-muted/40" />
                        <div className="flex-1 bg-indigo-400/70" />
                        <div className="w-[15%] bg-muted/40" />
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                        <span>{fmtMoney(current.lower2)}</span>
                        <span>
                          1σ: {fmtMoney(current.lower1)} – {fmtMoney(current.upper1)}
                        </span>
                        <span>{fmtMoney(current.upper2)}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        1σ ±<b className="text-foreground">{fmtMoney(current.expectedMove1Sigma)}</b>
                      </span>
                      <span>
                        2σ ±<b className="text-foreground">{fmtMoney(current.expectedMove2Sigma)}</b>
                      </span>
                      <span>
                        DTE <b className="text-foreground">{current.dte}</b>
                      </span>
                      {current.probBelowBasis != null && (
                        <span>
                          P(below basis){" "}
                          <b className="text-foreground">
                            {fmtPct(current.probBelowBasis, 0)}
                          </b>
                        </span>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Expected move unavailable — no option chain data for this
                    symbol.
                  </p>
                )}

                <ul className="space-y-1.5 list-disc pl-5 text-sm text-muted-foreground">
                  {current.notes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Overview grid of all symbols */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => (
              <button
                key={r.symbol}
                onClick={() => setSelected(r.symbol)}
                className={`rounded-lg border p-4 text-left transition-colors hover:border-amber-300/60 ${
                  current?.symbol === r.symbol ? "border-amber-300/60" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{r.symbol}</span>
                  <span className="text-xs text-amber-300">
                    {scoreLabel(r.riskScore)}
                  </span>
                </div>
                <div className="mt-2">
                  <ScoreBar score={r.riskScore} invert />
                </div>
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>
                    IV {r.iv30 != null ? `${(r.iv30 * 100).toFixed(0)}%` : "—"}
                  </span>
                  <span>{fmtPct(r.portfolioWeight, 1)} weight</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Outlier-risk analysis is based on implied volatility and reflects
        statistical probabilities, not predictions. Actual market outcomes may
        differ. Not financial advice.
      </p>
    </div>
  );
}

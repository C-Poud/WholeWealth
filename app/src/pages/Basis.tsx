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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScoreBar, DeltaGauge } from "@/components/Gauges";
import { fmtDate, fmtMoney, fmtPct } from "@/lib/format";
import { Coins } from "lucide-react";

function scoreLabel(s: number): string {
  if (s >= 8) return `${s.toFixed(1)} Excellent`;
  if (s >= 6.5) return `${s.toFixed(1)} Good`;
  if (s >= 5) return `${s.toFixed(1)} Fair`;
  return `${s.toFixed(1)} Weak`;
}

export default function Basis() {
  const { data, isLoading, error, refetch } = trpc.analytics.basisSuggestions.useQuery();
  const [selected, setSelected] = useState<string | null>(null);

  const suggestions = useMemo(() => data?.suggestions ?? [], [data]);
  const current =
    suggestions.find((s) => s.symbol === selected) ?? suggestions[0];

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
            Basis Improvement
          </h1>
          <p className="text-sm text-muted-foreground">
            Covered-call suggestions that lower your cost basis. Small percentages
            compound dramatically.
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
              Failed to load suggestions: {error.message}
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

      {suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Coins className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">Nothing to optimize yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {data?.message ??
                error?.message ??
                "Add a long stock position with at least 100 shares to see covered-call suggestions."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground">Position</div>
            <Select value={current?.symbol} onValueChange={setSelected}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Choose a position" />
              </SelectTrigger>
              <SelectContent>
                {suggestions.map((s) => (
                  <SelectItem key={s.symbol} value={s.symbol}>
                    {s.symbol}
                    {s.description ? ` — ${s.description}` : ""} · {s.shares} sh @{" "}
                    {fmtMoney(s.basis)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {current && !current.best && (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                No suitable covered-call candidates for {current.symbol} in the
                10–60 DTE, Δ0.08–0.45 window right now.
              </CardContent>
            </Card>
          )}

          {current?.best && (
            <Card>
              <CardContent className="pt-6 grid gap-8 lg:grid-cols-2">
                {/* Left: metrics */}
                <div className="space-y-5">
                  <div>
                    <div className="font-medium">
                      Basis Improvement: {current.symbol}
                      {current.description ? ` — ${current.description}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Small percentages compound dramatically
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground">
                    Sell {current.best.contracts} covered call
                    {current.best.contracts > 1 ? "s" : ""} · Strike{" "}
                    {fmtMoney(current.best.strike)} · Expires{" "}
                    {fmtDate(current.best.expiry)} ({current.best.dte} DTE, Δ
                    {current.best.delta.toFixed(4)})
                  </div>

                  <div>
                    <div className="text-xs text-muted-foreground mb-1.5">
                      Mechanic Score
                    </div>
                    <ScoreBar
                      score={current.best.score}
                      label={scoreLabel(current.best.score)}
                    />
                  </div>

                  <div className="text-sm space-x-4">
                    <span>
                      Yield{" "}
                      <b className="text-foreground">
                        {fmtPct(current.best.yieldPct)}
                      </b>
                    </span>
                    <span>
                      Ann.{" "}
                      <b className="text-foreground">
                        {fmtPct(current.best.annualizedYieldPct, 1)}
                      </b>
                    </span>
                    <span>
                      New Basis{" "}
                      <b className="text-foreground">
                        {fmtMoney(current.best.newBasis)}
                      </b>
                    </span>
                  </div>

                  <DeltaGauge delta={current.best.delta} />

                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Manage by{" "}
                      <b className="text-foreground">
                        {fmtDate(current.best.manageBy)}
                      </b>
                    </span>
                    <span>
                      50% target{" "}
                      <b className="text-foreground">
                        {fmtMoney(current.best.target50)}
                      </b>
                    </span>
                    <span>
                      Breakeven{" "}
                      <b className="text-foreground">
                        {fmtMoney(current.best.breakeven)}
                      </b>
                    </span>
                    <span>
                      Premium{" "}
                      <b className="text-emerald-400">
                        +{fmtMoney(current.best.premiumTotal)}
                      </b>
                    </span>
                  </div>
                </div>

                {/* Right: narrative */}
                <div className="text-sm leading-6 text-muted-foreground">
                  <p>
                    Sell {current.best.contracts} covered call
                    {current.best.contracts > 1 ? "s" : ""} at the{" "}
                    {fmtMoney(current.best.strike)} strike expiring{" "}
                    {fmtDate(current.best.expiry)} ({current.best.dte} DTE, Δ
                    {current.best.delta.toFixed(4)}). This structure yields a
                    Mechanic Score of {current.best.score.toFixed(1)}, driven
                    primarily by delta alignment relative to the underlying price
                    of {fmtMoney(current.spot)}. The trade generates a yield of{" "}
                    {fmtPct(current.best.yieldPct)} (
                    {fmtPct(current.best.annualizedYieldPct, 1)} annualized),
                    resulting in a new cost basis of{" "}
                    {fmtMoney(current.best.newBasis)} and a breakeven of{" "}
                    {fmtMoney(current.best.breakeven)}. Management targets a 50%
                    profit exit ({fmtMoney(current.best.target50)}) or a
                    transition at the {fmtDate(current.best.manageBy)} management
                    date, with the Δ{current.best.delta.toFixed(4)} contract
                    reflecting an approximate{" "}
                    {(current.best.assignmentProb * 100).toFixed(0)}% probability
                    of assignment by expiration.
                  </p>
                  <ul className="mt-4 space-y-1.5 list-disc pl-5">
                    {current.best.rationale.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {current && current.alternatives.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="mb-3 text-sm font-medium">
                  Alternative strikes & expiries — {current.symbol}
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">Score</TableHead>
                      <TableHead className="text-right">Strike</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">DTE</TableHead>
                      <TableHead className="text-right">Δ</TableHead>
                      <TableHead className="text-right">Bid</TableHead>
                      <TableHead className="text-right">Yield</TableHead>
                      <TableHead className="text-right">Annualized</TableHead>
                      <TableHead className="text-right">New basis</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {current.alternatives.map((a) => (
                      <TableRow key={`${a.expiry}-${a.strike}`}>
                        <TableCell className="text-right font-medium text-amber-300">
                          {a.score.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(a.strike)}
                        </TableCell>
                        <TableCell>{fmtDate(a.expiry)}</TableCell>
                        <TableCell className="text-right">{a.dte}</TableCell>
                        <TableCell className="text-right">
                          {a.delta.toFixed(3)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(a.bid)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtPct(a.yieldPct)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtPct(a.annualizedYieldPct, 1)}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMoney(a.newBasis)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Generated by a quantitative heuristic from live or demo option-chain
        data. Not financial advice — probabilities are model-derived statistics,
        not predictions.
      </p>
    </div>
  );
}

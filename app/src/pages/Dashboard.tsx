import { useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtMoney, fmtNum, fmtPct } from "@/lib/format";
import { Link } from "react-router";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Wallet, Briefcase, TrendingUp, Landmark } from "lucide-react";

const COLORS = [
  "#facc15", "#4ade80", "#60a5fa", "#f472b6", "#a78bfa",
  "#34d399", "#fb923c", "#e879f9", "#22d3ee", "#f87171",
];

export default function Dashboard() {
  const { data, isLoading, error, refetch } = trpc.portfolio.overview.useQuery();

  const stats = useMemo(() => {
    const positions = data?.positions ?? [];
    const accounts = data?.accounts ?? [];
    let equityValue = 0;
    let totalCost = 0;
    let cash = 0;
    for (const a of accounts) cash += a.cash ?? 0;
    const bySymbol = new Map<string, number>();
    for (const p of positions) {
      const px = p.price ?? p.costBasis ?? 0;
      const mult = p.assetType === "option" ? 100 : 1;
      const mv = p.quantity * px * mult;
      equityValue += mv;
      totalCost += p.quantity * (p.costBasis ?? px) * mult;
      bySymbol.set(p.symbol, (bySymbol.get(p.symbol) ?? 0) + Math.abs(mv));
    }
    const allocation = [...bySymbol.entries()]
      .map(([symbol, value]) => ({ symbol, value: +value.toFixed(2) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
    return {
      equityValue,
      cash,
      totalValue: equityValue + cash,
      pnl: equityValue - totalCost,
      pnlPct: totalCost > 0 ? (equityValue - totalCost) / totalCost : null,
      count: positions.length,
      allocation,
      hasDemo: positions.some((p) => p.source === "demo"),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }

  const positions = data?.positions ?? [];

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-[1400px]">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Portfolio Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Holdings, performance and allocation across your connected accounts.
          </p>
        </div>
        {stats.hasDemo && (
          <Badge variant="outline" className="border-amber-400/60 text-amber-300">
            Includes demo data
          </Badge>
        )}
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/10">
          <CardContent className="py-4 flex items-center justify-between gap-4">
            <p className="text-sm text-destructive">
              Failed to load portfolio: {error.message}
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

      {positions.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center space-y-3">
            <Briefcase className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-lg font-medium">No positions yet</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Connect a brokerage via SnapTrade, upload a broker export, or load a
              demo portfolio to explore the analytics.
            </p>
            <Link
              to="/portfolio"
              className="inline-block mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Go to Portfolio
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Wallet className="h-4 w-4 text-amber-300" />}
              label="Total Value"
              value={fmtMoney(stats.totalValue)}
            />
            <StatCard
              icon={<TrendingUp className="h-4 w-4 text-amber-300" />}
              label="Equity Value"
              value={fmtMoney(stats.equityValue)}
              sub={`${positions.length} open positions`}
            />
            <StatCard
              icon={<Landmark className="h-4 w-4 text-amber-300" />}
              label="Cash"
              value={fmtMoney(stats.cash)}
            />
            <StatCard
              icon={<Briefcase className="h-4 w-4 text-amber-300" />}
              label="Unrealized P&L"
              value={fmtMoney(stats.pnl)}
              sub={stats.pnlPct != null ? fmtPct(stats.pnlPct) : undefined}
              tone={stats.pnl >= 0 ? "up" : "down"}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base">Positions</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Cost</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Mkt Value</TableHead>
                      <TableHead className="text-right">P&L</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {positions.map((p) => {
                      const px = p.price ?? p.costBasis ?? 0;
                      const mult = p.assetType === "option" ? 100 : 1;
                      const mv = p.quantity * px * mult;
                      const cb = p.costBasis ?? px;
                      const pnl = p.quantity * (px - cb) * mult;
                      const label =
                        p.assetType === "option"
                          ? `${p.symbol} ${p.expiry ?? ""} ${p.strike ?? ""}${p.optionType === "put" ? "P" : "C"}`
                          : p.symbol;
                      return (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{label}</TableCell>
                          <TableCell className="capitalize text-muted-foreground">
                            {p.assetType}
                          </TableCell>
                          <TableCell className="text-right">{fmtNum(p.quantity, 0)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(p.costBasis)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(px)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(mv)}</TableCell>
                          <TableCell
                            className={`text-right ${pnl >= 0 ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {fmtMoney(pnl)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="capitalize">
                              {p.source}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Allocation</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.allocation.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No equity value to chart.</p>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={stats.allocation}
                          dataKey="value"
                          nameKey="symbol"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={2}
                        >
                          {stats.allocation.map((_, i) => (
                            <Cell key={i} fill={COLORS[i % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(v: number) => fmtMoney(v)}
                          contentStyle={{
                            background: "#18181b",
                            border: "1px solid #27272a",
                            borderRadius: 8,
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-2 space-y-1">
                  {stats.allocation.map((a, i) => (
                    <div key={a.symbol} className="flex items-center gap-2 text-xs">
                      <span
                        className="h-2.5 w-2.5 rounded-sm"
                        style={{ background: COLORS[i % COLORS.length] }}
                      />
                      <span className="font-medium">{a.symbol}</span>
                      <span className="ml-auto text-muted-foreground">
                        {fmtMoney(a.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard(props: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {props.icon}
          {props.label}
        </div>
        <div
          className={`mt-2 text-2xl font-semibold ${
            props.tone === "up"
              ? "text-emerald-400"
              : props.tone === "down"
                ? "text-red-400"
                : ""
          }`}
        >
          {props.value}
        </div>
        {props.sub && (
          <div className="text-xs text-muted-foreground mt-1">{props.sub}</div>
        )}
      </CardContent>
    </Card>
  );
}

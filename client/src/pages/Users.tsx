import { useState, useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { fmtMoney } from "@/lib/format";
import {
  Users as UsersIcon,
  RotateCcw,
  DollarSign,
  Briefcase,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Layers,
} from "lucide-react";

function fmtDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = new Date(d);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Users() {
  const utils = trpc.useUtils();
  const { data: users, isLoading, error, refetch, isRefetching } = trpc.admin.users.useQuery();

  const [selectedUserForReset, setSelectedUserForReset] = useState<{
    id: number;
    name: string | null;
    email: string | null;
  } | null>(null);

  const resetMutation = trpc.admin.resetUserAccount.useMutation({
    onSuccess: (res) => {
      toast.success(
        res.message ?? "User account reset successfully. The user can now re-authenticate.",
      );
      setSelectedUserForReset(null);
      utils.admin.users.invalidate();
    },
    onError: (err) => {
      toast.error(`Failed to reset account: ${err.message}`);
    },
  });

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  // Aggregate metrics
  const totalUsersCount = users?.length ?? 0;
  const totalCashAcrossAll = (users ?? []).reduce(
    (acc, u) => acc + (u.totalCash || 0),
    0,
  );
  const totalAccountsAcrossAll = (users ?? []).reduce(
    (acc, u) => acc + (u.accountsCount || 0),
    0,
  );

  return (
    <div className="p-4 sm:p-10 space-y-8 max-w-[1300px] mx-auto">
      {/* Header */}
      <header className="pb-6 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[-0.05em] text-[#f0f0f2] leading-none uppercase">
            Users & Accounts
          </h1>
          <p className="meta-label mt-2">
            Team accounts, cash balances across brokerages, and account management.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading || isRefetching}
          className="font-mono text-xs border-white/10 hover:border-primary/40 hover:text-primary transition-all self-start sm:self-auto"
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isRefetching ? "animate-spin text-primary" : ""}`} />
          Refresh
        </Button>
      </header>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="stat-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="meta-label">Total Users</span>
            <UsersIcon className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white">
            {isLoading ? "—" : totalUsersCount}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mt-1">
            Registered Google & workspace members
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="meta-label">Total Cash in Accounts</span>
            <DollarSign className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-primary">
            {isLoading ? "—" : fmtMoney(totalCashAcrossAll)}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mt-1">
            Aggregated available cash across all accounts
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="meta-label">Connected Accounts</span>
            <Briefcase className="h-4 w-4 text-primary" />
          </div>
          <div className="text-2xl sm:text-3xl font-mono font-bold text-white">
            {isLoading ? "—" : totalAccountsAcrossAll}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground mt-1">
            Active brokerage, import & demo feeds
          </p>
        </div>
      </div>

      {/* Main Table Panel */}
      <div className="panel-box p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-white/[0.08] pb-3">
          <span className="meta-label flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> User Portfolio & Brokerage Accounts
          </span>
          {users && (
            <span className="neon-badge">
              {users.length} {users.length === 1 ? "user" : "users"} listed
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="py-12 text-center">
            <RefreshCw className="h-6 w-6 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground font-mono">Loading user data & account balances…</p>
          </div>
        ) : !users || users.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono py-10 text-center">
            No sign-ins yet. Once someone logs in with Google, their name, cash in accounts, and details will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-muted-foreground text-xs">
                  <th className="pb-3 font-normal meta-label">User</th>
                  <th className="pb-3 font-normal meta-label">Role</th>
                  <th className="pb-3 font-normal meta-label">Cash in Accounts</th>
                  <th className="pb-3 font-normal meta-label">Brokerage Accounts</th>
                  <th className="pb-3 font-normal meta-label">Holdings</th>
                  <th className="pb-3 font-normal meta-label">Last Sign-in</th>
                  <th className="pb-3 font-normal meta-label text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs font-mono">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors align-top">
                    {/* User info */}
                    <td className="py-4 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 border border-white/10 shrink-0">
                          {u.avatar ? (
                            <AvatarImage src={u.avatar} alt={u.name ?? ""} />
                          ) : null}
                          <AvatarFallback className="text-xs bg-primary text-black font-bold">
                            {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-sans font-medium text-sm text-white">
                            {u.name ?? "—"}
                          </div>
                          <div className="text-muted-foreground text-[11px]">
                            {u.email ?? "—"}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-4 pr-4">
                      <span
                        className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold border ${
                          u.role === "admin"
                            ? "bg-primary/20 text-primary border-primary/30"
                            : "bg-white/5 text-muted-foreground border-white/10"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>

                    {/* Cash in Accounts */}
                    <td className="py-4 pr-4">
                      <div>
                        <span className="text-sm font-bold text-primary tracking-tight">
                          {fmtMoney(u.totalCash)}
                        </span>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {u.accountsCount === 0
                            ? "No accounts"
                            : `${u.accountsCount} ${u.accountsCount === 1 ? "account" : "accounts"}`}
                        </div>
                      </div>
                    </td>

                    {/* Brokerage Accounts Breakdown */}
                    <td className="py-4 pr-4 max-w-xs">
                      {u.accounts.length === 0 ? (
                        <span className="text-muted-foreground/60 italic text-[11px]">
                          No linked accounts
                        </span>
                      ) : (
                        <div className="space-y-1.5">
                          {u.accounts.map((acc) => (
                            <div
                              key={acc.id}
                              className="p-2 rounded bg-white/[0.03] border border-white/[0.06] text-[11px] leading-tight"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-sans font-medium text-white truncate">
                                  {acc.name || acc.institution || "Account"}
                                </span>
                                <span className="font-mono text-primary font-bold shrink-0">
                                  {fmtMoney(acc.cash, acc.currency ?? "USD")}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 text-muted-foreground mt-1 text-[10px]">
                                {acc.number && <span>{acc.number}</span>}
                                {acc.number && <span>•</span>}
                                <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-white/5 border border-white/10">
                                  {acc.source}
                                </span>
                                {acc.enabled ? (
                                  <span className="text-emerald-400 flex items-center gap-0.5 ml-auto text-[9px]">
                                    <CheckCircle2 className="h-2.5 w-2.5" /> active
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground flex items-center gap-0.5 ml-auto text-[9px]">
                                    <XCircle className="h-2.5 w-2.5" /> disabled
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    {/* Holdings Count */}
                    <td className="py-4 pr-4 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Layers className="h-3 w-3 text-muted-foreground/70" />
                        <span>{u.positionsCount} pos</span>
                      </div>
                    </td>

                    {/* Last Sign-in */}
                    <td className="py-4 pr-4 text-muted-foreground whitespace-nowrap text-[11px]">
                      <div>{fmtDate(u.lastSignInAt)}</div>
                      <div className="text-[10px] text-muted-foreground/60">
                        Joined {fmtDate(u.createdAt)}
                      </div>
                    </td>

                    {/* Actions: Clear / Reset Account */}
                    <td className="py-4 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setSelectedUserForReset({
                            id: u.id,
                            name: u.name,
                            email: u.email,
                          })
                        }
                        className="font-mono text-[11px] h-7 px-2.5 text-yellow-400/90 border-yellow-500/30 hover:bg-yellow-500/10 hover:text-yellow-300 hover:border-yellow-500/60 transition-colors"
                        title="Clear brokerage links and synced data so this user can re-authenticate fresh (not banned)"
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reset Account
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Dialog for Clearing/Resetting User Account */}
      <AlertDialog
        open={selectedUserForReset !== null}
        onOpenChange={(open) => {
          if (!open && !resetMutation.isPending) {
            setSelectedUserForReset(null);
          }
        }}
      >
        <AlertDialogContent className="bg-[#111113] border-white/10 text-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-yellow-400 font-display text-xl uppercase tracking-tight">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              Reset User Account Data
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground space-y-2.5 pt-2">
              <p>
                Are you sure you want to clear and reset account connections for{" "}
                <strong className="text-white">
                  {selectedUserForReset?.name || selectedUserForReset?.email || "this user"}
                </strong>
                ?
              </p>
              <div className="p-3 rounded bg-yellow-500/10 border border-yellow-500/20 text-yellow-300/90 text-xs font-mono space-y-1">
                <div>✓ Clears linked brokerage accounts and cash balances</div>
                <div>✓ Wipes SnapTrade credentials and tokens</div>
                <div>✓ Removes synced/imported portfolio positions</div>
                <div className="text-white font-bold pt-1">
                  ✓ User is NOT banned — they can immediately re-authenticate and re-link their accounts.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-4 gap-2">
            <AlertDialogCancel
              disabled={resetMutation.isPending}
              className="bg-white/5 border-white/10 hover:bg-white/10 text-white font-mono text-xs"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={resetMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (selectedUserForReset) {
                  resetMutation.mutate({ userId: selectedUserForReset.id });
                }
              }}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-mono font-bold text-xs uppercase"
            >
              {resetMutation.isPending ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1.5 animate-spin" /> Resetting…
                </>
              ) : (
                "Confirm & Reset"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

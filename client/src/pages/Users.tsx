import { useEffect } from "react";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users as UsersIcon } from "lucide-react";

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
  const { data: users, isLoading, error } = trpc.admin.users.useQuery();

  useEffect(() => {
    if (error) toast.error(error.message);
  }, [error]);

  return (
    <div className="p-4 sm:p-10 space-y-8 max-w-[1200px] mx-auto">
      {/* Header */}
      <header className="pb-6 border-b border-white/[0.08]">
        <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[-0.05em] text-[#f0f0f2] leading-none uppercase">
          Users
        </h1>
        <p className="meta-label mt-2">
          Registered team accounts and access permissions.
        </p>
      </header>

      <div className="panel-box p-6 overflow-hidden">
        <div className="flex items-center justify-between mb-4 border-b border-white/[0.08] pb-3">
          <span className="meta-label flex items-center gap-2">
            <UsersIcon className="h-4 w-4 text-primary" /> Signed-in users
          </span>
          {users && (
            <span className="neon-badge">
              {users.length} total
            </span>
          )}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground font-mono py-6">Loading…</p>
        ) : !users || users.length === 0 ? (
          <p className="text-sm text-muted-foreground font-mono py-6 text-center">
            No sign-ins yet. Once someone logs in with Google, their name and email will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] text-muted-foreground text-xs">
                  <th className="pb-3 font-normal meta-label">User</th>
                  <th className="pb-3 font-normal meta-label">Email</th>
                  <th className="pb-3 font-normal meta-label">Role</th>
                  <th className="pb-3 font-normal meta-label">Last sign-in</th>
                  <th className="pb-3 font-normal meta-label">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.03] text-xs font-mono">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-7 w-7 border border-white/10 shrink-0">
                          {u.avatar ? (
                            <AvatarImage src={u.avatar} alt={u.name ?? ""} />
                          ) : null}
                          <AvatarFallback className="text-xs bg-primary text-black font-bold">
                            {(u.name ?? u.email ?? "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-sans font-medium text-sm text-white">
                          {u.name ?? "—"}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {u.email ?? "—"}
                    </td>
                    <td className="py-3">
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
                    <td className="py-3 text-muted-foreground whitespace-nowrap">
                      {fmtDate(u.lastSignInAt)}
                    </td>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">
                      {fmtDate(u.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

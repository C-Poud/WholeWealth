import { Rocket, Briefcase, TrendingUp, Sparkles } from "lucide-react";

export default function Career() {
  return (
    <div className="p-4 sm:p-10 space-y-8 max-w-[1500px] mx-auto">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-white/[0.08]">
        <div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[-0.05em] text-[#f0f0f2] leading-none uppercase">
            Career Optimiser
          </h1>
          <p className="meta-label mt-2">
            Your career trajectory, structured and optimised like a portfolio
          </p>
        </div>
        <span className="neon-badge shrink-0 self-start md:self-auto">Coming Soon</span>
      </header>

      {/* Hero panel */}
      <div className="panel-box p-8 sm:p-12 text-center">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded border border-primary/40 bg-primary/10 mb-6">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight mb-4">
          Professional Portfolio Engine
        </h2>
        <p className="text-muted-foreground font-sans max-w-xl mx-auto leading-relaxed text-sm">
          We&apos;re building a career optimisation engine that treats your
          professional growth like an options book — tracking skills as assets,
          measuring compounding returns on learning, and rebalancing your path toward high-leverage roles.
        </p>
      </div>

      {/* Teaser cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="stat-card">
          <Briefcase className="h-5 w-5 text-primary mb-3" />
          <div className="meta-label mb-2">Skill Tracking</div>
          <p className="text-sm text-muted-foreground leading-relaxed font-sans">
            Map your competencies like positions — spot single-asset concentration risk and identify high-yield skill acquisitions.
          </p>
        </div>
        <div className="stat-card">
          <TrendingUp className="h-5 w-5 text-primary mb-3" />
          <div className="meta-label mb-2">Growth Analytics</div>
          <p className="text-sm text-muted-foreground leading-relaxed font-sans">
            Measure the compounding rate of return across projects, credentials, and responsibilities over time.
          </p>
        </div>
        <div className="stat-card">
          <Sparkles className="h-5 w-5 text-primary mb-3" />
          <div className="meta-label mb-2">Smart Rebalancing</div>
          <p className="text-sm text-muted-foreground leading-relaxed font-sans">
            Actionable, data-driven suggestions to reposition your career path toward your highest asymmetric upside.
          </p>
        </div>
      </div>
    </div>
  );
}


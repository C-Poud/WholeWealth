import { Rocket, Briefcase, TrendingUp, Sparkles } from "lucide-react";

export default function Career() {
  return (
    <div className="p-6 sm:p-10 max-w-[1500px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4 mb-10">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Rocket className="h-7 w-7 text-primary" />
            <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight">
              Career Optimiser
            </h1>
          </div>
          <p className="text-muted-foreground font-mono text-sm">
            // your career, optimised like a portfolio
          </p>
        </div>
        <span className="neon-badge">COMING SOON</span>
      </div>

      {/* Hero panel */}
      <div className="panel-card p-8 sm:p-12 text-center mb-8">
        <div className="inline-flex items-center justify-center h-16 w-16 rounded-full border-2 border-primary/40 bg-primary/10 mb-6">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <h2 className="font-display text-2xl sm:text-3xl font-bold mb-4">
          Something big is brewing
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto leading-relaxed">
          We&apos;re building a career optimisation engine that treats your
          professional growth like a portfolio — tracking skills as assets,
          measuring returns on learning, and rebalancing your path toward the
          roles you want.
        </p>
      </div>

      {/* Teaser cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="panel-card stat-card-border p-6">
          <Briefcase className="h-6 w-6 text-primary mb-4" />
          <h3 className="font-display font-bold text-lg mb-2">Skill Tracking</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Map your skills like positions — spot concentration risk and gaps in
            your career book.
          </p>
        </div>
        <div className="panel-card stat-card-border p-6">
          <TrendingUp className="h-6 w-6 text-primary mb-4" />
          <h3 className="font-display font-bold text-lg mb-2">Growth Analytics</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Measure the compounding return of courses, projects, and roles over
            time.
          </p>
        </div>
        <div className="panel-card stat-card-border p-6">
          <Sparkles className="h-6 w-6 text-primary mb-4" />
          <h3 className="font-display font-bold text-lg mb-2">Smart Suggestions</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Get data-driven recommendations to rebalance your career toward your
            goals.
          </p>
        </div>
      </div>
    </div>
  );
}

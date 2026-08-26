import { useState } from "react";
import {
  Rocket,
  TrendingUp,
  Sparkles,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  DollarSign,
  MapPin,
  Award,
  Layers,
  MessageSquareCode,
  ShieldCheck,
  Zap,
  Lock,
  BarChart3,
  Scale,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface RegionData {
  id: string;
  name: string;
  seniorBase: number;
  seniorTotal: number;
  multiplier: number;
}

const REGIONS: RegionData[] = [
  { id: "sf", name: "San Francisco Bay Area", seniorBase: 195000, seniorTotal: 340000, multiplier: 1.25 },
  { id: "nyc", name: "New York Metro", seniorBase: 185000, seniorTotal: 310000, multiplier: 1.18 },
  { id: "sea", name: "Seattle / Austin", seniorBase: 175000, seniorTotal: 285000, multiplier: 1.08 },
  { id: "remote_us", name: "US Remote", seniorBase: 165000, seniorTotal: 260000, multiplier: 1.0 },
  { id: "lon", name: "London / UK", seniorBase: 125000, seniorTotal: 195000, multiplier: 0.8 },
  { id: "eu_remote", name: "Europe Remote", seniorBase: 110000, seniorTotal: 165000, multiplier: 0.72 },
];

const ROLES = [
  { id: "swe", label: "Software Engineer", baseMult: 1.0 },
  { id: "staff_swe", label: "Staff / Principal Engineer", baseMult: 1.35 },
  { id: "pm", label: "Product Manager / Tech Lead", baseMult: 1.05 },
  { id: "quant", label: "Quantitative Developer / AI Eng", baseMult: 1.45 },
  { id: "data", label: "Data Engineer / Analytics", baseMult: 0.95 },
];

const SAMPLE_SKILLS = [
  { name: "Distributed Systems & Go/Rust", premium: "+$24,000", demand: "Very High" },
  { name: "LLM Orchestration & Fine-tuning", premium: "+$32,000", demand: "Extreme" },
  { name: "Options / Derivatives Modeling", premium: "+$28,000", demand: "High" },
  { name: "React, Next.js & Full-Stack Node", premium: "+$12,000", demand: "High" },
  { name: "Cloud Infrastructure (K8s/AWS)", premium: "+$18,000", demand: "Very High" },
];

export default function Career() {
  const [selectedRegion, setSelectedRegion] = useState(REGIONS[0]);
  const [selectedRole, setSelectedRole] = useState(ROLES[0]);
  const [currentComp, setCurrentComp] = useState<number>(180000);
  const [yearsExp, setYearsExp] = useState<number>(5);
  const [activeTab, setActiveTab] = useState<"gap" | "skills" | "negotiation">("gap");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [isSimulatingUpload, setIsSimulatingUpload] = useState(false);
  const [isNotified, setIsNotified] = useState(false);

  // Compute calculated market comp
  const expMultiplier = Math.min(1.6, 0.85 + yearsExp * 0.07);
  const estimatedMarketComp = Math.round(
    selectedRegion.seniorTotal * selectedRole.baseMult * (expMultiplier / 1.2)
  );
  const compGap = Math.max(0, estimatedMarketComp - currentComp);
  const underpaidPct = currentComp > 0 ? Math.round((compGap / currentComp) * 100) : 0;

  const handleSimulateUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsSimulatingUpload(true);
    setTimeout(() => {
      setUploadedFileName(file.name);
      setIsSimulatingUpload(false);
    }, 1200);
  };

  return (
    <div className="p-4 sm:p-10 space-y-10 max-w-[1500px] mx-auto text-[#f0f0f2]">
      {/* ── Page Header ── */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/[0.08]">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary shadow-[0_0_10px_rgba(212,255,0,0.15)]">
              Under Development
            </span>
            <span className="text-xs font-mono text-muted-foreground flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-primary" /> AI + Quantitative Compensation Model
            </span>
          </div>
          <h1 className="font-display text-4xl sm:text-6xl font-extrabold tracking-[-0.05em] text-[#f0f0f2] leading-none uppercase">
            Career Optimizer
          </h1>
          <p className="text-sm font-mono text-muted-foreground mt-3 max-w-3xl leading-relaxed">
            Applying the exact same data-first discipline to human capital as financial capital.
            Using verified market datasets, regional benchmarks, and quantitative modeling to eliminate underpayment and command top-tier compensation.
          </p>
        </div>

        <div className="shrink-0 flex items-center gap-3">
          <Button
            onClick={() => setIsNotified(true)}
            className={`font-mono text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
              isNotified
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                : "bg-primary text-black hover:bg-primary/90 shadow-[0_0_20px_rgba(212,255,0,0.25)]"
            }`}
          >
            {isNotified ? (
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" /> Early Access Reserved
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 fill-black" /> Get Launch Alert
              </span>
            )}
          </Button>
        </div>
      </header>

      {/* ── Core Philosophy Callout: Data Over Guesswork ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 panel-box p-6 sm:p-8 bg-gradient-to-br from-[#121215] via-[#0d0d0f] to-[#0a0a0b] border border-white/10 rounded-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/[0.04] rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex items-center gap-2 mb-4">
            <Scale className="h-4 w-4 text-primary" />
            <span className="font-mono text-xs font-bold tracking-widest text-primary uppercase">
              The Unifying Principle
            </span>
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-tight text-white mb-4">
            Data Over Guesswork: Solving Two Compounding Wealth Leaks
          </h2>

          <p className="text-sm font-sans text-muted-foreground leading-relaxed mb-6">
            NetWorth.io was founded on a simple truth: financial freedom is throttled by two major inefficiencies:
            <strong className="text-white"> underperforming investment portfolios</strong> and
            <strong className="text-white"> underpaid employees</strong>. Both stem from the exact same flaw — relying on intuition and opaque market quotes rather than transparent quantitative data.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-white/[0.08]">
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-1.5">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span className="font-mono text-xs font-bold text-white uppercase">Financial Capital</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Options Greeks, automated basis reduction, dynamic covered calls, and algorithmic delta-neutral risk control.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white/[0.02] border border-primary/20 bg-primary/[0.02]">
              <div className="flex items-center gap-2 mb-1.5">
                <Rocket className="h-4 w-4 text-primary" />
                <span className="font-mono text-xs font-bold text-primary uppercase">Human Capital</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Regional compensation benchmarks, skill-premium multipliers, AI-driven counter-offer scripting, and leverage analysis.
              </p>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 panel-box p-6 sm:p-8 flex flex-col justify-between bg-[#111114] border border-white/10 rounded-xl">
          <div>
            <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold uppercase mb-3">
              <Award className="h-4 w-4" /> Lifetime Impact
            </div>
            <div className="font-display text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              +$850,000<span className="text-primary text-xl font-mono">+</span>
            </div>
            <div className="text-xs font-mono text-muted-foreground mt-1 mb-4">
              Estimated 10-year wealth difference from closing salary gaps and compounding market earnings.
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed border-t border-white/[0.06] pt-4">
              Behind the scenes, we use AI and real compensation datasets by region and specialization — empowering you to negotiate from mathematical strength.
            </p>
          </div>

          <div className="pt-4 mt-4 border-t border-white/[0.06] flex items-center justify-between text-[11px] font-mono text-muted-foreground">
            <span>Confidential & Private</span>
            <span className="text-primary flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Client-Side Safe
            </span>
          </div>
        </div>
      </div>

      {/* ── Interactive Compensation & Underpay Simulator (Placeholder) ── */}
      <div className="panel-box p-6 sm:p-8 bg-[#0e0e11] border border-white/10 rounded-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div>
            <h3 className="font-display text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Interactive Market Gap Simulator (Preview)
            </h3>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Experiment with regional data and role specializations to see how the model calculates underpayment.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white/[0.04] p-1 rounded-lg border border-white/[0.08]">
            <button
              onClick={() => setActiveTab("gap")}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                activeTab === "gap"
                  ? "bg-primary text-black font-bold shadow-[0_0_10px_rgba(212,255,0,0.2)]"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Compensation Gap
            </button>
            <button
              onClick={() => setActiveTab("skills")}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                activeTab === "skills"
                  ? "bg-primary text-black font-bold shadow-[0_0_10px_rgba(212,255,0,0.2)]"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Skill Premiums
            </button>
            <button
              onClick={() => setActiveTab("negotiation")}
              className={`px-3 py-1.5 rounded text-xs font-mono font-semibold transition-all cursor-pointer ${
                activeTab === "negotiation"
                  ? "bg-primary text-black font-bold shadow-[0_0_10px_rgba(212,255,0,0.2)]"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Negotiation Copilot
            </button>
          </div>
        </div>

        {/* Tab 1: Compensation Gap & Regional Inputs */}
        {activeTab === "gap" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Input Controls */}
            <div className="lg:col-span-6 space-y-5">
              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                  Target Geographic Market / Region
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {REGIONS.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setSelectedRegion(r)}
                      className={`text-left p-3 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                        selectedRegion.id === r.id
                          ? "bg-white/[0.08] border-primary text-white shadow-[0_0_12px_rgba(212,255,0,0.1)]"
                          : "bg-white/[0.02] border-white/[0.06] text-muted-foreground hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <div className="font-semibold text-white truncate">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        Index: {r.multiplier}x benchmark
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                    Role Category
                  </label>
                  <select
                    value={selectedRole.id}
                    onChange={(e) => {
                      const found = ROLES.find((r) => r.id === e.target.value);
                      if (found) setSelectedRole(found);
                    }}
                    className="w-full bg-[#141418] border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-primary"
                  >
                    {ROLES.map((role) => (
                      <option key={role.id} value={role.id} className="bg-[#141418] text-white">
                        {role.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                    Years of Experience ({yearsExp} yrs)
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={yearsExp}
                    onChange={(e) => setYearsExp(Number(e.target.value))}
                    className="w-full accent-primary h-2 bg-white/10 rounded-lg cursor-pointer mt-2"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-mono uppercase text-muted-foreground mb-1.5">
                  Current Total Compensation (USD / yr)
                </label>
                <div className="relative flex items-center group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="5000"
                    min="0"
                    value={currentComp}
                    onChange={(e) => setCurrentComp(Math.max(0, Number(e.target.value) || 0))}
                    className="w-full bg-[#141418] border border-white/10 rounded-lg pl-7 pr-8 py-2 text-xs font-mono text-white focus:outline-none focus:border-primary [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none transition-colors"
                  />
                  <div className="absolute right-1 inset-y-1 flex flex-col justify-center gap-0.5 border-l border-white/10 pl-1 pr-0.5">
                    <button
                      type="button"
                      onClick={() => setCurrentComp(prev => Math.max(0, prev + 5000))}
                      className="flex-1 px-1 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer group/btn"
                      aria-label="Increase compensation by $5,000"
                      title="Increase ($5,000)"
                    >
                      <ChevronUp className="h-2.5 w-2.5 transition-transform group-hover/btn:scale-125" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCurrentComp(prev => Math.max(0, prev - 5000))}
                      className="flex-1 px-1 flex items-center justify-center rounded text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer group/btn"
                      aria-label="Decrease compensation by $5,000"
                      title="Decrease ($5,000)"
                    >
                      <ChevronDown className="h-2.5 w-2.5 transition-transform group-hover/btn:scale-125" />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Output Gap Display */}
            <div className="lg:col-span-6 p-6 rounded-xl bg-gradient-to-b from-[#131317] to-[#09090b] border border-white/10 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                    Model Benchmark Valuation
                  </span>
                  <span className="text-xs font-mono text-primary font-bold">
                    P75 Peer Level
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[10px] font-mono text-muted-foreground uppercase">Your Current Comp</div>
                    <div className="text-lg font-mono font-bold text-white mt-1">
                      ${currentComp.toLocaleString()}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/30">
                    <div className="text-[10px] font-mono text-primary uppercase font-bold">Fair Market Comp</div>
                    <div className="text-lg font-mono font-bold text-primary mt-1">
                      ${estimatedMarketComp.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Calculated Underpay Delta:</span>
                    <span className={`font-bold ${compGap > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {compGap > 0 ? `-$${compGap.toLocaleString()}/yr` : "Market Aligned"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted-foreground">Discount to Market:</span>
                    <span className={`font-bold ${underpaidPct > 0 ? "text-amber-400" : "text-emerald-400"}`}>
                      {underpaidPct > 0 ? `${underpaidPct}% below P75` : "0%"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-mono flex items-start gap-2.5">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" />
                <span>
                  {compGap > 0
                    ? `Our AI model identifies a potential $${(compGap * 3).toLocaleString()} 3-year gap. You have significant leverage to renegotiate base salary and equity vesting.`
                    : `You are currently aligned with market medians. The next step is optimizing equity grants and skill-premium add-ons.`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Skill Premiums */}
        {activeTab === "skills" && (
          <div className="space-y-4">
            <p className="text-xs font-mono text-muted-foreground">
              Market data reveals that compensation is heavily skewed by specific asymmetric skill acquisitions.
              Here is an excerpt of live skill premium benchmarks modeled in our system:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {SAMPLE_SKILLS.map((skill, idx) => (
                <div key={idx} className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono mb-2">
                      <span className="text-primary font-bold uppercase">{skill.demand} Demand</span>
                      <span className="text-emerald-400 font-bold">{skill.premium}/yr</span>
                    </div>
                    <div className="text-sm font-semibold text-white">{skill.name}</div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>Compounding Yield: High</span>
                    <span className="text-primary flex items-center gap-1">
                      Learn & Leverage <ArrowRight className="h-2.5 w-2.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Negotiation Playbook */}
        {activeTab === "negotiation" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] space-y-2">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold uppercase">
                <MessageSquareCode className="h-4 w-4" /> 1. Data-Backed Anchor
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Never disclose previous salary. Anchor directly to verified P75 regional comp datasets with quantified peer percentiles.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] space-y-2">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold uppercase">
                <Layers className="h-4 w-4" /> 2. Tranche Negotiation
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Isolate Base, Sign-on Bonus, and Equity. If base salary hits corporate bands, trade for accelerated vesting or refreshers.
              </p>
            </div>

            <div className="p-4 rounded-lg bg-white/[0.02] border border-white/[0.08] space-y-2">
              <div className="flex items-center gap-2 text-primary font-mono text-xs font-bold uppercase">
                <ShieldCheck className="h-4 w-4" /> 3. Counter-Offer Scripts
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI generates polite, confident, and mathematically grounded counter-offer emails tailored specifically to the hiring manager.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Mock Resume Upload Area (Placeholder Concept) ── */}
      <div className="panel-box p-6 sm:p-8 bg-[#101013] border border-white/10 rounded-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-lg font-bold text-white uppercase tracking-tight flex items-center gap-2">
              <UploadCloud className="h-4 w-4 text-primary" /> Resume & Experience Upload (Concept Preview)
            </h3>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              Drop your resume to automatically extract your skills, estimate your market valuation, and generate negotiation scripts.
            </p>
          </div>
          <span className="text-[10px] font-mono text-muted-foreground px-2 py-0.5 rounded bg-white/[0.05] border border-white/10 self-start sm:self-auto">
            Placeholder UI • No data stored
          </span>
        </div>

        {/* Dropzone Container */}
        <label className="relative flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed border-white/15 hover:border-primary/50 bg-white/[0.01] hover:bg-primary/[0.02] rounded-xl cursor-pointer transition-all group">
          <input
            type="file"
            accept=".pdf,.docx,.txt"
            onChange={handleSimulateUpload}
            className="sr-only"
          />

          <div className="flex flex-col items-center text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:border-primary/40 group-hover:bg-primary/10 transition-all">
              {isSimulatingUpload ? (
                <Sparkles className="h-6 w-6 text-primary animate-spin" />
              ) : uploadedFileName ? (
                <FileText className="h-6 w-6 text-primary" />
              ) : (
                <UploadCloud className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
              )}
            </div>

            {isSimulatingUpload ? (
              <div className="space-y-1">
                <div className="text-xs font-mono font-bold text-primary">Simulating AI Document Parsing…</div>
                <div className="text-[11px] font-mono text-muted-foreground">Extracting experience, titles, and competencies</div>
              </div>
            ) : uploadedFileName ? (
              <div className="space-y-1">
                <div className="text-xs font-mono font-bold text-emerald-400 flex items-center justify-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> {uploadedFileName} parsed successfully
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  Detected 14 verified skills &bull; Estimated market level: Senior (P80)
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="text-xs font-mono font-semibold text-white group-hover:text-primary transition-colors">
                  Click to select or drag and drop your resume (PDF or DOCX)
                </div>
                <div className="text-[11px] font-mono text-muted-foreground">
                  Simulated local preview &bull; Zero external upload during beta preview
                </div>
              </div>
            )}
          </div>
        </label>
      </div>

      {/* ── Feature Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <MapPin className="h-5 w-5 text-primary" />
            <span className="text-[10px] font-mono text-primary font-bold">REGIONAL AI</span>
          </div>
          <div className="meta-label mb-1.5 text-white">Cost-of-Living & Tax Arbitrage</div>
          <p className="text-xs text-muted-foreground leading-relaxed font-sans">
            Calculate your true net disposable income across global hubs. Model how remote work contracts compare to on-site SF/NYC offers.
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-[10px] font-mono text-primary font-bold">COMPOUNDING</span>
          </div>
          <div className="meta-label mb-1.5 text-white">Equity & Options Valuation</div>
          <p className="text-xs text-muted-foreground leading-relaxed font-sans">
            Value private startup ISOs, RSUs, and strike prices with the same options analytics engine used in the Portfolio toolkit.
          </p>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between mb-3">
            <Lock className="h-5 w-5 text-primary" />
            <span className="text-[10px] font-mono text-primary font-bold">100% PRIVATE</span>
          </div>
          <div className="meta-label mb-1.5 text-white">Confidential Strategy</div>
          <p className="text-xs text-muted-foreground leading-relaxed font-sans">
            No public profiles, no recruiter tracking. Run private scenarios to maximize your leverage without alerting your employer.
          </p>
        </div>
      </div>
    </div>
  );
}

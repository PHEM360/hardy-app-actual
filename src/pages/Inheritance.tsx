import { useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Calculator, Plus, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Asset { id: string; name: string; value: number; growthRate: number; type: "property" | "investment" | "cash" | "other" }
interface GiftPlan { id: string; recipientName: string; annualAmount: number; startYear: number; endYear: number }
interface Scenario { id: string; name: string; assets: Asset[]; gifts: GiftPlan[]; nilRateBand: number; residenceNilRate: number; inflationRate: number }

const IHT_RATE = 0.4;

function projectScenario(scenario: Scenario, years: number) {
  const data: any[] = [];
  for (let y = 0; y <= years; y++) {
    const year = new Date().getFullYear() + y;
    let totalValue = scenario.assets.reduce((sum, a) => sum + a.value * Math.pow(1 + a.growthRate / 100, y), 0);
    const totalGifts = scenario.gifts.reduce((sum, g) => year >= g.startYear && year <= g.endYear ? sum + g.annualAmount : sum, 0);
    totalValue -= totalGifts * y;
    if (totalValue < 0) totalValue = 0;
    const exempt = scenario.nilRateBand + scenario.residenceNilRate;
    const taxable = Math.max(0, totalValue - exempt);
    const iht = taxable * IHT_RATE;
    data.push({ year: String(year), estate: Math.round(totalValue), taxable: Math.round(taxable), iht: Math.round(iht), afterTax: Math.round(totalValue - iht) });
  }
  return data;
}

const DEFAULT_SCENARIO: Scenario = {
  id: "s1", name: "Current Plan",
  assets: [
    { id: "as1", name: "Family Home", value: 450000, growthRate: 3, type: "property" },
    { id: "as2", name: "ISAs & Savings", value: 120000, growthRate: 4, type: "investment" },
    { id: "as3", name: "Pension (death benefit)", value: 80000, growthRate: 5, type: "investment" },
    { id: "as4", name: "Cash", value: 25000, growthRate: 1, type: "cash" },
  ],
  gifts: [],
  nilRateBand: 325000, residenceNilRate: 175000, inflationRate: 2.5,
};

const GIFTING_SCENARIO: Scenario = {
  ...DEFAULT_SCENARIO, id: "s2", name: "With Gifting",
  gifts: [{ id: "g1", recipientName: "Children", annualAmount: 6000, startYear: 2025, endYear: 2035 }],
};

const Inheritance = () => {
  const [scenarios] = useState([DEFAULT_SCENARIO, GIFTING_SCENARIO]);
  const [selectedId, setSelectedId] = useState(scenarios[0].id);
  const projectionYears = 20;

  const projections = scenarios.map((s) => ({ scenario: s, data: projectScenario(s, projectionYears) }));
  const selected = projections.find((p) => p.scenario.id === selectedId)!;
  const finalEstate = selected.data[selected.data.length - 1];

  return (
    <FeaturePageShell title="IHT Planner" subtitle="Inheritance tax scenario modelling" icon={<Calculator className="w-5 h-5" />}>
      {/* Summary */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-gradient-primary mb-5">
        <p className="text-xs text-primary-foreground/70 uppercase tracking-wider font-medium">Projected Estate ({projectionYears}yr)</p>
        <p className="text-2xl font-bold font-display text-primary-foreground mt-1">£{finalEstate.estate.toLocaleString("en-GB")}</p>
        <div className="flex gap-4 mt-2 text-xs text-primary-foreground/80">
          <span>IHT: £{finalEstate.iht.toLocaleString("en-GB")}</span>
          <span>After tax: £{finalEstate.afterTax.toLocaleString("en-GB")}</span>
        </div>
      </motion.div>

      {/* Scenario Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl mb-5">
        {scenarios.map((s) => (
          <button key={s.id} onClick={() => setSelectedId(s.id)} className={`flex-1 text-xs font-semibold py-2 rounded-lg transition-all ${selectedId === s.id ? "bg-card text-foreground shadow-soft" : "text-muted-foreground"}`}>
            {s.name}
          </button>
        ))}
      </div>

      {/* Projection Chart */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Estate Projection</h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={selected.data}>
              <defs>
                <linearGradient id="estateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(168, 55%, 38%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(168, 55%, 38%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ihtGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0, 72%, 51%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 88%)" />
              <XAxis dataKey="year" tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${(v / 1000).toFixed(0)}k`} width={45} />
              <Tooltip formatter={(v: number) => `£${v.toLocaleString("en-GB")}`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="estate" name="Estate Value" stroke="hsl(168, 55%, 38%)" fill="url(#estateGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="iht" name="IHT Liability" stroke="hsl(0, 72%, 51%)" fill="url(#ihtGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="afterTax" name="After Tax" stroke="hsl(210, 70%, 52%)" fill="none" strokeWidth={1.5} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Assets */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Assets</h3>
        <div className="space-y-2">
          {selected.scenario.assets.map((asset) => (
            <div key={asset.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-card-foreground">{asset.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{asset.type} · {asset.growthRate}% growth</p>
              </div>
              <span className="text-sm font-bold font-display text-card-foreground">£{asset.value.toLocaleString("en-GB")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gifts */}
      {selected.scenario.gifts.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Gift Plans</h3>
          <div className="space-y-2">
            {selected.scenario.gifts.map((gift) => (
              <div key={gift.id} className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">To {gift.recipientName}</p>
                  <p className="text-[10px] text-muted-foreground">{gift.startYear}–{gift.endYear}</p>
                </div>
                <span className="text-sm font-bold font-display text-card-foreground">£{gift.annualAmount.toLocaleString("en-GB")}/yr</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Thresholds */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Tax Thresholds</h3>
        <div className="space-y-2">
          {[
            ["Nil Rate Band", `£${selected.scenario.nilRateBand.toLocaleString("en-GB")}`],
            ["Residence Nil Rate", `£${selected.scenario.residenceNilRate.toLocaleString("en-GB")}`],
            ["Combined Exemption", `£${(selected.scenario.nilRateBand + selected.scenario.residenceNilRate).toLocaleString("en-GB")}`],
            ["IHT Rate", "40%"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between">
              <span className="text-xs text-muted-foreground">{label}</span>
              <span className="text-xs font-medium text-card-foreground">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-5 px-4">
        This is a planning tool only and does not constitute financial advice. Consult a qualified adviser for personalised guidance.
      </p>
    </FeaturePageShell>
  );
};

export default Inheritance;

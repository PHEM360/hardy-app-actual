import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeartPulse, Plus, Pill, Activity, Sparkles, Trash2, Eye, EyeOff, FlaskConical, Lock, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import HealthMetrics from "@/components/health/HealthMetrics";
import HealthMeds from "@/components/health/HealthMeds";
import HealthSubstances from "@/components/health/HealthSubstances";
import HealthCustomTab from "@/components/health/HealthCustomTab";
import AiHealthAssessment from "@/components/health/AiHealthAssessment";
import { useWeightTracker } from "@/hooks/useWeightTracker";
import { useMeds } from "@/hooks/useMeds";
import { useHealthTabs, type FieldType } from "@/hooks/useHealthTabs";
import { useHealthProfile } from "@/hooks/useHealthProfile";
import { format, parseISO } from "date-fns";

const EMOJIS = ["🧘", "🍷", "💊", "🚭", "🍕", "😴", "🏃", "❤️", "🧠", "⚡", "🌿", "🌊", "🎯", "💪", "✨"];
const COLORS  = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

// ── Mini sparkline (pure SVG, no extra deps) ──────────────────────────────────
function MiniSparkline({
  values,
  color = "#ffffff",
  width = 80,
  height = 36,
}: {
  values: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 3;
  const w = width - pad * 2;
  const h = height - pad * 2;

  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return `${x},${y}`;
  });
  const polyline = pts.join(" ");
  // Fill area under line
  const first = pts[0];
  const last  = pts[pts.length - 1];
  const area  = `${first} ${polyline} ${last.split(",")[0]},${pad + h} ${pad},${pad + h}`;

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={`sg-${color.replace("#","")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#sg-${color.replace("#","")})`} />
      <polyline points={polyline} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Latest value dot */}
      <circle cx={pts[pts.length - 1].split(",")[0]} cy={pts[pts.length - 1].split(",")[1]} r="2.5" fill={color} />
    </svg>
  );
}

type CoreTab = "overview" | "metrics" | "meds" | "substances" | "ai";

export default function Health() {
  const { entries, heightEntries, bpEntries, measurements } = useWeightTracker();
  const { medications } = useMeds();
  const { tabs, addTab, deleteTab } = useHealthTabs();
  const { profile, saveProfile } = useHealthProfile();

  const [activeTab, setActiveTab] = useState<CoreTab | string>("overview");
  const [newTabOpen, setNewTabOpen] = useState(false);

  // New tab form
  const [ntName, setNtName]           = useState("");
  const [ntEmoji, setNtEmoji]         = useState("🧘");
  const [ntColor, setNtColor]         = useState(COLORS[0]);
  const [ntAi, setNtAi]               = useState(false);
  const [ntSobriety, setNtSobriety]   = useState(false);
  const [ntSobStart, setNtSobStart]   = useState(new Date().toISOString().split("T")[0]);
  const [ntSaving, setNtSaving]       = useState(false);

  const createTab = async () => {
    if (!ntName.trim()) return;
    setNtSaving(true);
    try {
      const fields = ntSobriety ? [{ id: "sobriety", label: "Days clean", type: "sobriety" as FieldType }] : [];
      const id = await addTab({
        name: ntName.trim(), emoji: ntEmoji, color: ntColor,
        order: tabs.length, enableAiChat: ntAi,
        sobrietyStartDate: ntSobriety ? ntSobStart : undefined,
        fields,
      });
      setNewTabOpen(false);
      setNtName(""); setNtEmoji("🧘"); setNtColor(COLORS[0]); setNtAi(false); setNtSobriety(false);
      if (id) setActiveTab(id);
    } finally { setNtSaving(false); }
  };

  const CORE_TABS = [
    { id: "overview",    label: "Overview",       icon: <HeartPulse className="w-4 h-4" /> },
    { id: "metrics",     label: "Weight & Stats",  icon: <Activity className="w-4 h-4" /> },
    { id: "meds",        label: "Medications",     icon: <Pill className="w-4 h-4" /> },
    { id: "substances",  label: "Substances",      icon: <FlaskConical className="w-4 h-4" /> },
    { id: "ai",          label: "AI Analysis",     icon: <Brain className="w-4 h-4" /> },
  ];

  const activeCustomTab = tabs.find((t) => t.id === activeTab);

  // Derived overview data
  const latestWeight   = entries[entries.length - 1];
  const prevWeight     = entries[entries.length - 2];
  const latestHeight   = heightEntries[heightEntries.length - 1];
  const latestBP       = bpEntries[bpEntries.length - 1];
  const prevBP         = bpEntries[bpEntries.length - 2];
  const latestMeas     = measurements[measurements.length - 1];
  const prevMeas       = measurements[measurements.length - 2];
  const activeMeds     = medications.filter((m) => m.active);

  const weightDiff = latestWeight && prevWeight ? latestWeight.weight - prevWeight.weight : null;
  const bpDiff     = latestBP && prevBP ? latestBP.systolic - prevBP.systolic : null;
  const waistDiff  = latestMeas?.waistCm && prevMeas?.waistCm ? latestMeas.waistCm - prevMeas.waistCm : null;
  const bmi        = latestWeight && latestHeight ? latestWeight.weight / Math.pow(latestHeight.height / 100, 2) : null;

  function DeltaBadge({ val, unit = "" }: { val: number | null; unit?: string }) {
    if (val === null || val === 0) return null;
    const pos = val > 0;
    return (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pos ? "bg-red-100 text-red-600" : "bg-green-100 text-green-700"}`}>
        {pos ? "+" : ""}{val.toFixed(1)}{unit}
      </span>
    );
  }

  return (
    <FeaturePageShell
      title="Health"
      subtitle="Your personal health dashboard"
      icon={<HeartPulse className="w-5 h-5" />}
    >
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none -mx-1 px-1">
        {CORE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as CoreTab)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap flex-shrink-0 transition-all border ${
              activeTab === t.id
                ? "bg-primary text-primary-foreground border-primary shadow-md scale-[1.02]"
                : "bg-card text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
            }`}
          >
            {t.icon}<span>{t.label}</span>
          </button>
        ))}

        {/* Custom tabs */}
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap flex-shrink-0 transition-all border ${
              activeTab === tab.id
                ? "text-white border-transparent shadow-md scale-[1.02]"
                : "bg-card text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
            }`}
            style={activeTab === tab.id ? { backgroundColor: tab.color, borderColor: tab.color } : {}}
          >
            <span>{tab.emoji}</span>{tab.name}
          </button>
        ))}

        {/* Add tab */}
        <button
          onClick={() => setNewTabOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap flex-shrink-0 text-muted-foreground border border-dashed border-border/60 hover:border-border hover:text-foreground transition-all"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
        >
          {activeTab === "overview" && (
            <div>
              {/* ── Visibility toggles ── */}
              <div className="flex items-center gap-2 flex-wrap mb-4">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mr-1">Show:</span>
                {(
                  [
                    { key: "showWeightOnOverview", label: "Weight" },
                    { key: "showBpOnOverview",      label: "Blood Pressure" },
                    { key: "showWaistOnOverview",   label: "Waist" },
                    { key: "showMedsOnOverview",    label: "Medications" },
                  ] as { key: keyof typeof profile; label: string }[]
                ).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => saveProfile({ [key]: !profile[key] })}
                    className={`flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors ${
                      profile[key]
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-muted/40 border-border/40 text-muted-foreground"
                    }`}
                  >
                    {profile[key] ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    {label}
                  </button>
                ))}
              </div>

              {/* ── Stat cards ── */}
              <div className="space-y-3 mb-5">
                {profile.showWeightOnOverview && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-2xl bg-gradient-primary">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-primary-foreground/70 uppercase tracking-wider font-semibold mb-1">Weight</p>
                        <p className="text-3xl font-black font-display text-primary-foreground">
                          {latestWeight ? `${latestWeight.weight} kg` : "—"}
                        </p>
                        {prevWeight && (
                          <p className="text-xs text-primary-foreground/70 mt-0.5">
                            Previous: {prevWeight.weight} kg · {prevWeight.date ? format(parseISO(prevWeight.date), "d MMM") : ""}
                          </p>
                        )}
                        {bmi && <p className="text-xs text-primary-foreground/80 mt-0.5">BMI {bmi.toFixed(1)}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <DeltaBadge val={weightDiff} unit=" kg" />
                        <MiniSparkline
                          values={entries.slice(-12).map((e) => e.weight)}
                          color="rgba(255,255,255,0.9)"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {profile.showBpOnOverview && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04 }}
                    className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Blood Pressure</p>
                        <p className="text-3xl font-black font-display text-card-foreground">
                          {latestBP ? `${latestBP.systolic}/${latestBP.diastolic}` : "—"}
                          {latestBP && <span className="text-sm font-normal text-muted-foreground ml-1">mmHg</span>}
                        </p>
                        {latestBP?.heartRate && <p className="text-xs text-muted-foreground mt-0.5">HR {latestBP.heartRate} bpm</p>}
                        {prevBP && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Previous: {prevBP.systolic}/{prevBP.diastolic} · {prevBP.date ? format(parseISO(prevBP.date), "d MMM") : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <DeltaBadge val={bpDiff} unit=" sys" />
                        {bpEntries.length >= 2 && (
                          <div className="flex flex-col gap-0.5 items-end">
                            <MiniSparkline
                              values={bpEntries.slice(-12).map((e) => e.systolic)}
                              color="#ef4444"
                            />
                            <MiniSparkline
                              values={bpEntries.slice(-12).map((e) => e.diastolic)}
                              color="#3b82f6"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {profile.showWaistOnOverview && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
                    className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Waist</p>
                        <p className="text-3xl font-black font-display text-card-foreground">
                          {latestMeas?.waistCm ? `${latestMeas.waistCm} cm` : "—"}
                        </p>
                        {prevMeas?.waistCm && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Previous: {prevMeas.waistCm} cm · {prevMeas.date ? format(parseISO(prevMeas.date), "d MMM") : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <DeltaBadge val={waistDiff} unit=" cm" />
                        <MiniSparkline
                          values={measurements.filter((m) => m.waistCm != null).slice(-12).map((m) => m.waistCm!)}
                          color="#10b981"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {profile.showMedsOnOverview && activeMeds.length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}
                    className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-2">Active Medications</p>
                    <div className="flex flex-wrap gap-2">
                      {activeMeds.map((m) => (
                        <span key={m.id} className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border"
                          style={{ borderColor: m.color + "60", backgroundColor: m.color + "18", color: m.color }}>
                          <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: m.color }} />
                          {m.name} {m.dose}{m.unit}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ── Quick nav ── */}
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setActiveTab("metrics")} className="p-4 rounded-2xl bg-card border border-border/50 text-left hover:border-border transition-colors">
                  <Activity className="w-5 h-5 text-green-500 mb-2" />
                  <p className="text-sm font-bold text-card-foreground">Weight &amp; Stats</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Charts, BP, AI analysis</p>
                </button>
                <button onClick={() => setActiveTab("meds")} className="p-4 rounded-2xl bg-card border border-border/50 text-left hover:border-border transition-colors">
                  <Pill className="w-5 h-5 text-blue-500 mb-2" />
                  <p className="text-sm font-bold text-card-foreground">Medications</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{activeMeds.length} active med{activeMeds.length !== 1 ? "s" : ""}</p>
                </button>
                {tabs.slice(0, 2).map((tab) => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="p-4 rounded-2xl bg-card border border-border/50 text-left hover:border-border transition-colors">
                    <span className="text-xl mb-2 block">{tab.emoji}</span>
                    <p className="text-sm font-bold text-card-foreground">{tab.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Custom tracker</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeTab === "metrics" && <HealthMetrics />}
          {activeTab === "meds"    && <HealthMeds />}
          {activeTab === "substances" && <HealthSubstances />}
          {activeTab === "ai" && (
            <AiHealthAssessment
              entries={entries}
              heightEntries={heightEntries}
              bpEntries={bpEntries}
              measurements={measurements}
              medications={medications}
              profile={profile}
            />
          )}

          {activeCustomTab && (
            <div>
              <HealthCustomTab tab={activeCustomTab} />
              <div className="mt-6 pt-4 border-t border-border/30">
                <button
                  onClick={() => { deleteTab(activeCustomTab.id); setActiveTab("overview"); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete this tab
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── New tab dialog ─────────────────────────────────────────────────── */}
      <Dialog open={newTabOpen} onOpenChange={setNewTabOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Create New Tab
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Tab name</Label>
              <Input value={ntName} onChange={(e) => setNtName(e.target.value)} placeholder="e.g. Sobriety, Sleep, Mood…" className="h-11 rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJIS.map((em) => (
                  <button key={em} onClick={() => setNtEmoji(em)}
                    className={`text-xl rounded-xl p-1.5 transition-all ${ntEmoji === em ? "bg-primary/15 ring-1 ring-primary scale-110" : "hover:bg-muted"}`}>
                    {em}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Colour</Label>
              <div className="flex gap-2.5">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setNtColor(c)}
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${ntColor === c ? "border-foreground scale-125" : "border-transparent"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between py-1">
              <div>
                <Label>Sobriety tracker</Label>
                <p className="text-[11px] text-muted-foreground">Track days clean from a substance</p>
              </div>
              <Switch checked={ntSobriety} onCheckedChange={setNtSobriety} />
            </div>

            {ntSobriety && (
              <div className="space-y-1.5">
                <Label>Clean since</Label>
                <Input type="date" value={ntSobStart} onChange={(e) => setNtSobStart(e.target.value)} className="h-11 rounded-xl" />
              </div>
            )}

            <div className="flex items-center justify-between py-1">
              <div>
                <Label>AI companion chat</Label>
                <p className="text-[11px] text-muted-foreground">Include a supportive AI chat in this tab</p>
              </div>
              <Switch checked={ntAi} onCheckedChange={setNtAi} />
            </div>

            <Button onClick={createTab} disabled={ntSaving || !ntName.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">
              {ntSaving ? "Creating…" : "Create Tab"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
}

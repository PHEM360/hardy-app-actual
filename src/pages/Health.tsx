import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeartPulse, Plus, Pill, Activity, Sparkles, Trash2, Eye, EyeOff, FlaskConical, Lock, Brain, FolderOpen, FileText, Download, Upload } from "lucide-react";
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
import { useDocuments } from "@/hooks/useDocuments";
import { useSharedScope } from "@/hooks/useSharedScope";
import ShareAccessButton from "@/components/sharing/ShareAccessButton";
import SharedScopeSwitcher from "@/components/sharing/SharedScopeSwitcher";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { format, parseISO } from "date-fns";

const EMOJIS = ["🧘", "🍷", "💊", "🚭", "🍕", "😴", "🏃", "❤️", "🧠", "⚡", "🌿", "🌊", "🎯", "💪", "✨"];
const COLORS  = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

// ── Mini sparkline (pure SVG, no extra deps) ──────────────────────────────────
function MiniSparkline({
  values,
  values2,
  dates,
  color = "#ffffff",
  color2,
  width = 112,
  height = 64,
}: {
  values: number[];
  values2?: number[];
  dates?: string[];
  color?: string;
  color2?: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;

  const xAxisH = 15; // bottom reserved for date labels — clear of the chart
  const yAxisW = 22; // left reserved for y-axis labels
  const padT   = 5;
  const padR   = 4;
  const chartH = height - xAxisH - padT;
  const chartW = width - yAxisW - padR;
  const chartX = yAxisW; // chart starts after y-axis labels

  const allVals = values2 ? [...values, ...values2] : values;
  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;

  const toX = (i: number, len: number) => chartX + (i / (len - 1)) * chartW;
  const toY = (v: number) => padT + chartH - ((v - min) / range) * chartH;

  const pts1 = values.map((v, i) => `${toX(i, values.length)},${toY(v)}`);
  const pts2 = values2?.map((v, i) => `${toX(i, values2.length)},${toY(v)}`);
  const fillPts1 = `${chartX},${padT + chartH} ${pts1.join(" ")} ${toX(values.length - 1, values.length)},${padT + chartH}`;

  const labelFirst = dates?.[0]                      ? format(parseISO(dates[0]),                       "d MMM") : "";
  const labelLast  = dates && dates.length > 0       ? format(parseISO(dates[dates.length - 1]),        "d MMM") : "";

  const fmt = (v: number) => v % 1 === 0 ? String(v) : v.toFixed(1);
  const gradId = `sg${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <svg width={width} height={height} className="shrink-0 overflow-visible">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Y-axis labels — left column, clear of chart area */}
      <text x={yAxisW - 3} y={padT + 6}           fontSize="7" fill={color} fillOpacity="0.65" textAnchor="end">{fmt(max)}</text>
      <text x={yAxisW - 3} y={padT + chartH}       fontSize="7" fill={color} fillOpacity="0.65" textAnchor="end">{fmt(min)}</text>

      {/* Subtle dashed mid-gridline */}
      <line x1={chartX} y1={padT + chartH / 2} x2={chartX + chartW} y2={padT + chartH / 2}
        stroke={color} strokeOpacity="0.15" strokeWidth="0.5" strokeDasharray="2,2" />
      {/* Baseline — separator between chart and x labels */}
      <line x1={chartX} y1={padT + chartH} x2={chartX + chartW} y2={padT + chartH}
        stroke={color} strokeOpacity="0.25" strokeWidth="0.7" />

      {/* Fill area */}
      <polygon points={fillPts1} fill={`url(#${gradId})`} />

      {/* Series 1 line */}
      <polyline points={pts1.join(" ")} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* Series 2 line */}
      {pts2 && color2 && (
        <polyline points={pts2.join(" ")} fill="none" stroke={color2} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}

      {/* Endpoint dots */}
      <circle cx={toX(values.length - 1, values.length)} cy={toY(values[values.length - 1])} r="2.5" fill={color} />
      {pts2 && color2 && values2 && (
        <circle cx={toX(values2.length - 1, values2.length)} cy={toY(values2[values2.length - 1])} r="2.5" fill={color2} />
      )}

      {/* X-axis date labels — clearly BELOW the baseline */}
      {labelFirst && (
        <text x={chartX} y={height - 2} fontSize="7.5" fill={color} fillOpacity="0.6" textAnchor="start">{labelFirst}</text>
      )}
      {labelLast && (
        <text x={chartX + chartW} y={height - 2} fontSize="7.5" fill={color} fillOpacity="0.6" textAnchor="end">{labelLast}</text>
      )}
    </svg>
  );
}

type CoreTab = "overview" | "metrics" | "meds" | "substances" | "ai" | "documents";

export default function Health() {
  const { scopeUserId, pageTitle, isOwnScope } = useSharedScope("health");
  const { entries, heightEntries, bpEntries, measurements } = useWeightTracker(scopeUserId ?? undefined);
  const { medications } = useMeds(scopeUserId ?? undefined);
  const { tabs, addTab, deleteTab } = useHealthTabs();
  const { profile, saveProfile } = useHealthProfile(scopeUserId ?? undefined);

  // Documents aren't part of the "health" share grain (the same collection is
  // also used for non-health quick links), so this always stays scoped to self.
  const { documents, deleteDocument } = useDocuments();
  const healthDocs = documents.filter((d) => d.destination === "health");

  const [activeTab, setActiveTab] = useState<CoreTab | string>("overview");
  const [newTabOpen, setNewTabOpen] = useState(false);
  const [docUploadOpen, setDocUploadOpen] = useState(false);

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
    { id: "documents",   label: "Documents",       icon: <FolderOpen className="w-4 h-4" /> },
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
      title={pageTitle}
      subtitle={isOwnScope ? "Your personal health dashboard" : "Shared with you"}
      icon={<HeartPulse className="w-5 h-5" />}
      action={
        <div className="flex items-center gap-1.5">
          <SharedScopeSwitcher page="health" />
          <ShareAccessButton page="health" />
        </div>
      }
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
                          dates={entries.slice(-12).map((e) => e.date)}
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
                          <MiniSparkline
                            values={bpEntries.slice(-12).map((e) => e.systolic)}
                            values2={bpEntries.slice(-12).map((e) => e.diastolic)}
                            dates={bpEntries.slice(-12).map((e) => e.date)}
                            color="#ef4444"
                            color2="#3b82f6"
                          />
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
                          dates={measurements.filter((m) => m.waistCm != null).slice(-12).map((m) => m.date)}
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

          {activeTab === "metrics" && <HealthMetrics scopeUserId={scopeUserId ?? undefined} />}
          {activeTab === "meds"    && <HealthMeds scopeUserId={scopeUserId ?? undefined} />}
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

          {activeTab === "documents" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  {healthDocs.length === 0 ? "No health documents yet" : `${healthDocs.length} document${healthDocs.length !== 1 ? "s" : ""}`}
                </p>
                <Button size="sm" onClick={() => setDocUploadOpen(true)} className="gap-1.5 h-8 rounded-xl bg-gradient-primary">
                  <Upload className="w-3.5 h-3.5" /> Upload
                </Button>
              </div>

              {healthDocs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <FolderOpen className="w-8 h-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">No health documents yet</p>
                  <p className="text-xs text-muted-foreground/70">Upload medical records, test results, or any health-related files</p>
                  <Button variant="outline" size="sm" onClick={() => setDocUploadOpen(true)} className="mt-1 gap-1.5 rounded-xl">
                    <Upload className="w-3.5 h-3.5" /> Upload a document
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {healthDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-3 p-3 rounded-2xl border border-border/50 bg-card hover:bg-muted/30 transition-colors">
                      <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-950/40 flex items-center justify-center flex-shrink-0">
                        {doc.mimeType.startsWith("image/") ? (
                          <img src={doc.url} alt={doc.name} className="w-10 h-10 rounded-xl object-cover" />
                        ) : (
                          <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{doc.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.size ? `${(doc.size / 1024).toFixed(0)} KB` : ""}{doc.createdAt?.toDate ? ` · ${doc.createdAt.toDate().toLocaleDateString("en-GB")}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                          <Download className="w-4 h-4" />
                        </a>
                        <button onClick={() => deleteDocument(doc.id!)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <UploadDocumentDialog open={docUploadOpen} onOpenChange={setDocUploadOpen} />
            </div>
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

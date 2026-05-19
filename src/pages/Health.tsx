import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeartPulse, Plus, Pill, Activity, Sparkles, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import HealthMetrics from "@/components/health/HealthMetrics";
import HealthMeds from "@/components/health/HealthMeds";
import HealthCustomTab from "@/components/health/HealthCustomTab";
import AiHealthAssessment from "@/components/health/AiHealthAssessment";
import { useWeightTracker } from "@/hooks/useWeightTracker";
import { useMeds } from "@/hooks/useMeds";
import { useHealthTabs, type HealthTab, type FieldType } from "@/hooks/useHealthTabs";

const EMOJIS = ["🧘", "🍷", "💊", "🚭", "🍕", "😴", "🏃", "❤️", "🧠", "⚡", "🌿", "🌊", "🎯", "💪", "✨"];
const COLORS  = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

type CoreTab = "overview" | "metrics" | "meds";

export default function Health() {
  const { entries, heightEntries, bpEntries, measurements } = useWeightTracker();
  const { medications } = useMeds();
  const { tabs, addTab, deleteTab } = useHealthTabs();

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
    { id: "overview", label: "Overview",      icon: <HeartPulse className="w-3.5 h-3.5" /> },
    { id: "metrics",  label: "Weight & Stats", icon: <Activity className="w-3.5 h-3.5" /> },
    { id: "meds",     label: "Medications",    icon: <Pill className="w-3.5 h-3.5" /> },
  ];

  const activeCustomTab = tabs.find((t) => t.id === activeTab);

  return (
    <FeaturePageShell
      title="Health"
      subtitle="Your personal health dashboard"
      icon={<HeartPulse className="w-5 h-5" />}
    >
      {/* ── Tab bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-5 scrollbar-none -mx-1 px-1">
        {CORE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as CoreTab)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all border ${
              activeTab === t.id
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : "bg-card text-muted-foreground border-border/50 hover:border-border hover:text-foreground"
            }`}
          >
            {t.icon}{t.label}
          </button>
        ))}

        {/* Custom tabs */}
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-all border ${
              activeTab === tab.id
                ? "text-white border-transparent shadow-sm"
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
          className="flex items-center gap-1 px-3 py-2 rounded-full text-xs font-semibold whitespace-nowrap flex-shrink-0 text-muted-foreground border border-dashed border-border/60 hover:border-border hover:text-foreground transition-all"
        >
          <Plus className="w-3 h-3" /> Add tab
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
              {/* Quick stats row */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="p-3.5 rounded-2xl bg-card border border-border/50 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Weight</p>
                  <p className="text-xl font-black font-display text-card-foreground">
                    {entries[entries.length - 1]?.weight ?? "—"}
                    {entries[entries.length - 1] && <span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span>}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-card border border-border/50 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">BMI</p>
                  <p className="text-xl font-black font-display text-card-foreground">
                    {(() => {
                      const w = entries[entries.length - 1];
                      const h = heightEntries[heightEntries.length - 1];
                      return w && h ? (w.weight / Math.pow(h.height / 100, 2)).toFixed(1) : "—";
                    })()}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-card border border-border/50 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">BP</p>
                  <p className="text-xl font-black font-display text-card-foreground">
                    {bpEntries[bpEntries.length - 1]
                      ? `${bpEntries[bpEntries.length - 1].systolic}/${bpEntries[bpEntries.length - 1].diastolic}`
                      : "—"}
                  </p>
                </div>
              </div>

              {/* AI Assessment */}
              <AiHealthAssessment
                entries={entries}
                heightEntries={heightEntries}
                bpEntries={bpEntries}
                measurements={measurements}
                medications={medications}
              />

              {/* Quick nav cards */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setActiveTab("metrics")}
                  className="p-4 rounded-2xl bg-card border border-border/50 text-left hover:border-border transition-colors group"
                >
                  <Activity className="w-5 h-5 text-green-500 mb-2" />
                  <p className="text-sm font-bold text-card-foreground">Weight &amp; Stats</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Charts, BP, measurements</p>
                </button>
                <button
                  onClick={() => setActiveTab("meds")}
                  className="p-4 rounded-2xl bg-card border border-border/50 text-left hover:border-border transition-colors group"
                >
                  <Pill className="w-5 h-5 text-blue-500 mb-2" />
                  <p className="text-sm font-bold text-card-foreground">Medications</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {medications.filter((m) => m.active).length} active med{medications.filter((m) => m.active).length !== 1 ? "s" : ""}
                  </p>
                </button>
                {tabs.slice(0, 2).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="p-4 rounded-2xl bg-card border border-border/50 text-left hover:border-border transition-colors"
                  >
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

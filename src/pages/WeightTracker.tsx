import { useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { HeartPulse, Plus, TrendingDown, TrendingUp, Ruler, Syringe } from "lucide-react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { useWeightTracker } from "@/hooks/useWeightTracker";
import DogLoader from "@/components/DogLoader";

const WeightTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg bg-card border border-border shadow-elevated p-2.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold font-display text-card-foreground">{payload[0].value} kg</p>
      </div>
    );
  }
  return null;
};

const HealthTracker = () => {
  const { entries, heightEntries, botoxRecords, loading, addEntry, addHeightEntry, addBotoxRecord } = useWeightTracker();

  // Weight state
  const [weightOpen, setWeightOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");

  // Height state
  const [heightOpen, setHeightOpen] = useState(false);
  const [newHeight, setNewHeight] = useState("");

  // Botox state
  const [botoxOpen, setBotoxOpen] = useState(false);
  const [botoxDate, setBotoxDate] = useState(new Date().toISOString().split("T")[0]);
  const [botoxRight, setBotoxRight] = useState("");
  const [botoxLeft, setBotoxLeft] = useState("");
  const [botoxNotes, setBotoxNotes] = useState("");
  const [botoxLoading, setBotoxLoading] = useState(false);
  const [botoxError, setBotoxError] = useState<string | null>(null);

  const latestWeight = entries[entries.length - 1];
  const previousWeight = entries[entries.length - 2];
  const weightDiff = latestWeight && previousWeight ? latestWeight.weight - previousWeight.weight : 0;
  const latestHeight = heightEntries[heightEntries.length - 1];

  const handleAddWeight = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w)) return;
    await addEntry(w);
    setNewWeight("");
    setWeightOpen(false);
  };

  const handleAddHeight = async () => {
    const h = parseFloat(newHeight);
    if (isNaN(h)) return;
    await addHeightEntry(h);
    setNewHeight("");
    setHeightOpen(false);
  };

  const handleAddBotox = async () => {
    const right = parseFloat(botoxRight);
    const left = parseFloat(botoxLeft);
    if (!botoxDate || isNaN(right) || isNaN(left)) {
      setBotoxError("Please fill in all required fields.");
      return;
    }
    setBotoxError(null);
    setBotoxLoading(true);
    try {
      await addBotoxRecord({ date: botoxDate, unitsRight: right, unitsLeft: left, notes: botoxNotes.trim() });
      setBotoxDate(new Date().toISOString().split("T")[0]);
      setBotoxRight("");
      setBotoxLeft("");
      setBotoxNotes("");
      setBotoxOpen(false);
    } catch (e: any) {
      setBotoxError(e?.message ?? "Failed to save.");
    } finally {
      setBotoxLoading(false);
    }
  };

  const weightChartData = entries.map((d) => ({
    date: format(new Date(d.date), "MMM yy"),
    weight: d.weight,
  }));

  if (loading) {
    return (
      <FeaturePageShell title="Health" subtitle="Weight, height & treatments" icon={<HeartPulse className="w-5 h-5" />}>
        <div className="flex items-center justify-center py-20">
          <DogLoader text="Loading…" />
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell title="Health" subtitle="Weight, height & treatments" icon={<HeartPulse className="w-5 h-5" />}>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {/* Weight */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-primary col-span-2 sm:col-span-1"
        >
          <p className="text-xs text-primary-foreground/70 uppercase tracking-wider font-medium">Current Weight</p>
          <p className="text-3xl font-bold font-display text-primary-foreground mt-1">
            {latestWeight ? `${latestWeight.weight} kg` : "—"}
          </p>
          {latestWeight && (
            <div className="flex items-center gap-1 mt-1.5">
              {weightDiff <= 0
                ? <TrendingDown className="w-3.5 h-3.5 text-primary-foreground/70" />
                : <TrendingUp className="w-3.5 h-3.5 text-primary-foreground/70" />}
              <span className="text-xs text-primary-foreground/70">
                {weightDiff > 0 ? "+" : ""}{weightDiff.toFixed(1)} kg from last
              </span>
            </div>
          )}
        </motion.div>

        {/* Height */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
          className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Height</p>
            </div>
            <button onClick={() => setHeightOpen(true)} className="text-[10px] text-primary font-medium flex items-center gap-0.5">
              <Plus className="w-3 h-3" /> Update
            </button>
          </div>
          <p className="text-3xl font-bold font-display text-card-foreground mt-1">
            {latestHeight ? `${latestHeight.height} cm` : "—"}
          </p>
          {latestHeight && (
            <p className="text-[10px] text-muted-foreground mt-1">
              Logged {new Date(latestHeight.date).toLocaleDateString("en-GB")}
            </p>
          )}
        </motion.div>
      </div>

      {/* ── Weight Chart ── */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weight Trend</h3>
          <button onClick={() => setWeightOpen(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Plus className="w-3.5 h-3.5" /> Log
          </button>
        </div>
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No entries yet — log your first weight above.</p>
        ) : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 88%)" />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={38} tickFormatter={(v) => `${v}kg`} />
                <Tooltip content={<WeightTooltip />} />
                <Line type="monotone" dataKey="weight" stroke="hsl(168, 55%, 38%)" strokeWidth={2.5} dot={{ fill: "hsl(168, 55%, 38%)", r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Weight History ── */}
      {entries.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">Weight History</h3>
          <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
            {[...entries].reverse().map((entry, i) => (
              <div key={entry.id ?? i} className="flex items-center justify-between px-3 py-2.5">
                <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString("en-GB")}</span>
                <span className="text-sm font-bold font-display text-card-foreground">{entry.weight} kg</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Neck Botox ── */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-3">
          <div className="flex items-center gap-2">
            <Syringe className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Neck Botox</h3>
          </div>
          <button onClick={() => { setBotoxError(null); setBotoxOpen(true); }} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>

        {botoxRecords.length === 0 ? (
          <div className="p-5 rounded-xl bg-card border border-border/50 shadow-soft text-center">
            <Syringe className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No records yet — tap Add to log your first treatment.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {botoxRecords.map((rec, i) => (
              <motion.div
                key={rec.id ?? i}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="p-4 rounded-xl bg-card border border-border/50 shadow-soft"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-card-foreground">
                    {new Date(rec.date).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </span>
                  <span className="text-[10px] bg-primary/10 text-primary rounded-full px-2 py-0.5 font-medium">
                    {rec.unitsRight + rec.unitsLeft}u total
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Right side</p>
                    <p className="text-sm font-bold font-display text-card-foreground">{rec.unitsRight}u</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/40 text-center">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-0.5">Left side</p>
                    <p className="text-sm font-bold font-display text-card-foreground">{rec.unitsLeft}u</p>
                  </div>
                </div>
                {rec.notes && (
                  <p className="text-xs text-muted-foreground italic">{rec.notes}</p>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Log Weight Dialog ── */}
      <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Log Weight</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" step="0.1" placeholder={latestWeight ? `e.g. ${latestWeight.weight}` : "e.g. 75.0"} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <Button onClick={handleAddWeight} disabled={!newWeight.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Log Height Dialog ── */}
      <Dialog open={heightOpen} onOpenChange={setHeightOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Update Height</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Height (cm)</Label>
              <Input type="number" step="0.5" placeholder={latestHeight ? `e.g. ${latestHeight.height}` : "e.g. 172.0"} value={newHeight} onChange={(e) => setNewHeight(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <Button onClick={handleAddHeight} disabled={!newHeight.trim()} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add Botox Dialog ── */}
      <Dialog open={botoxOpen} onOpenChange={(o) => { setBotoxOpen(o); if (!o) setBotoxError(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Syringe className="w-4 h-4" /> Neck Botox</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={botoxDate} onChange={(e) => setBotoxDate(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Units — Right side</Label>
                <Input type="number" step="1" min="0" placeholder="e.g. 25" value={botoxRight} onChange={(e) => setBotoxRight(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Units — Left side</Label>
                <Input type="number" step="1" min="0" placeholder="e.g. 25" value={botoxLeft} onChange={(e) => setBotoxLeft(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                placeholder="e.g. Treatment at Dr Smith. Some tenderness after."
                value={botoxNotes}
                onChange={(e) => setBotoxNotes(e.target.value)}
                className="rounded-xl text-xs min-h-[80px]"
              />
            </div>
            {botoxError && <p className="text-xs text-destructive">{botoxError}</p>}
            <Button onClick={handleAddBotox} disabled={botoxLoading || !botoxDate || !botoxRight || !botoxLeft} className="w-full h-11 rounded-xl bg-gradient-primary">
              {botoxLoading ? "Saving…" : "Save Record"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </FeaturePageShell>
  );
};

export default HealthTracker;

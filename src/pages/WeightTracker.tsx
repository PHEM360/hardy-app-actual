import { useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Activity, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface WeightEntry { date: string; weight: number }

const INITIAL_DATA: WeightEntry[] = [
  { date: "2024-09-01", weight: 82.5 }, { date: "2024-10-01", weight: 81.8 },
  { date: "2024-11-01", weight: 82.1 }, { date: "2024-12-01", weight: 83.4 },
  { date: "2025-01-01", weight: 82.0 }, { date: "2025-02-01", weight: 81.2 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
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

const WeightTracker = () => {
  const [data, setData] = useState(INITIAL_DATA);
  const [addOpen, setAddOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");

  const latest = data[data.length - 1];
  const previous = data[data.length - 2];
  const diff = latest && previous ? latest.weight - previous.weight : 0;
  const lowest = Math.min(...data.map((d) => d.weight));
  const highest = Math.max(...data.map((d) => d.weight));

  const handleAdd = () => {
    const w = parseFloat(newWeight);
    if (isNaN(w)) return;
    setData((prev) => [...prev, { date: new Date().toISOString().split("T")[0], weight: w }]);
    setNewWeight("");
    setAddOpen(false);
  };

  const chartData = data.map((d) => ({ date: format(new Date(d.date), "MMM yy"), weight: d.weight }));

  return (
    <FeaturePageShell title="Weight Tracker" subtitle="Personal weight logging & trends" icon={<Activity className="w-5 h-5" />}>
      {/* Current Stats */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-gradient-primary mb-5">
        <p className="text-xs text-primary-foreground/70 uppercase tracking-wider font-medium">Current Weight</p>
        <p className="text-3xl font-bold font-display text-primary-foreground mt-1">{latest.weight} kg</p>
        <div className="flex items-center gap-1 mt-2">
          {diff <= 0 ? <TrendingDown className="w-3.5 h-3.5 text-primary-foreground/80" /> : <TrendingUp className="w-3.5 h-3.5 text-primary-foreground/80" />}
          <span className="text-xs text-primary-foreground/80">{diff > 0 ? "+" : ""}{diff.toFixed(1)} kg from last entry</span>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { label: "Lowest", value: `${lowest}kg` },
          { label: "Highest", value: `${highest}kg` },
          { label: "Entries", value: String(data.length) },
        ].map((s) => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border/50 shadow-soft text-center">
            <p className="text-sm font-bold font-display text-card-foreground">{s.value}</p>
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Trend</h3>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Log</button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-4">
              <DialogHeader><DialogTitle className="font-display">Log Weight</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input type="number" step="0.1" placeholder={`e.g. ${latest.weight}`} value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <Button onClick={handleAdd} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 88%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={35} tickFormatter={(v) => `${v}kg`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="weight" stroke="hsl(168, 55%, 38%)" strokeWidth={2.5} dot={{ fill: "hsl(168, 55%, 38%)", r: 4 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* History */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-2">History</h3>
        <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
          {[...data].reverse().map((entry, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2.5">
              <span className="text-xs text-muted-foreground">{new Date(entry.date).toLocaleDateString("en-GB")}</span>
              <span className="text-sm font-bold font-display text-card-foreground">{entry.weight} kg</span>
            </div>
          ))}
        </div>
      </div>
    </FeaturePageShell>
  );
};

export default WeightTracker;

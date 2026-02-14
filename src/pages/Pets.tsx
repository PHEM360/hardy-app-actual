import { useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Heart, Plus, Bug, Syringe, Stethoscope, ChevronDown, ChevronUp, StickyNote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, differenceInYears, differenceInMonths } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TreatmentOption {
  id: string;
  product: string;
  frequencyDays: number;
}

interface TreatmentRecord {
  id: string;
  type: "flea" | "worming" | "vaccination";
  name: string;
  dateDue: string;
  dateGiven: string;
}

interface NotificationSetting {
  id: string;
  daysBeforeDue: number;
}

interface Pet {
  id: string; name: string; breed: string; birthday: string; avatar: string;
  fleaOptions: TreatmentOption[];
  wormOptions: TreatmentOption[];
  selectedFlea: string;
  selectedWorm: string;
  treatmentNotes: string;
  weightHistory: { date: string; weight: number }[];
  treatmentHistory: TreatmentRecord[];
  fleaNotifications: NotificationSetting[];
  wormNotifications: NotificationSetting[];
  insurance: { provider: string; policyNumber: string; renewalDate: string; monthlyPremium: number; coverLevel: string; excess: number };
}

const INITIAL_PETS: Pet[] = [
  {
    id: "1", name: "Billy", breed: "Labrador Retriever", birthday: "2021-06-15", avatar: "🐕",
    fleaOptions: [
      { id: "fo1", product: "Advocate", frequencyDays: 30 },
      { id: "fo2", product: "NexGard Spectra", frequencyDays: 30 },
    ],
    wormOptions: [
      { id: "wo1", product: "Droncit", frequencyDays: 90 },
      { id: "wo2", product: "Drontal Plus", frequencyDays: 90 },
    ],
    selectedFlea: "Advocate",
    selectedWorm: "Droncit",
    treatmentNotes: "Advocate + Droncit or NexGard Spectra (covers both)",
    weightHistory: [
      { date: "2024-09-01", weight: 26.2 }, { date: "2024-10-01", weight: 26.8 },
      { date: "2024-11-01", weight: 27.1 }, { date: "2024-12-01", weight: 27.9 },
      { date: "2025-01-01", weight: 28.2 }, { date: "2025-02-01", weight: 28.5 },
    ],
    treatmentHistory: [
      { id: "t1", type: "flea", name: "Advocate", dateDue: "2025-02-15", dateGiven: "2025-02-14" },
      { id: "t1b", type: "flea", name: "Advocate", dateDue: "2025-01-15", dateGiven: "2025-01-15" },
      { id: "t1c", type: "flea", name: "Advocate", dateDue: "2024-12-15", dateGiven: "2024-12-18" },
      { id: "t1d", type: "flea", name: "Advocate", dateDue: "2024-11-15", dateGiven: "2024-11-25" },
      { id: "t2", type: "worming", name: "Droncit", dateDue: "2025-04-01", dateGiven: "" },
      { id: "t2b", type: "worming", name: "Droncit", dateDue: "2025-01-01", dateGiven: "2025-01-02" },
      { id: "t2c", type: "worming", name: "Droncit", dateDue: "2024-10-01", dateGiven: "2024-10-01" },
    ],
    fleaNotifications: [{ id: "fn1", daysBeforeDue: 3 }],
    wormNotifications: [{ id: "wn1", daysBeforeDue: 7 }],
    insurance: { provider: "Petplan", policyNumber: "PP-2021-88431", renewalDate: "2025-06-15", monthlyPremium: 34.5, coverLevel: "Lifetime", excess: 110 },
  },
  {
    id: "2", name: "Milo", breed: "Cockapoo", birthday: "2023-03-22", avatar: "🐶",
    fleaOptions: [
      { id: "fo3", product: "Advocate", frequencyDays: 30 },
      { id: "fo4", product: "Anthelmin", frequencyDays: 30 },
    ],
    wormOptions: [
      { id: "wo3", product: "Milbemax", frequencyDays: 90 },
      { id: "wo4", product: "Drontal Plus", frequencyDays: 90 },
    ],
    selectedFlea: "Advocate",
    selectedWorm: "Milbemax",
    treatmentNotes: "Anthelmin + Advocate or Advocate alone (monthly)",
    weightHistory: [
      { date: "2024-09-01", weight: 8.1 }, { date: "2024-10-01", weight: 8.3 },
      { date: "2024-11-01", weight: 8.4 }, { date: "2024-12-01", weight: 8.6 },
      { date: "2025-01-01", weight: 8.7 }, { date: "2025-02-01", weight: 8.8 },
    ],
    treatmentHistory: [
      { id: "t4", type: "flea", name: "Advocate", dateDue: "2025-02-22", dateGiven: "2025-02-22" },
      { id: "t4b", type: "flea", name: "Advocate", dateDue: "2025-01-22", dateGiven: "2025-01-20" },
      { id: "t4c", type: "flea", name: "Advocate", dateDue: "2024-12-22", dateGiven: "2024-12-30" },
      { id: "t5", type: "worming", name: "Milbemax", dateDue: "2025-04-01", dateGiven: "" },
      { id: "t5b", type: "worming", name: "Milbemax", dateDue: "2025-01-01", dateGiven: "2025-01-03" },
    ],
    fleaNotifications: [{ id: "fn2", daysBeforeDue: 3 }],
    wormNotifications: [{ id: "wn2", daysBeforeDue: 7 }],
    insurance: { provider: "Bought By Many", policyNumber: "BBM-2023-44210", renewalDate: "2025-03-22", monthlyPremium: 22.0, coverLevel: "Lifetime", excess: 85 },
  },
];

function getAge(b: string) {
  const bd = new Date(b), now = new Date();
  const y = differenceInYears(now, bd), m = differenceInMonths(now, bd) % 12;
  return y === 0 ? `${m}mo` : `${y}y ${m}mo`;
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000);
}

function getBirthdayCountdown(b: string) {
  const now = new Date(), bd = new Date(b);
  let next = new Date(now.getFullYear(), bd.getMonth(), bd.getDate());
  if (next < now) next = new Date(now.getFullYear() + 1, bd.getMonth(), bd.getDate());
  const d = Math.ceil((next.getTime() - now.getTime()) / 86400000);
  if (d === 0) return "🎂 Today!";
  if (d <= 30) return `🎂 ${d}d away`;
  return format(next, "d MMM");
}

function formatDueText(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Due today";
  if (days >= 7) {
    const weeks = Math.floor(days / 7);
    const remaining = days % 7;
    return remaining > 0 ? `Due in ${weeks}w ${remaining}d` : `Due in ${weeks}w`;
  }
  return `Due in ${days}d`;
}

function getTreatmentStatus(pet: Pet, type: "flea" | "worming") {
  const productName = type === "flea" ? pet.selectedFlea : pet.selectedWorm;
  const history = pet.treatmentHistory.filter(t => t.type === type && t.name === productName);
  const latest = history.sort((a, b) => b.dateDue.localeCompare(a.dateDue))[0];
  if (!latest) return { text: "Not set", bg: "bg-muted", border: "border-muted", product: productName, nextDue: "" };
  
  const d = daysUntil(latest.dateDue);
  const text = formatDueText(d);
  if (d < 0) return { text, bg: "bg-destructive/15", border: "border-destructive/40", product: productName, nextDue: latest.dateDue };
  if (d <= 3) return { text, bg: "bg-warning/15", border: "border-warning/40", product: productName, nextDue: latest.dateDue };
  return { text, bg: "bg-success/20", border: "border-success/35", product: productName, nextDue: latest.dateDue };
}

const WEIGHT_COLORS = ["hsl(25, 62%, 67%)", "hsl(188, 33%, 38%)"];

const WeightTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg bg-card border border-border shadow-elevated p-2.5">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.dataKey} className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.stroke }} />
            <span className="text-xs text-muted-foreground">{p.name}</span>
            <span className="text-xs font-bold text-card-foreground ml-auto">{p.value}kg</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

// Dog entrance animation
const DogEntrance = () => {
  const [show, setShow] = useState(true);
  if (!show) return null;
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 1.8, duration: 0.5 }}
      onAnimationComplete={() => setShow(false)}
    >
      <div className="flex items-end gap-4">
        <motion.span className="text-6xl" initial={{ x: -100, opacity: 0 }} animate={{ x: 0, opacity: 1, rotate: [0, -10, 10, -5, 0] }} transition={{ duration: 0.8, ease: "backOut" }}>🐕</motion.span>
        <motion.span className="text-5xl" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1, rotate: [0, 10, -10, 5, 0] }} transition={{ duration: 0.8, delay: 0.3, ease: "backOut" }}>🐶</motion.span>
      </div>
      <motion.div className="absolute bottom-1/3" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <p className="text-sm font-display font-bold text-foreground">Billy & Milo</p>
        <motion.div className="flex justify-center gap-1 mt-2" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: 2 }}>
          {["🐾", "🐾", "🐾"].map((p, i) => (
            <motion.span key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 + i * 0.15 }}>{p}</motion.span>
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

const Pets = () => {
  const [pets, setPets] = useState(INITIAL_PETS);
  const [showBilly, setShowBilly] = useState(true);
  const [showMilo, setShowMilo] = useState(true);
  const [insuranceExpanded, setInsuranceExpanded] = useState<string | null>(null);
  const [addWeightOpen, setAddWeightOpen] = useState(false);
  const [addTreatmentOpen, setAddTreatmentOpen] = useState(false);
  const [weightPetId, setWeightPetId] = useState(pets[0].id);
  const [newWeight, setNewWeight] = useState("");
  const [treatmentPetId, setTreatmentPetId] = useState(pets[0].id);
  const [treatmentType, setTreatmentType] = useState<"flea" | "worming" | "vaccination">("flea");
  const [treatmentDate, setTreatmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsPetId, setSettingsPetId] = useState(pets[0].id);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPetId, setHistoryPetId] = useState("");
  const [historyType, setHistoryType] = useState<"flea" | "worming">("flea");

  const dates = [...new Set(pets.flatMap((p) => p.weightHistory.map((w) => w.date)))].sort();
  const weightChartData = dates.map((d) => {
    const row: any = { date: format(new Date(d), "MMM yy") };
    pets.forEach((p) => {
      const entry = p.weightHistory.find((w) => w.date === d);
      if (entry) row[p.id] = entry.weight;
    });
    return row;
  });

  const handleAddWeight = () => {
    const w = parseFloat(newWeight);
    if (isNaN(w)) return;
    setPets((prev) => prev.map((p) => p.id === weightPetId ? { ...p, weightHistory: [...p.weightHistory, { date: new Date().toISOString().split("T")[0], weight: w }] } : p));
    setNewWeight("");
    setAddWeightOpen(false);
  };

  const handleAddTreatment = () => {
    const pet = pets.find((p) => p.id === treatmentPetId)!;
    const productName = treatmentType === "flea" ? pet.selectedFlea : treatmentType === "worming" ? pet.selectedWorm : "";
    if (treatmentType === "vaccination" || !productName) return;
    const option = (treatmentType === "flea" ? pet.fleaOptions : pet.wormOptions).find(o => o.product === productName);
    const freq = option?.frequencyDays || 30;
    const givenDate = new Date(treatmentDate);
    const nextDue = new Date(givenDate.getTime() + freq * 86400000).toISOString().split("T")[0];
    setPets((prev) => prev.map((p) => p.id === treatmentPetId ? {
      ...p,
      treatmentHistory: [
        { id: `t${Date.now()}`, type: treatmentType, name: productName, dateDue: nextDue, dateGiven: treatmentDate },
        ...p.treatmentHistory,
      ],
    } : p));
    setAddTreatmentOpen(false);
    setTreatmentDate(new Date().toISOString().split("T")[0]);
  };

  const openHistory = (petId: string, type: "flea" | "worming") => {
    setHistoryPetId(petId);
    setHistoryType(type);
    setHistoryOpen(true);
  };

  const historyPet = pets.find(p => p.id === historyPetId);
  const historyProduct = historyPet ? (historyType === "flea" ? historyPet.selectedFlea : historyPet.selectedWorm) : "";
  const historyRecords = historyPet
    ? historyPet.treatmentHistory
        .filter(t => t.type === historyType && t.name === historyProduct)
        .sort((a, b) => b.dateDue.localeCompare(a.dateDue))
    : [];

  const settingsPet = pets.find(p => p.id === settingsPetId)!;

  const PET_BG_STYLES = [
    "linear-gradient(145deg, hsl(210, 12%, 78%) 0%, hsl(210, 8%, 86%) 50%, hsl(210, 10%, 82%) 100%)",
    "linear-gradient(145deg, hsl(196, 30%, 40%) 0%, hsl(196, 28%, 50%) 50%, hsl(196, 26%, 45%) 100%)",
  ];
  const PET_LEFT_BORDER_COLORS = ["hsl(210, 10%, 55%)", "hsl(25, 40%, 50%)"];

  return (
    <FeaturePageShell
      title="Billy & Milo"
      subtitle="Health, weight & care"
      icon={<Heart className="w-5 h-5" />}
    >
      <DogEntrance />

      {/* Dog Settings Button */}
      <div className="flex justify-end mb-3">
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-xs font-semibold shadow-card"
        >
          <span className="text-lg">🐾</span>
          Dog Settings
        </button>
      </div>

      {/* Pet Tiles */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {pets.map((pet, i) => {
          const latestW = pet.weightHistory[pet.weightHistory.length - 1];
          return (
            <motion.div
              key={pet.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.15, type: "spring", stiffness: 200 }}
              className="p-4 rounded-2xl border border-border/40 shadow-card relative overflow-hidden"
              style={{ background: PET_BG_STYLES[i], borderLeftWidth: 4, borderLeftColor: PET_LEFT_BORDER_COLORS[i] }}
            >
              <div className="absolute top-2 right-2 opacity-15 text-5xl pointer-events-none">🐾</div>
              <div className="text-3xl mb-2">{pet.avatar}</div>
              <p className="text-xl font-extrabold font-display text-card-foreground tracking-wide">{pet.name}</p>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-sm">{getAge(pet.birthday)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm">🎂 {getBirthdayCountdown(pet.birthday)}</span>
              </div>
              <p className="text-lg font-bold font-display text-card-foreground mt-2">{latestW.weight}kg</p>
            </motion.div>
          );
        })}
      </div>

      {/* Treatment Status */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Treatment Status</h3>
          <Dialog open={addTreatmentOpen} onOpenChange={setAddTreatmentOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Record</button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-4">
              <DialogHeader><DialogTitle className="font-display">Record Treatment</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Pet</Label>
                  <Select value={treatmentPetId} onValueChange={setTreatmentPetId}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={treatmentType} onValueChange={(v) => setTreatmentType(v as any)}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flea">Flea</SelectItem>
                      <SelectItem value="worming">Worming</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date Given</Label>
                  <Input type="date" value={treatmentDate} onChange={(e) => setTreatmentDate(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Will record <span className="font-semibold text-card-foreground">
                    {treatmentType === "flea" ? pets.find(p => p.id === treatmentPetId)?.selectedFlea : pets.find(p => p.id === treatmentPetId)?.selectedWorm}
                  </span> as given on {treatmentDate}.
                </p>
                <Button onClick={handleAddTreatment} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {pets.map((pet) => (
            <div key={pet.id} className="space-y-2">
              <p className="text-xs font-semibold text-card-foreground px-1">{pet.name}</p>
              {(["flea", "worming"] as const).map((type) => {
                const status = getTreatmentStatus(pet, type);
                return (
                  <button
                    key={type}
                    onClick={() => openHistory(pet.id, type)}
                    className={`w-full p-3 rounded-xl ${status.bg} border ${status.border} shadow-soft text-left transition-all hover:scale-[1.02] active:scale-[0.98]`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${type === "flea" ? "bg-card text-foreground" : "bg-info/20 text-info"}`}>
                        {type === "flea" ? <span className="text-base">🛡️</span> : <Syringe className="w-4 h-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-card-foreground">
                          {type === "flea" ? "Flea" : "Wormer"} ({status.product})
                        </p>
                        {status.nextDue && (
                          <p className="text-[10px] text-muted-foreground">
                            Next: {format(new Date(status.nextDue), "d MMM yyyy")}
                          </p>
                        )}
                      </div>
                      <span className={`text-[9px] font-bold px-2 py-1 rounded-full ${
                        status.bg.includes("destructive") ? "bg-destructive/20 text-destructive" :
                        status.bg.includes("warning") ? "bg-warning/20 text-warning" :
                        status.bg.includes("success") ? "bg-success/25 text-success" :
                        "bg-muted text-muted-foreground"
                      }`}>{status.text}</span>
                    </div>
                  </button>
                );
              })}
              {/* Treatment notes */}
              <div className="p-2.5 rounded-xl bg-accent/8 border border-accent/15">
                <div className="flex items-start gap-2">
                  <StickyNote className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">{pet.treatmentNotes || "No notes — edit in Dog Settings"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Weight Graph */}
      <div className="p-4 rounded-2xl bg-card border border-border/40 shadow-soft mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weight History</h3>
          <Dialog open={addWeightOpen} onOpenChange={setAddWeightOpen}>
            <DialogTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Log</button>
            </DialogTrigger>
            <DialogContent className="max-w-sm mx-4">
              <DialogHeader><DialogTitle className="font-display">Log Weight</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Pet</Label>
                  <Select value={weightPetId} onValueChange={setWeightPetId}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>{pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Weight (kg)</Label>
                  <Input type="number" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <Button onClick={handleAddWeight} className="w-full h-11 rounded-xl bg-gradient-primary">Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flex gap-3 mb-3">
          {pets.map((p, i) => (
            <button
              key={p.id}
              onClick={() => p.id === "1" ? setShowBilly(!showBilly) : setShowMilo(!showMilo)}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                (p.id === "1" ? showBilly : showMilo) ? "border-primary/30 bg-card shadow-soft" : "border-border/30 opacity-50"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: WEIGHT_COLORS[i] }} />
              {p.name}
            </button>
          ))}
        </div>
        <div className="h-52 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={weightChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 18%, 86%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(220, 10%, 44%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 44%)" }} axisLine={false} tickLine={false} domain={["auto", "auto"]} width={35} tickFormatter={(v) => `${v}kg`} />
              <Tooltip content={<WeightTooltip />} />
              {showBilly && <Line type="monotone" dataKey="1" name="Billy" stroke={WEIGHT_COLORS[0]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />}
              {showMilo && <Line type="monotone" dataKey="2" name="Milo" stroke={WEIGHT_COLORS[1]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insurance */}
      <div className="space-y-3 mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">Insurance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pets.map((pet, i) => {
            const expanded = insuranceExpanded === pet.id;
            const ins = pet.insurance;
            const renewal = daysUntil(ins.renewalDate);
            return (
              <div
                key={pet.id}
                className="rounded-xl border border-border/40 shadow-soft overflow-hidden"
                style={{ background: PET_BG_STYLES[i], borderLeftWidth: 3, borderLeftColor: PET_LEFT_BORDER_COLORS[i] }}
              >
                <button onClick={() => setInsuranceExpanded(expanded ? null : pet.id)} className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="text-xl">{pet.avatar}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-card-foreground">{pet.name} — {ins.provider}</p>
                    <p className="text-[10px] text-muted-foreground">£{ins.monthlyPremium}/mo · Renews {renewal > 0 ? `in ${renewal}d` : "overdue"}</p>
                  </div>
                  {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                <AnimatePresence>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                      <div className="px-4 pb-4 space-y-2 border-t border-border/30 pt-3">
                        {([["Policy", ins.policyNumber], ["Cover", ins.coverLevel], ["Excess", `£${ins.excess}`], ["Monthly", `£${ins.monthlyPremium.toFixed(2)}`], ["Annual", `£${(ins.monthlyPremium * 12).toFixed(2)}`], ["Renewal", format(new Date(ins.renewalDate), "d MMM yyyy")]] as const).map(([label, value]) => (
                          <div key={label} className="flex justify-between">
                            <span className="text-xs text-muted-foreground">{label}</span>
                            <span className="text-xs font-medium text-card-foreground">{value}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>

      {/* Treatment History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-md mx-4 max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {historyPet?.name} — {historyType === "flea" ? "Flea" : "Wormer"} ({historyProduct})
            </DialogTitle>
          </DialogHeader>
          {historyRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No history recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Due Date</TableHead>
                  <TableHead className="text-xs">Given Date</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRecords.map((rec) => {
                  const givenDate = rec.dateGiven ? new Date(rec.dateGiven) : null;
                  const dueDate = new Date(rec.dateDue);
                  const notGiven = !rec.dateGiven;
                  const lateByDays = givenDate ? Math.ceil((givenDate.getTime() - dueDate.getTime()) / 86400000) : 0;
                  const isLate = notGiven || lateByDays > 7;
                  return (
                    <TableRow key={rec.id}>
                      <TableCell className="text-xs">{format(dueDate, "d MMM yyyy")}</TableCell>
                      <TableCell className="text-xs">{givenDate ? format(givenDate, "d MMM yyyy") : "—"}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isLate ? "bg-destructive/15 text-destructive" : "bg-success/15 text-success"
                        }`}>
                          {notGiven ? "Not given" : isLate ? `Late (${lateByDays}d)` : "On time"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Dog Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <span className="text-xl">🐾</span> Dog Settings
            </DialogTitle>
          </DialogHeader>

          <Tabs value={settingsPetId} onValueChange={setSettingsPetId} className="mt-2">
            <TabsList className="w-full">
              {pets.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="flex-1 gap-1.5">
                  <span>{p.avatar}</span> {p.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {pets.map((pet) => (
              <TabsContent key={pet.id} value={pet.id} className="space-y-5 mt-4">
                {/* Basic Info */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Date of Birth</Label>
                      <Input type="date" defaultValue={pet.birthday} onChange={(e) => setPets((prev) => prev.map((p) => p.id === pet.id ? { ...p, birthday: e.target.value } : p))} className="h-10 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Breed</Label>
                      <Input defaultValue={pet.breed} onChange={(e) => setPets((prev) => prev.map((p) => p.id === pet.id ? { ...p, breed: e.target.value } : p))} className="h-10 rounded-xl" />
                    </div>
                  </div>
                </div>

                {/* Flea Products */}
                <div>
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider mb-2">Flea Treatment</p>
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Active Product</Label>
                      <Select value={pet.selectedFlea} onValueChange={(v) => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, selectedFlea: v } : p))}>
                        <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select flea product" /></SelectTrigger>
                        <SelectContent>
                          {pet.fleaOptions.map(o => (
                            <SelectItem key={o.id} value={o.product}>{o.product} (every {o.frequencyDays}d)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Available products:</p>
                    {pet.fleaOptions.map((opt, i) => (
                      <div key={opt.id} className="flex gap-2">
                        <Input defaultValue={opt.product} placeholder="Product" onChange={(e) => {
                          const val = e.target.value;
                          setPets(prev => prev.map(p => p.id === pet.id ? { ...p, fleaOptions: p.fleaOptions.map((o, j) => j === i ? { ...o, product: val } : o) } : p));
                        }} className="h-9 rounded-lg flex-1 text-xs" />
                        <Input type="number" defaultValue={opt.frequencyDays} onChange={(e) => {
                          const val = Number(e.target.value);
                          setPets(prev => prev.map(p => p.id === pet.id ? { ...p, fleaOptions: p.fleaOptions.map((o, j) => j === i ? { ...o, frequencyDays: val } : o) } : p));
                        }} className="h-9 rounded-lg w-20 text-xs" />
                        <span className="text-[10px] text-muted-foreground self-center">days</span>
                      </div>
                    ))}
                    <button onClick={() => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, fleaOptions: [...p.fleaOptions, { id: `fo${Date.now()}`, product: "", frequencyDays: 30 }] } : p))} className="text-[10px] text-warning font-medium flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add product
                    </button>
                  </div>
                </div>

                {/* Worm Products */}
                <div>
                  <p className="text-xs font-semibold text-info uppercase tracking-wider mb-2">Wormer Treatment</p>
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Active Product</Label>
                      <Select value={pet.selectedWorm} onValueChange={(v) => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, selectedWorm: v } : p))}>
                        <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select worm product" /></SelectTrigger>
                        <SelectContent>
                          {pet.wormOptions.map(o => (
                            <SelectItem key={o.id} value={o.product}>{o.product} (every {o.frequencyDays}d)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Available products:</p>
                    {pet.wormOptions.map((opt, i) => (
                      <div key={opt.id} className="flex gap-2">
                        <Input defaultValue={opt.product} placeholder="Product" onChange={(e) => {
                          const val = e.target.value;
                          setPets(prev => prev.map(p => p.id === pet.id ? { ...p, wormOptions: p.wormOptions.map((o, j) => j === i ? { ...o, product: val } : o) } : p));
                        }} className="h-9 rounded-lg flex-1 text-xs" />
                        <Input type="number" defaultValue={opt.frequencyDays} onChange={(e) => {
                          const val = Number(e.target.value);
                          setPets(prev => prev.map(p => p.id === pet.id ? { ...p, wormOptions: p.wormOptions.map((o, j) => j === i ? { ...o, frequencyDays: val } : o) } : p));
                        }} className="h-9 rounded-lg w-20 text-xs" />
                        <span className="text-[10px] text-muted-foreground self-center">days</span>
                      </div>
                    ))}
                    <button onClick={() => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, wormOptions: [...p.wormOptions, { id: `wo${Date.now()}`, product: "", frequencyDays: 90 }] } : p))} className="text-[10px] text-info font-medium flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add product
                    </button>
                  </div>
                </div>

                {/* Notification Settings */}
                <div>
                  <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Notifications</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-medium text-card-foreground mb-1">Flea reminders</p>
                      {pet.fleaNotifications.map((n, i) => (
                        <div key={n.id} className="flex items-center gap-2 mb-1">
                          <Input type="number" defaultValue={n.daysBeforeDue} onChange={(e) => {
                            const val = Number(e.target.value);
                            setPets(prev => prev.map(p => p.id === pet.id ? { ...p, fleaNotifications: p.fleaNotifications.map((nn, j) => j === i ? { ...nn, daysBeforeDue: val } : nn) } : p));
                          }} className="h-8 rounded-lg w-16 text-xs" />
                          <span className="text-[10px] text-muted-foreground">days before due</span>
                        </div>
                      ))}
                      {pet.fleaNotifications.length < 3 && (
                        <button onClick={() => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, fleaNotifications: [...p.fleaNotifications, { id: `fn${Date.now()}`, daysBeforeDue: 1 }] } : p))} className="text-[10px] text-warning font-medium flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add another reminder
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-card-foreground mb-1">Wormer reminders</p>
                      {pet.wormNotifications.map((n, i) => (
                        <div key={n.id} className="flex items-center gap-2 mb-1">
                          <Input type="number" defaultValue={n.daysBeforeDue} onChange={(e) => {
                            const val = Number(e.target.value);
                            setPets(prev => prev.map(p => p.id === pet.id ? { ...p, wormNotifications: p.wormNotifications.map((nn, j) => j === i ? { ...nn, daysBeforeDue: val } : nn) } : p));
                          }} className="h-8 rounded-lg w-16 text-xs" />
                          <span className="text-[10px] text-muted-foreground">days before due</span>
                        </div>
                      ))}
                      {pet.wormNotifications.length < 3 && (
                        <button onClick={() => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, wormNotifications: [...p.wormNotifications, { id: `wn${Date.now()}`, daysBeforeDue: 1 }] } : p))} className="text-[10px] text-info font-medium flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add another reminder
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Treatment Notes */}
                <div>
                  <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Treatment Notes</p>
                  <Textarea
                    value={pet.treatmentNotes}
                    onChange={(e) => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, treatmentNotes: e.target.value } : p))}
                    placeholder="e.g. Advocate + Droncit or Anthelmin + Advocate"
                    className="rounded-xl min-h-[60px] text-xs"
                  />
                </div>

                {/* Insurance */}
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Insurance</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Provider</Label>
                      <Input defaultValue={pet.insurance.provider} onChange={(e) => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, insurance: { ...p.insurance, provider: e.target.value } } : p))} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Policy No.</Label>
                      <Input defaultValue={pet.insurance.policyNumber} onChange={(e) => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, insurance: { ...p.insurance, policyNumber: e.target.value } } : p))} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cover Level</Label>
                      <Input defaultValue={pet.insurance.coverLevel} onChange={(e) => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, insurance: { ...p.insurance, coverLevel: e.target.value } } : p))} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Monthly (£)</Label>
                      <Input type="number" step="0.01" defaultValue={pet.insurance.monthlyPremium} onChange={(e) => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, insurance: { ...p.insurance, monthlyPremium: Number(e.target.value) } } : p))} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Excess (£)</Label>
                      <Input type="number" defaultValue={pet.insurance.excess} onChange={(e) => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, insurance: { ...p.insurance, excess: Number(e.target.value) } } : p))} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Renewal Date</Label>
                      <Input type="date" defaultValue={pet.insurance.renewalDate} onChange={(e) => setPets(prev => prev.map(p => p.id === pet.id ? { ...p, insurance: { ...p.insurance, renewalDate: e.target.value } } : p))} className="h-9 rounded-lg text-xs" />
                    </div>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>

          <Button onClick={() => setSettingsOpen(false)} className="w-full h-11 rounded-xl bg-gradient-primary mt-2">Done</Button>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Pets;

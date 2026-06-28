import { useState, useEffect, useRef } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Heart, Plus, Syringe, ChevronDown, ChevronUp, StickyNote, Share2, UserPlus, FolderOpen, Upload, Camera, Trash2, FileText, ImageIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, differenceInYears, differenceInMonths } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePets } from "@/hooks/usePets";
import type { Pet, TreatmentOption, TreatmentRecord, NotificationSetting, VaccinationOption } from "@/hooks/usePets";
import { usePetDocuments } from "@/hooks/usePetDocuments";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import DogLoader from "@/components/DogLoader";
import { useAuth } from "@/auth/AuthContext";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

function getVaccinationStatus(pet: Pet, option: VaccinationOption) {
  const history = pet.treatmentHistory.filter(t => t.type === "vaccination" && t.name === option.name);
  const latest = history.sort((a, b) => b.dateDue.localeCompare(a.dateDue))[0];
  if (!latest) return { text: "Never recorded", bg: "bg-muted", border: "border-muted/50", nextDue: "" };
  const d = daysUntil(latest.dateDue);
  const text = formatDueText(d);
  if (d < 0) return { text, bg: "bg-destructive/15", border: "border-destructive/40", nextDue: latest.dateDue };
  if (d <= 30) return { text, bg: "bg-warning/15", border: "border-warning/40", nextDue: latest.dateDue };
  return { text, bg: "bg-success/20", border: "border-success/35", nextDue: latest.dateDue };
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
  const { pets, loading, addPet, updatePet, addWeightEntry, addTreatmentRecord, sharePet } = usePets();
  const { documents, uploadDocument, deleteDocument } = usePetDocuments();
  const { schedulePetReminders } = usePushNotifications();
  const { user } = useAuth();
  const docFileRef = useRef<HTMLInputElement>(null);
  const [visiblePets, setVisiblePets] = useState<Set<string>>(new Set());
  const [insuranceExpanded, setInsuranceExpanded] = useState<string | null>(null);
  const [addWeightOpen, setAddWeightOpen] = useState(false);
  const [addTreatmentOpen, setAddTreatmentOpen] = useState(false);
  const [weightPetId, setWeightPetId] = useState("");
  const [newWeight, setNewWeight] = useState("");
  const [treatmentPetId, setTreatmentPetId] = useState("");
  const [treatmentType, setTreatmentType] = useState<"flea" | "worming" | "vaccination">("flea");
  const [treatmentDate, setTreatmentDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedVaccineId, setSelectedVaccineId] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [coverageOpen, setCoverageOpen] = useState(false);
  const [settingsPetId, setSettingsPetId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyPetId, setHistoryPetId] = useState("");
  const [historyType, setHistoryType] = useState<"flea" | "worming">("flea");
  const [addPetOpen, setAddPetOpen] = useState(false);
  const [newPetName, setNewPetName] = useState("");
  const [newPetBreed, setNewPetBreed] = useState("");
  const [newPetBirthday, setNewPetBirthday] = useState("");
  const [newPetAvatar, setNewPetAvatar] = useState("🐶");
  const [addPetLoading, setAddPetLoading] = useState(false);
  const [addPetError, setAddPetError] = useState<string | null>(null);
  const [treatmentLoading, setTreatmentLoading] = useState(false);
  const [treatmentError, setTreatmentError] = useState<string | null>(null);
  const [weightLoading, setWeightLoading] = useState(false);
  const [weightError, setWeightError] = useState<string | null>(null);
  const [saveSettingsLoading, setSaveSettingsLoading] = useState<string | null>(null); // holds petId while saving
  const [saveSettingsError, setSaveSettingsError] = useState<string | null>(null);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<Pet>>>({});
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePetId, setSharePetId] = useState("");
  const [shareEmail, setShareEmail] = useState("");
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareSuccess, setShareSuccess] = useState(false);

  // Document upload state
  const [docUploadOpen, setDocUploadOpen] = useState(false);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docPetIds, setDocPetIds] = useState<string[]>([]);
  const [docUploading, setDocUploading] = useState(false);

  // Merge Firestore data with any unsaved local edits for the settings dialog
  const mergedPets = pets.map((p) => ({ ...p, ...(localEdits[p.id] ?? {}) }));

  // Default selector IDs once pets load
  const firstPetId = pets[0]?.id ?? "";

  // Initialise all pets as visible in the weight chart once loaded
  useEffect(() => {
    if (pets.length > 0 && visiblePets.size === 0) {
      setVisiblePets(new Set(pets.map((p) => p.id)));
    }
  }, [pets]);

  // Schedule in-session push reminders for pet treatments
  useEffect(() => {
    if (pets.length > 0) schedulePetReminders(pets);
  }, [pets]);

  const dates = [...new Set(pets.flatMap((p) => p.weightHistory.map((w) => w.date)))].sort();
  const weightChartData = dates.map((d) => {
    const row: any = { date: format(new Date(d as string), "MMM yy") };
    pets.forEach((p) => {
      const entry = p.weightHistory.find((w) => w.date === d);
      if (entry) row[p.id] = entry.weight;
    });
    return row;
  });

  const handleAddWeight = async () => {
    const w = parseFloat(newWeight);
    if (isNaN(w)) return;
    setWeightError(null);
    setWeightLoading(true);
    try {
      await addWeightEntry(weightPetId || firstPetId, {
        date: new Date().toISOString().split("T")[0],
        weight: w,
      });
      setNewWeight("");
      setAddWeightOpen(false);
    } catch (err: any) {
      setWeightError(err?.message ?? "Failed to save. Try again.");
    } finally {
      setWeightLoading(false);
    }
  };

  const handleAddTreatment = async () => {
    const pid = treatmentPetId || firstPetId;
    const pet = pets.find((p) => p.id === pid);
    if (!pet) return;

    let productName = "";
    let nextDue = "";

    if (treatmentType === "vaccination") {
      const vacOpt = pet.vaccinationOptions.find((v) => v.id === selectedVaccineId);
      if (!vacOpt) {
        setTreatmentError("Please select a vaccination. Add vaccination types in Pet Settings first.");
        return;
      }
      productName = vacOpt.name;
      const givenDate = new Date(treatmentDate);
      givenDate.setMonth(givenDate.getMonth() + vacOpt.frequencyMonths);
      nextDue = givenDate.toISOString().split("T")[0];
    } else {
      productName = treatmentType === "flea" ? pet.selectedFlea : pet.selectedWorm;
      if (!productName) {
        setTreatmentError(
          `No active ${treatmentType === "flea" ? "flea" : "wormer"} product set for ${pet.name}. Open Pet Settings and add a product first.`
        );
        return;
      }
      const option = (treatmentType === "flea" ? pet.fleaOptions : pet.wormOptions).find(
        (o) => o.product === productName
      );
      const freq = option?.frequencyDays || 30;
      const givenDate = new Date(treatmentDate);
      nextDue = new Date(givenDate.getTime() + freq * 86400000).toISOString().split("T")[0];
    }

    setTreatmentError(null);
    setTreatmentLoading(true);
    try {
      await addTreatmentRecord(pid, {
        id: `t${Date.now()}`,
        type: treatmentType,
        name: productName,
        dateDue: nextDue,
        dateGiven: treatmentDate,
      });
      setAddTreatmentOpen(false);
      setTreatmentDate(new Date().toISOString().split("T")[0]);
      setSelectedVaccineId("");
    } catch (err: any) {
      setTreatmentError(err?.message ?? "Failed to save. Try again.");
    } finally {
      setTreatmentLoading(false);
    }
  };

  const handleAddPet = async () => {
    if (!newPetName.trim() || !newPetBirthday) return;
    setAddPetError(null);
    setAddPetLoading(true);
    try {
      await addPet({
        name: newPetName.trim(),
        breed: newPetBreed.trim(),
        birthday: newPetBirthday,
        avatar: newPetAvatar,
        fleaOptions: [],
        wormOptions: [],
        vaccinationOptions: [],
        selectedFlea: "",
        selectedWorm: "",
        treatmentNotes: "",
        weightHistory: [],
        treatmentHistory: [],
        fleaNotifications: [],
        wormNotifications: [],
        insurance: {
          provider: "",
          policyNumber: "",
          renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
            .toISOString()
            .split("T")[0],
          monthlyPremium: 0,
          coverLevel: "",
          excess: 0,
        },
      });
      setNewPetName("");
      setNewPetBreed("");
      setNewPetBirthday("");
      setNewPetAvatar("🐶");
      setAddPetOpen(false);
    } catch (err: any) {
      setAddPetError(err?.message ?? "Failed to add pet. Check your connection and try again.");
    } finally {
      setAddPetLoading(false);
    }
  };

  const handleShare = async () => {
    if (!shareEmail.trim() || !sharePetId) return;
    setShareError(null);
    setShareLoading(true);
    setShareSuccess(false);
    try {
      const usersQ = query(collection(db, "users"), where("email", "==", shareEmail.trim().toLowerCase()));
      const snap = await getDocs(usersQ);
      if (snap.empty) {
        setShareError("No user found with that email address.");
        return;
      }
      const targetUid = snap.docs[0].id;
      if (targetUid === user?.uid) {
        setShareError("That's your own account!");
        return;
      }
      const pet = pets.find(p => p.id === sharePetId);
      if (pet?.sharedWith?.includes(targetUid)) {
        setShareError("Already shared with this user.");
        return;
      }
      await sharePet(sharePetId, targetUid);
      setShareSuccess(true);
      setShareEmail("");
    } catch (err: any) {
      setShareError(err?.message ?? "Failed to share. Try again.");
    } finally {
      setShareLoading(false);
    }
  };

  const saveSettings = async (petId: string) => {    const edits = localEdits[petId];
    if (!edits) return;
    setSaveSettingsError(null);
    setSaveSettingsLoading(petId);
    try {
      await updatePet(petId, edits);
      setLocalEdits((prev) => {
        const next = { ...prev };
        delete next[petId];
        return next;
      });
    } catch (err: any) {
      setSaveSettingsError(err?.message ?? "Failed to save. Check your connection and try again.");
    } finally {
      setSaveSettingsLoading(null);
    }
  };

  const patchLocal = (petId: string, patch: Partial<Pet>) => {
    setLocalEdits((prev) => ({
      ...prev,
      [petId]: { ...(prev[petId] ?? {}), ...patch },
    }));
  };

  const openHistory = (petId: string, type: "flea" | "worming") => {
    setHistoryPetId(petId);
    setHistoryType(type);
    setHistoryOpen(true);
  };

  const historyPet = pets.find((p) => p.id === historyPetId);
  const historyProduct = historyPet
    ? historyType === "flea"
      ? historyPet.selectedFlea
      : historyPet.selectedWorm
    : "";
  const historyRecords = historyPet
    ? historyPet.treatmentHistory
        .filter(t => t.type === historyType && t.name === historyProduct)
        .sort((a, b) => b.dateDue.localeCompare(a.dateDue))
    : [];

  const settingsPet = mergedPets.find(p => p.id === (settingsPetId || firstPetId));

  const PET_BG_STYLES = [
    "linear-gradient(145deg, hsl(210, 12%, 78%) 0%, hsl(210, 8%, 86%) 50%, hsl(210, 10%, 82%) 100%)",
    "linear-gradient(145deg, hsl(196, 30%, 40%) 0%, hsl(196, 28%, 50%) 50%, hsl(196, 26%, 45%) 100%)",
    "linear-gradient(145deg, hsl(25, 62%, 67%) 0%, hsl(15, 55%, 58%) 50%, hsl(25, 50%, 63%) 100%)",
    "linear-gradient(145deg, hsl(280, 35%, 55%) 0%, hsl(270, 40%, 50%) 50%, hsl(280, 30%, 52%) 100%)",
  ];
  const PET_LEFT_BORDER_COLORS = [
    "hsl(210, 10%, 55%)",
    "hsl(25, 40%, 50%)",
    "hsl(15, 60%, 48%)",
    "hsl(270, 50%, 45%)",
  ];

  if (loading) {
    return (
      <FeaturePageShell title="Pets" subtitle="Health, weight & care" icon={<Heart className="w-5 h-5" />}>
        <div className="flex flex-col items-center justify-center py-20">
          <DogLoader text="Loading pets…" />
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title="Pets"
      subtitle="Health, weight & care"
      icon={<Heart className="w-5 h-5" />}
    >
      {pets.length > 0 && <DogEntrance />}

      {/* Header Buttons */}
      <div className="flex justify-end gap-2 mb-3">
        <button onClick={() => setAddPetOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border text-primary hover:bg-muted/30 transition-all text-xs font-semibold shadow-soft">
          <Plus className="w-4 h-4" /> Add Pet
        </button>
        <Dialog open={addPetOpen} onOpenChange={(o) => { setAddPetOpen(o); if (!o) setAddPetError(null); }}>
          <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
            <DialogHeader><DialogTitle className="font-display">Add a Pet</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label>Name</Label>
                  <Input value={newPetName} onChange={(e) => setNewPetName(e.target.value)} placeholder="e.g. Billy" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Breed</Label>
                  <Input value={newPetBreed} onChange={(e) => setNewPetBreed(e.target.value)} placeholder="e.g. Labrador" className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Date of Birth</Label>
                  <Input type="date" value={newPetBirthday} onChange={(e) => setNewPetBirthday(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Avatar Emoji</Label>
                  <Input value={newPetAvatar} onChange={(e) => setNewPetAvatar(e.target.value)} placeholder="🐶" className="h-11 rounded-xl text-2xl" maxLength={2} />
                </div>
              </div>
              <Button onClick={handleAddPet} disabled={!newPetName.trim() || !newPetBirthday || addPetLoading} className="w-full h-11 rounded-xl bg-gradient-primary">
                {addPetLoading ? "Adding…" : "Add Pet"}
              </Button>
              {addPetError && <p className="text-xs text-destructive text-center">{addPetError}</p>}
            </div>
          </DialogContent>
        </Dialog>
        {pets.length > 0 && (
          <button
            onClick={() => { setSettingsPetId(firstPetId); setSettingsOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all text-xs font-semibold shadow-card"
          >
            <span className="text-lg">🐾</span>
            Pet Settings
          </button>
        )}
      </div>

      {/* Share Pet Dialog */}
      <Dialog open={shareOpen} onOpenChange={(o) => { setShareOpen(o); if (!o) { setShareEmail(""); setShareError(null); setShareSuccess(false); } }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <UserPlus className="w-4 h-4" />
              Share Pet
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-xs text-muted-foreground">
              Enter the email address of another app user to give them access to{" "}
              <strong>{pets.find(p => p.id === sharePetId)?.name ?? "this pet"}</strong>.
              They will be able to view and update this pet's data.
            </p>
            <div className="space-y-1.5">
              <Label>Email address</Label>
              <Input
                type="email"
                value={shareEmail}
                onChange={(e) => setShareEmail(e.target.value)}
                placeholder="name@example.com"
                className="h-11 rounded-xl"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            {shareError && <p className="text-xs text-destructive">{shareError}</p>}
            {shareSuccess && <p className="text-xs text-success font-medium">✓ Shared successfully! They'll see this pet next time they open the app.</p>}
            <Button
              onClick={handleShare}
              disabled={!shareEmail.trim() || shareLoading}
              className="w-full h-11 rounded-xl bg-gradient-primary"
            >
              {shareLoading ? "Sharing…" : "Share Access"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {pets.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-warm flex items-center justify-center text-4xl mb-5 shadow-elevated">🐾</div>
          <p className="text-base font-bold text-card-foreground mb-1">No pets yet</p>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">Add your first furry family member to start tracking their health, treatments and more.</p>
          <button onClick={() => setAddPetOpen(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-primary text-white text-sm font-semibold shadow-glow">
            <Plus className="w-4 h-4" /> Add First Pet
          </button>
        </div>
      )}

      {/* Pet Tiles */}
      {pets.length > 0 && (
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
              style={{ background: PET_BG_STYLES[i % PET_BG_STYLES.length], borderLeftWidth: 4, borderLeftColor: PET_LEFT_BORDER_COLORS[i % PET_LEFT_BORDER_COLORS.length] }}
            >
              <div className="absolute top-2 right-2 opacity-15 text-5xl pointer-events-none">🐾</div>
              <div className="text-3xl mb-2">{pet.avatar}</div>
              <div className="flex items-center justify-between">
                <p className="text-xl font-extrabold font-display text-card-foreground tracking-wide">{pet.name}</p>
                {pet.ownerId === user?.uid ? (
                  <button
                    onClick={() => { setSharePetId(pet.id); setShareOpen(true); setShareError(null); setShareSuccess(false); }}
                    className="p-1.5 rounded-lg bg-black/10 hover:bg-black/20 transition-colors"
                    title="Share with another user"
                  >
                    <Share2 className="w-3.5 h-3.5 text-card-foreground/60" />
                  </button>
                ) : (
                  <span className="text-[9px] bg-black/10 text-card-foreground/50 rounded-full px-2 py-0.5 font-medium">Shared</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-1.5">
                <span className="text-sm">{pet.birthday ? getAge(pet.birthday) : "—"}</span>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm">🎂 {pet.birthday ? getBirthdayCountdown(pet.birthday) : "—"}</span>
              </div>
              <p className="text-lg font-bold font-display text-card-foreground mt-2">{latestW ? `${latestW.weight}kg` : "No weight"}</p>
            </motion.div>
          );
        })}
      </div>
      )}

      {pets.length > 0 && (<>
      {/* Treatment Status */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-amber-500 inline-block" />
            Treatment Status
          </h3>
          <button onClick={() => setAddTreatmentOpen(true)} className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Record</button>
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
              {/* Vaccination status cards */}
              {pet.vaccinationOptions.map((vacOpt) => {
                const status = getVaccinationStatus(pet, vacOpt);
                return (
                  <div
                    key={vacOpt.id}
                    className={`w-full p-3 rounded-xl ${status.bg} border ${status.border} shadow-soft`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                        <span className="text-base">🩺</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-card-foreground">{vacOpt.name}</p>
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
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Full-width treatment notes — one line per pet that has notes */}
        {pets.some((p) => p.treatmentNotes) && (
          <div className="mt-3 space-y-1 px-1">
            {pets.filter((p) => p.treatmentNotes).map((p) => (
              <div key={p.id} className="flex items-start gap-1.5">
                <StickyNote className="w-3 h-3 text-accent flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-foreground font-medium leading-relaxed">
                  <span className="text-muted-foreground">{p.name}: </span>{p.treatmentNotes}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Product coverage table — collapsible */}
        <div className="mt-4">
          <button
            onClick={() => setCoverageOpen((o) => !o)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground font-medium mb-2 hover:text-foreground transition-colors"
          >
            {coverageOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Product coverage guide
          </button>
          {coverageOpen && (
        <div className="rounded-xl border border-border/40 overflow-hidden w-1/2 mx-auto">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-2.5 py-2 font-semibold text-muted-foreground">Product</th>
                <th className="text-center px-1.5 py-2 font-semibold text-muted-foreground">Fleas</th>
                <th className="text-center px-1.5 py-2 font-semibold text-muted-foreground">Ticks</th>
                <th className="text-center px-1.5 py-2 font-semibold text-muted-foreground">Round-worms</th>
                <th className="text-center px-1.5 py-2 font-semibold text-muted-foreground">Tape-worms</th>
                <th className="text-center px-1.5 py-2 font-semibold text-muted-foreground">Lung-worm</th>
                <th className="text-center px-1.5 py-2 font-semibold text-muted-foreground">Mites</th>
              </tr>
            </thead>
            <tbody>
              {([
                { name: "Bravecto",        fleas: true,  ticks: true,  round: false, tape: false, lung: false, mites: true  },
                { name: "Advocate",        fleas: true,  ticks: false, round: true,  tape: false, lung: true,  mites: true  },
                { name: "Anthelmin Plus",  fleas: false, ticks: false, round: true,  tape: true,  lung: false, mites: false },
                { name: "Droncit",         fleas: false, ticks: false, round: false, tape: true,  lung: false, mites: false },
              ] as const).map((row, i) => (
                <tr key={row.name} className={i % 2 === 0 ? "bg-card" : "bg-muted/20"}>
                  <td className="px-2.5 py-2 font-semibold text-card-foreground">{row.name}</td>
                  {([row.fleas, row.ticks, row.round, row.tape, row.lung, row.mites] as boolean[]).map((v, j) => (
                    <td key={j} className="text-center px-1.5 py-2">
                      {v
                        ? <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-success/20 text-success text-[9px] font-bold">✓</span>
                        : <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-destructive/15 text-destructive text-[9px] font-bold">✗</span>
                      }
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
          )}
        </div>
      </div>

      {/* Weight Graph */}
      <div className="p-4 rounded-2xl bg-card border border-border/40 shadow-soft mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-gradient-primary inline-block" />
            Weight History
          </h3>
          <button onClick={() => setAddWeightOpen(true)} className="flex items-center gap-1 text-xs text-primary font-medium"><Plus className="w-3.5 h-3.5" /> Log</button>
        </div>
        <div className="flex gap-3 mb-3">
          {pets.map((p, i) => (
            <button
              key={p.id}
              onClick={() => setVisiblePets((prev) => { const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border transition-all ${
                visiblePets.has(p.id) ? "border-primary/30 bg-card shadow-soft" : "border-border/30 opacity-50"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: WEIGHT_COLORS[i % WEIGHT_COLORS.length] }} />
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
              {pets.map((p, i) => visiblePets.has(p.id) && (
                <Line key={p.id} type="monotone" dataKey={p.id} name={p.name} stroke={WEIGHT_COLORS[i % WEIGHT_COLORS.length]} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insurance */}
      <div className="space-y-3 mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-blue-500 inline-block" />
          Insurance
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {pets.map((pet, i) => {
            const expanded = insuranceExpanded === pet.id;
            const ins = pet.insurance;
            const renewal = daysUntil(ins.renewalDate);
            return (
              <div
                key={pet.id}
                className="rounded-xl border border-border/40 shadow-soft overflow-hidden"
                style={{ background: PET_BG_STYLES[i % PET_BG_STYLES.length], borderLeftWidth: 3, borderLeftColor: PET_LEFT_BORDER_COLORS[i % PET_LEFT_BORDER_COLORS.length] }}
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

      {/* Documents */}
      <div className="space-y-3 mb-5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5" /> Documents
          </h3>
          <button
            onClick={() => { setDocFile(null); setDocTitle(""); setDocPetIds([]); setDocUploadOpen(true); }}
            className="flex items-center gap-1 text-xs text-primary font-medium"
          >
            <Plus className="w-3.5 h-3.5" /> Upload
          </button>
        </div>

        {documents.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-8 rounded-2xl border-2 border-dashed border-border/50 gap-2 cursor-pointer hover:bg-muted/20 transition-colors"
            onClick={() => { setDocFile(null); setDocTitle(""); setDocPetIds([]); setDocUploadOpen(true); }}
          >
            <FolderOpen className="w-7 h-7 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No documents yet — tap to upload</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {documents.map((d) => {
              const isImage = d.fileType?.startsWith("image/");
              const petNames = d.petIds.length === 0 ? "All pets" : d.petIds.map(pid => pets.find(p => p.id === pid)?.name ?? pid).join(", ");
              return (
                <div key={d.id} className="relative rounded-xl border border-border/40 bg-card overflow-hidden shadow-soft">
                  {isImage ? (
                    <a href={d.url} target="_blank" rel="noopener noreferrer">
                      <img src={d.url} alt={d.title} className="w-full h-24 object-cover" />
                    </a>
                  ) : (
                    <a href={d.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center h-24 bg-muted/30">
                      <FileText className="w-10 h-10 text-muted-foreground/50" />
                    </a>
                  )}
                  <div className="p-2">
                    <p className="text-[11px] font-semibold text-foreground truncate">{d.title}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{petNames}</p>
                  </div>
                  <button
                    onClick={() => deleteDocument(d)}
                    className="absolute top-1.5 right-1.5 p-1 rounded-lg bg-background/80 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload document dialog */}
      <input
        ref={docFileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) { setDocFile(f); setDocTitle(f.name.replace(/\.[^.]+$/, "")); }
        }}
      />
      <Dialog open={docUploadOpen} onOpenChange={(o) => { setDocUploadOpen(o); if (!o) setDocFile(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><FolderOpen className="w-4 h-4" /> Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            {!docFile ? (
              <div className="flex gap-2">
                <button
                  onClick={() => docFileRef.current?.click()}
                  className="flex-1 flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:bg-muted/30 transition-colors"
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Upload file / PDF</span>
                </button>
                <button
                  onClick={() => { if (docFileRef.current) { docFileRef.current.setAttribute("capture", "environment"); docFileRef.current.click(); } }}
                  className="flex-1 flex flex-col items-center justify-center gap-2 p-5 rounded-xl border-2 border-dashed border-border hover:bg-muted/30 transition-colors"
                >
                  <Camera className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Take photo</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border">
                {docFile.type.startsWith("image/") ? <ImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" /> : <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />}
                <span className="text-xs text-foreground flex-1 truncate">{docFile.name}</span>
                <button onClick={() => setDocFile(null)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
              </div>
            )}
            {docFile && (<>
              <div className="space-y-1.5">
                <Label>Document title</Label>
                <Input value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="e.g. Vaccination Certificate" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Assign to pet <span className="text-muted-foreground font-normal">(optional — leave blank for all pets)</span></Label>
                <div className="flex flex-wrap gap-2">
                  {pets.map((p) => {
                    const selected = docPetIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => setDocPetIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${selected ? "bg-primary text-primary-foreground border-primary" : "border-border bg-muted/30"}`}
                      >
                        {p.avatar} {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Button
                onClick={async () => {
                  if (!docFile) return;
                  setDocUploading(true);
                  try {
                    await uploadDocument(docFile, docTitle || docFile.name, docPetIds);
                    setDocUploadOpen(false); setDocFile(null); setDocTitle(""); setDocPetIds([]);
                  } finally { setDocUploading(false); }
                }}
                disabled={docUploading}
                className="w-full h-11 rounded-xl bg-gradient-primary"
              >
                {docUploading ? "Uploading…" : "Save Document"}
              </Button>
            </>)}
          </div>
        </DialogContent>
      </Dialog>
      </>)}

      {/* Record Treatment Dialog */}
      <Dialog open={addTreatmentOpen} onOpenChange={(o) => { setAddTreatmentOpen(o); if (!o) setTreatmentError(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Record Treatment</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Pet</Label>
              <Select value={treatmentPetId || firstPetId} onValueChange={setTreatmentPetId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.avatar} {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={treatmentType} onValueChange={(v) => { setTreatmentType(v as "flea" | "worming" | "vaccination"); setSelectedVaccineId(""); }}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flea">🛡️ Flea</SelectItem>
                  <SelectItem value="worming">💉 Worming</SelectItem>
                  <SelectItem value="vaccination">🩺 Vaccination</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(() => {
              const activePet = pets.find(p => p.id === (treatmentPetId || firstPetId));
              if (treatmentType === "vaccination") {
                const vacOpts = activePet?.vaccinationOptions ?? [];
                return vacOpts.length === 0 ? (
                  <p className="text-xs text-warning font-medium bg-warning/10 rounded-lg px-3 py-2">
                    ⚠️ No vaccination types set for {activePet?.name}. Open Pet Settings → Vaccinations to add them first.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Label>Vaccination</Label>
                    <Select value={selectedVaccineId} onValueChange={setSelectedVaccineId}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select vaccine…" /></SelectTrigger>
                      <SelectContent>
                        {vacOpts.map((v) => <SelectItem key={v.id} value={v.id}>{v.name} (every {v.frequencyMonths}mo)</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {selectedVaccineId && (
                      <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                        Next due will be auto-calculated based on the {vacOpts.find(v => v.id === selectedVaccineId)?.frequencyMonths}‑month interval.
                      </p>
                    )}
                  </div>
                );
              }
              const product = treatmentType === "flea" ? activePet?.selectedFlea : activePet?.selectedWorm;
              const options = treatmentType === "flea" ? activePet?.fleaOptions : activePet?.wormOptions;
              return (
                <>
                  {!product && (
                    <p className="text-xs text-warning font-medium bg-warning/10 rounded-lg px-3 py-2">
                      ⚠️ No active {treatmentType === "flea" ? "flea" : "wormer"} product set for {activePet?.name}. Go to Pet Settings → {treatmentType === "flea" ? "Flea" : "Wormer"} Treatment and add a product first.
                    </p>
                  )}
                  {product && (
                    <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
                      Will record <span className="font-semibold text-card-foreground">{product}</span> as given.
                      {options?.find(o => o.product === product) && (
                        <> Next due auto-calculated ({options.find(o => o.product === product)!.frequencyDays}d interval).</>
                      )}
                    </p>
                  )}
                </>
              );
            })()}
            <div className="space-y-2">
              <Label>Date Given</Label>
              <Input type="date" value={treatmentDate} onChange={(e) => setTreatmentDate(e.target.value)} className="h-11 rounded-xl" />
            </div>
            {treatmentError && <p className="text-xs text-destructive">{treatmentError}</p>}
            <Button
              onClick={handleAddTreatment}
              disabled={treatmentLoading || (() => {
                const p = pets.find(x => x.id === (treatmentPetId || firstPetId));
                if (treatmentType === "vaccination") return !selectedVaccineId;
                return treatmentType === "flea" ? !p?.selectedFlea : !p?.selectedWorm;
              })()}
              className="w-full h-11 rounded-xl bg-gradient-primary"
            >
              {treatmentLoading ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log Weight Dialog */}
      <Dialog open={addWeightOpen} onOpenChange={(o) => { setAddWeightOpen(o); if (!o) setWeightError(null); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Log Weight</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Pet</Label>
              <Select value={weightPetId || firstPetId} onValueChange={setWeightPetId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.avatar} {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Weight (kg)</Label>
              <Input type="number" step="0.1" placeholder="e.g. 14.2" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} className="h-11 rounded-xl" />
            </div>
            {weightError && <p className="text-xs text-destructive">{weightError}</p>}
            <Button onClick={handleAddWeight} disabled={weightLoading || !newWeight} className="w-full h-11 rounded-xl bg-gradient-primary">
              {weightLoading ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Treatment History Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-md mx-4 max-h-[80vh] overflow-y-auto">
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
        <DialogContent aria-describedby={undefined} className="max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <span className="text-xl">🐾</span> Dog Settings
            </DialogTitle>
          </DialogHeader>

          <Tabs value={settingsPetId || firstPetId} onValueChange={setSettingsPetId} className="mt-2">
            <TabsList className="w-full">
              {mergedPets.map((p) => (
                <TabsTrigger key={p.id} value={p.id} className="flex-1 gap-1.5">
                  <span>{p.avatar}</span> {p.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {mergedPets.map((pet) => (
              <TabsContent key={pet.id} value={pet.id} className="space-y-5 mt-4">
                {/* Basic Info */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Details</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Date of Birth</Label>
                      <Input type="date" value={pet.birthday} onChange={(e) => patchLocal(pet.id, { birthday: e.target.value })} className="h-10 rounded-xl" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Breed</Label>
                      <Input value={pet.breed} onChange={(e) => patchLocal(pet.id, { breed: e.target.value })} className="h-10 rounded-xl" />
                    </div>
                  </div>
                </div>

                {/* Flea Products */}
                <div>
                  <p className="text-xs font-semibold text-warning uppercase tracking-wider mb-2">Flea Treatment</p>
                  <div className="space-y-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Active Product</Label>
                      <Select value={pet.selectedFlea} onValueChange={(v) => patchLocal(pet.id, { selectedFlea: v })}>
                        <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select flea product" /></SelectTrigger>
                        <SelectContent>
                          {pet.fleaOptions.filter(o => o.product.trim() !== "").map(o => (
                            <SelectItem key={o.id} value={o.product}>{o.product} (every {o.frequencyDays}d)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Available products:</p>
                    {pet.fleaOptions.map((opt, i) => (
                      <div key={opt.id} className="flex gap-2 items-center">
                        <Input value={opt.product} placeholder="Product name" onChange={(e) => {
                          const val = e.target.value;
                          const updated = pet.fleaOptions.map((o, j) => j === i ? { ...o, product: val } : o);
                          patchLocal(pet.id, { fleaOptions: updated });
                        }} className="h-9 rounded-lg flex-1 text-xs" />
                        <Input type="number" min="1" value={opt.frequencyDays} onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          const updated = pet.fleaOptions.map((o, j) => j === i ? { ...o, frequencyDays: val } : o);
                          patchLocal(pet.id, { fleaOptions: updated });
                        }} className="h-9 rounded-lg w-16 text-xs" />
                        <span className="text-[10px] text-muted-foreground shrink-0">days</span>
                        <button
                          onClick={() => {
                            const updated = pet.fleaOptions.filter((_, j) => j !== i);
                            const patch: Partial<Pet> = { fleaOptions: updated };
                            if (pet.selectedFlea === opt.product) patch.selectedFlea = "";
                            patchLocal(pet.id, patch);
                          }}
                          className="text-destructive/60 hover:text-destructive shrink-0 p-1 rounded-md hover:bg-destructive/10 transition-colors"
                          title="Remove product"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button onClick={() => patchLocal(pet.id, { fleaOptions: [...pet.fleaOptions, { id: `fo${Date.now()}`, product: "", frequencyDays: 30 }] })} className="text-[10px] text-warning font-medium flex items-center gap-1">
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
                      <Select value={pet.selectedWorm} onValueChange={(v) => patchLocal(pet.id, { selectedWorm: v })}>
                        <SelectTrigger className="h-10 rounded-xl"><SelectValue placeholder="Select worm product" /></SelectTrigger>
                        <SelectContent>
                          {pet.wormOptions.filter(o => o.product.trim() !== "").map(o => (
                            <SelectItem key={o.id} value={o.product}>{o.product} (every {o.frequencyDays}d)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Available products:</p>
                    {pet.wormOptions.map((opt, i) => (
                      <div key={opt.id} className="flex gap-2 items-center">
                        <Input value={opt.product} placeholder="Product name" onChange={(e) => {
                          const val = e.target.value;
                          const updated = pet.wormOptions.map((o, j) => j === i ? { ...o, product: val } : o);
                          patchLocal(pet.id, { wormOptions: updated });
                        }} className="h-9 rounded-lg flex-1 text-xs" />
                        <Input type="number" min="1" value={opt.frequencyDays} onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value));
                          const updated = pet.wormOptions.map((o, j) => j === i ? { ...o, frequencyDays: val } : o);
                          patchLocal(pet.id, { wormOptions: updated });
                        }} className="h-9 rounded-lg w-16 text-xs" />
                        <span className="text-[10px] text-muted-foreground shrink-0">days</span>
                        <button
                          onClick={() => {
                            const updated = pet.wormOptions.filter((_, j) => j !== i);
                            const patch: Partial<Pet> = { wormOptions: updated };
                            if (pet.selectedWorm === opt.product) patch.selectedWorm = "";
                            patchLocal(pet.id, patch);
                          }}
                          className="text-destructive/60 hover:text-destructive shrink-0 p-1 rounded-md hover:bg-destructive/10 transition-colors"
                          title="Remove product"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <button onClick={() => patchLocal(pet.id, { wormOptions: [...pet.wormOptions, { id: `wo${Date.now()}`, product: "", frequencyDays: 90 }] })} className="text-[10px] text-info font-medium flex items-center gap-1">
                      <Plus className="w-3 h-3" /> Add product
                    </button>
                  </div>
                </div>

                {/* Vaccination Options */}
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Vaccinations</p>
                  <p className="text-[10px] text-muted-foreground mb-2">Define the vaccines {pet.name} receives. Use "Record Treatment → Vaccination" to log when each is given.</p>
                  <div className="space-y-2">
                    {pet.vaccinationOptions.map((opt, i) => (
                      <div key={opt.id} className="flex gap-2 items-center">
                        <Input
                          value={opt.name}
                          placeholder="e.g. Annual Booster"
                          onChange={(e) => {
                            const updated = pet.vaccinationOptions.map((o, j) => j === i ? { ...o, name: e.target.value } : o);
                            patchLocal(pet.id, { vaccinationOptions: updated });
                          }}
                          className="h-9 rounded-lg flex-1 text-xs"
                        />
                        <Input
                          type="number"
                          min="1"
                          value={opt.frequencyMonths}
                          onChange={(e) => {
                            const val = Math.max(1, Number(e.target.value));
                            const updated = pet.vaccinationOptions.map((o, j) => j === i ? { ...o, frequencyMonths: val } : o);
                            patchLocal(pet.id, { vaccinationOptions: updated });
                          }}
                          className="h-9 rounded-lg w-16 text-xs"
                        />
                        <span className="text-[10px] text-muted-foreground shrink-0">mo</span>
                        <button
                          onClick={() => patchLocal(pet.id, { vaccinationOptions: pet.vaccinationOptions.filter((_, j) => j !== i) })}
                          className="text-destructive/60 hover:text-destructive shrink-0 p-1 rounded-md hover:bg-destructive/10 transition-colors"
                          title="Remove"
                        >✕</button>
                      </div>
                    ))}
                    <button
                      onClick={() => patchLocal(pet.id, { vaccinationOptions: [...pet.vaccinationOptions, { id: `vac${Date.now()}`, name: "", frequencyMonths: 12 }] })}
                      className="text-[10px] text-primary font-medium flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add vaccination
                    </button>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-accent uppercase tracking-wider mb-2">Notifications</p>
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-medium text-card-foreground mb-1">Flea reminders</p>
                      {pet.fleaNotifications.map((n, i) => (
                        <div key={n.id} className="flex items-center gap-2 mb-1">
                          <Input type="number" value={n.daysBeforeDue} onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = pet.fleaNotifications.map((nn, j) => j === i ? { ...nn, daysBeforeDue: val } : nn);
                            patchLocal(pet.id, { fleaNotifications: updated });
                          }} className="h-8 rounded-lg w-16 text-xs" />
                          <span className="text-[10px] text-muted-foreground">days before due</span>
                        </div>
                      ))}
                      {pet.fleaNotifications.length < 3 && (
                        <button onClick={() => patchLocal(pet.id, { fleaNotifications: [...pet.fleaNotifications, { id: `fn${Date.now()}`, daysBeforeDue: 1 }] })} className="text-[10px] text-warning font-medium flex items-center gap-1">
                          <Plus className="w-3 h-3" /> Add another reminder
                        </button>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-medium text-card-foreground mb-1">Wormer reminders</p>
                      {pet.wormNotifications.map((n, i) => (
                        <div key={n.id} className="flex items-center gap-2 mb-1">
                          <Input type="number" value={n.daysBeforeDue} onChange={(e) => {
                            const val = Number(e.target.value);
                            const updated = pet.wormNotifications.map((nn, j) => j === i ? { ...nn, daysBeforeDue: val } : nn);
                            patchLocal(pet.id, { wormNotifications: updated });
                          }} className="h-8 rounded-lg w-16 text-xs" />
                          <span className="text-[10px] text-muted-foreground">days before due</span>
                        </div>
                      ))}
                      {pet.wormNotifications.length < 3 && (
                        <button onClick={() => patchLocal(pet.id, { wormNotifications: [...pet.wormNotifications, { id: `wn${Date.now()}`, daysBeforeDue: 1 }] })} className="text-[10px] text-info font-medium flex items-center gap-1">
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
                    onChange={(e) => patchLocal(pet.id, { treatmentNotes: e.target.value })}
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
                      <Input value={pet.insurance.provider} onChange={(e) => patchLocal(pet.id, { insurance: { ...pet.insurance, provider: e.target.value } })} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Policy No.</Label>
                      <Input value={pet.insurance.policyNumber} onChange={(e) => patchLocal(pet.id, { insurance: { ...pet.insurance, policyNumber: e.target.value } })} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Cover Level</Label>
                      <Input value={pet.insurance.coverLevel} onChange={(e) => patchLocal(pet.id, { insurance: { ...pet.insurance, coverLevel: e.target.value } })} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Monthly (£)</Label>
                      <Input type="number" step="0.01" value={pet.insurance.monthlyPremium} onChange={(e) => patchLocal(pet.id, { insurance: { ...pet.insurance, monthlyPremium: Number(e.target.value) } })} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Excess (£)</Label>
                      <Input type="number" value={pet.insurance.excess} onChange={(e) => patchLocal(pet.id, { insurance: { ...pet.insurance, excess: Number(e.target.value) } })} className="h-9 rounded-lg text-xs" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Renewal Date</Label>
                      <Input type="date" value={pet.insurance.renewalDate} onChange={(e) => patchLocal(pet.id, { insurance: { ...pet.insurance, renewalDate: e.target.value } })} className="h-9 rounded-lg text-xs" />
                    </div>
                  </div>
                </div>

                {localEdits[pet.id] && (
                  <p className="text-[11px] font-medium text-warning flex items-center gap-1.5 bg-warning/10 rounded-lg px-3 py-2">
                    <span>●</span> Unsaved changes — press Save to apply
                  </p>
                )}
                {saveSettingsError && saveSettingsLoading === null && (
                  <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveSettingsError}</p>
                )}
                <Button
                  onClick={() => saveSettings(pet.id)}
                  disabled={saveSettingsLoading === pet.id || !localEdits[pet.id]}
                  className="w-full h-10 rounded-xl bg-gradient-primary text-xs"
                >
                  {saveSettingsLoading === pet.id ? "Saving…" : `Save ${pet.name}'s Settings`}
                </Button>
              </TabsContent>
            ))}
          </Tabs>

          <Button variant="outline" onClick={() => setSettingsOpen(false)} className="w-full h-10 rounded-xl mt-1 text-xs">Close</Button>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Pets;


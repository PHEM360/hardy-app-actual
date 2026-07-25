import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Pill, Check, X, Bell, BellOff, Edit2, Trash2, Clock, ChevronDown, ChevronUp, ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useMeds, MED_COLORS, type Medication, type MedUnit } from "@/hooks/useMeds";
import { useHealthProfile } from "@/hooks/useHealthProfile";
import { format } from "date-fns";

const UNITS: MedUnit[] = ["mg", "ml", "tablet", "capsule", "drop", "puff", "patch", "g", "other"];

function timeLabel(t: string): string {
  const [h] = t.split(":").map(Number);
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  if (h < 21) return "Evening";
  return "Night";
}

function MedPill({ med, today, onLog, onSkip, onEdit, onDelete, isLogged, getLogForDose }: {
  med: Medication;
  today: string;
  onLog: (medId: string, time: string, date: string) => void;
  onSkip: (medId: string, time: string, date: string) => void;
  onEdit: (med: Medication) => void;
  onDelete: (id: string) => void;
  isLogged: (medId: string, time: string, date: string) => boolean;
  getLogForDose: (medId: string, time: string, date: string) => import("@/hooks/useMeds").MedLog | null;
}) {

  return (
    <div className="p-3.5 rounded-2xl bg-card border border-border/50 shadow-soft">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5" style={{ backgroundColor: med.color }} />
          <div>
            <p className="text-sm font-bold text-card-foreground">{med.name}</p>
            <p className="text-xs text-muted-foreground">{med.dose} {med.unit}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(med)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Edit2 className="w-3 h-3" />
          </button>
          <button onClick={() => onDelete(med.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {med.notes && <p className="text-[11px] text-muted-foreground italic mb-2.5">{med.notes}</p>}

      <div className="space-y-2">
        {med.times.map((t) => {
          const logged = isLogged(med.id, t, today);
          const logEntry = getLogForDose(med.id, t, today);
          return (
            <div key={t} className={`flex items-center justify-between p-2.5 rounded-xl border transition-colors ${
              logEntry?.skipped ? "bg-muted/30 border-border/30 opacity-60" :
              logged ? "bg-green-50 border-green-200" : "bg-muted/30 border-border/30"
            }`}>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <div>
                  <p className="text-xs font-semibold text-card-foreground">{t}</p>
                  <p className="text-[10px] text-muted-foreground">{timeLabel(t)}</p>
                </div>
              </div>
              {logged ? (
                <div className="flex items-center gap-1.5">
                  {logEntry?.skipped ? (
                    <span className="text-[10px] text-muted-foreground font-medium">Skipped</span>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-[10px] text-green-700 font-semibold">Taken {logEntry?.takenAt}</span>
                    </>
                  )}
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <button
                    onClick={() => onLog(med.id, t, today)}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors"
                  >
                    <Check className="w-3 h-3" /> Taken
                  </button>
                  <button
                    onClick={() => onSkip(med.id, t, today)}
                    className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function HealthMeds({ scopeUserId }: { scopeUserId?: string } = {}) {
  const { medications, loading, addMedication, updateMedication, deleteMedication, logDose, scheduleTodayNotifications, isLogged, getLogForDose } = useMeds(scopeUserId);
  const { profile, saveProfile } = useHealthProfile(scopeUserId);
  const today = new Date().toISOString().split("T")[0];

  const [addOpen, setAddOpen]           = useState(false);
  const [editTarget, setEditTarget]     = useState<Medication | null>(null);
  const [name, setName]                 = useState("");
  const [dose, setDose]                 = useState("");
  const [unit, setUnit]                 = useState<MedUnit>("mg");
  const [times, setTimes]               = useState<string[]>(["08:00"]);
  const [color, setColor]               = useState(MED_COLORS[5]);
  const [notes, setNotes]               = useState("");
  const [saving, setSaving]             = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Medical history state
  const [histOpen, setHistOpen]     = useState(false);
  const [hConditions, setHCond]     = useState("");
  const [hFamily, setHFamily]       = useState("");
  const [hAllergies, setHAllerg]    = useState("");
  const [hSurgeries, setHSurg]      = useState("");
  const [hNotes, setHNotes]         = useState("");
  const [histSaving, setHistSaving] = useState(false);

  // Request notification permission + schedule
  useEffect(() => {
    if (typeof Notification !== "undefined") {
      setNotifEnabled(Notification.permission === "granted");
    }
  }, []);

  useEffect(() => {
    if (medications.length > 0 && notifEnabled) {
      scheduleTodayNotifications(medications);
    }
  }, [medications, notifEnabled, scheduleTodayNotifications]);

  const requestNotif = async () => {
    const perm = await Notification.requestPermission();
    setNotifEnabled(perm === "granted");
  };

  const openAdd = () => {
    setEditTarget(null);
    setName(""); setDose(""); setUnit("mg");
    setTimes(["08:00"]); setColor(MED_COLORS[5]); setNotes("");
    setAddOpen(true);
  };

  const openHistory = () => {
    setHCond(profile.pastConditions.join(", "));
    setHFamily(profile.familyHistory.join("; "));
    setHAllerg(profile.allergies.join(", "));
    setHSurg(profile.surgeries.join(", "));
    setHNotes(profile.otherNotes ?? "");
    setHistOpen(true);
  };

  const saveHistory = async () => {
    setHistSaving(true);
    try {
      const splitTrim = (s: string) => s.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
      await saveProfile({
        pastConditions: splitTrim(hConditions),
        familyHistory:  splitTrim(hFamily),
        allergies:      splitTrim(hAllergies),
        surgeries:      splitTrim(hSurgeries),
        otherNotes:     hNotes.trim() || undefined,
      });
      setHistOpen(false);
    } finally { setHistSaving(false); }
  };

  const openEdit = (med: Medication) => {
    setEditTarget(med);
    setName(med.name); setDose(med.dose); setUnit(med.unit);
    setTimes([...med.times]); setColor(med.color); setNotes(med.notes ?? "");
    setAddOpen(true);
  };

  const save = async () => {
    if (!name.trim() || !dose.trim() || times.length === 0) return;
    setSaving(true);
    try {
      const payload = {
        name: name.trim(), dose: dose.trim(), unit, times: times.sort(),
        color, notes: notes.trim(), active: true,
        startDate: today,
      };
      if (editTarget) {
        await updateMedication(editTarget.id, payload);
      } else {
        await addMedication(payload);
      }
      setAddOpen(false);
    } finally { setSaving(false); }
  };

  const addTime = () => setTimes((t) => [...t, "12:00"]);
  const updateTime = (i: number, v: string) => setTimes((t) => t.map((x, j) => j === i ? v : x));
  const removeTime = (i: number) => setTimes((t) => t.filter((_, j) => j !== i));

  const activeMeds   = medications.filter((m) => m.active);
  const inactiveMeds = medications.filter((m) => !m.active);

  const takenCount = activeMeds.reduce((acc, med) => {
    return acc + med.times.filter((t) => isLogged(med.id, t, today)).length;
  }, 0);
  const totalCount = activeMeds.reduce((acc, m) => acc + m.times.length, 0);

  if (loading) return <div className="py-20 text-center text-muted-foreground text-sm">Loading meds…</div>;

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-card-foreground">Today's Medications</h3>
          <p className="text-xs text-muted-foreground">{format(new Date(), "EEEE, d MMMM")}</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={notifEnabled ? undefined : requestNotif}
            className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
              notifEnabled ? "bg-green-50 border-green-200 text-green-700" : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {notifEnabled ? <Bell className="w-3 h-3" /> : <BellOff className="w-3 h-3" />}
            <span>{notifEnabled ? "Alerts on" : "Enable alerts"}</span>
          </button>
          <Button onClick={openAdd} size="sm" className="rounded-xl text-xs bg-gradient-primary h-8 gap-1">
            <Plus className="w-3.5 h-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="mb-4 p-3.5 rounded-2xl bg-card border border-border/50">
          <div className="flex justify-between text-xs mb-2">
            <span className="font-semibold text-card-foreground">Today's progress</span>
            <span className="text-muted-foreground">{takenCount}/{totalCount} doses</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: totalCount > 0 ? `${(takenCount / totalCount) * 100}%` : "0%" }}
            />
          </div>
          {takenCount === totalCount && totalCount > 0 && (
            <p className="text-xs text-green-700 font-semibold text-center mt-2">✅ All done for today!</p>
          )}
        </div>
      )}

      {/* Empty state */}
      {activeMeds.length === 0 && (
        <div className="py-14 text-center">
          <div className="inline-flex p-4 rounded-full bg-muted/40 mb-3">
            <Pill className="w-7 h-7 text-muted-foreground/40" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No medications added</p>
          <p className="text-xs text-muted-foreground/70 mt-1 mb-4">Add your medications to track daily doses.</p>
          <Button onClick={openAdd} size="sm" className="rounded-xl bg-gradient-primary text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Medication
          </Button>
        </div>
      )}

      {/* Meds list */}
      <div className="space-y-3">
        {activeMeds.map((med, i) => (
          <motion.div key={med.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <MedPill
              med={med}
              today={today}
              onLog={(id, t, d) => logDose(id, t, d, false)}
              onSkip={(id, t, d) => logDose(id, t, d, true)}
              onEdit={openEdit}
              onDelete={(id) => updateMedication(id, { active: false })}
              isLogged={isLogged}
              getLogForDose={getLogForDose}
            />
          </motion.div>
        ))}
      </div>

      {/* Inactive meds */}
      {inactiveMeds.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowInactive((x) => !x)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-2"
          >
            {showInactive ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {inactiveMeds.length} inactive medication{inactiveMeds.length > 1 ? "s" : ""}
          </button>
          <AnimatePresence>
            {showInactive && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {inactiveMeds.map((med) => (
                  <div key={med.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30 opacity-60">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: med.color }} />
                      <span className="text-xs text-muted-foreground">{med.name} {med.dose}{med.unit}</span>
                    </div>
                    <button onClick={() => updateMedication(med.id, { active: true })} className="text-[10px] text-primary font-medium">
                      Re-activate
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── Past Medical History ── */}
      <div className="mt-6 p-4 rounded-2xl bg-card border border-border/50 shadow-soft">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-3.5 h-3.5 text-muted-foreground" />
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Past Medical History</h3>
          </div>
          <button onClick={openHistory} className="text-xs text-primary font-medium">
            {(profile.pastConditions.length || profile.familyHistory.length || profile.allergies.length || profile.surgeries.length) ? "Edit" : "Add"}
          </button>
        </div>
        {!profile.pastConditions.length && !profile.familyHistory.length && !profile.allergies.length && !profile.surgeries.length ? (
          <p className="text-xs text-muted-foreground text-center py-4">No medical history recorded. Tap Add to include conditions, family history, allergies and surgeries — used by the AI analysis.</p>
        ) : (
          <div className="space-y-3 text-xs">
            {profile.pastConditions.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Conditions</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.pastConditions.map((c, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 border border-orange-200 text-[11px] font-medium">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {profile.familyHistory.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Family History</p>
                <ul className="space-y-0.5">
                  {profile.familyHistory.map((f, i) => (
                    <li key={i} className="text-[11px] text-card-foreground">• {f}</li>
                  ))}
                </ul>
              </div>
            )}
            {profile.allergies.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Allergies</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.allergies.map((a, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-full bg-red-100 text-red-700 border border-red-200 text-[11px] font-medium">{a}</span>
                  ))}
                </div>
              </div>
            )}
            {profile.surgeries.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">Surgeries / Procedures</p>
                <ul className="space-y-0.5">
                  {profile.surgeries.map((s, i) => (
                    <li key={i} className="text-[11px] text-card-foreground">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {profile.otherNotes && (
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mb-1">Notes</p>
                <p className="text-[11px] text-card-foreground italic">{profile.otherNotes}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Medical History dialog */}
      <Dialog open={histOpen} onOpenChange={setHistOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Past Medical History</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Past / current conditions</Label>
              <Textarea value={hConditions} onChange={(e) => setHCond(e.target.value)}
                placeholder="e.g. Hypertension, Type 2 Diabetes (separate with commas)" className="rounded-xl text-xs min-h-[72px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Family history</Label>
              <Textarea value={hFamily} onChange={(e) => setHFamily(e.target.value)}
                placeholder="e.g. Father: heart attack at 58; Mother: Type 2 Diabetes (separate with semicolons)" className="rounded-xl text-xs min-h-[72px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Allergies</Label>
              <Textarea value={hAllergies} onChange={(e) => setHAllerg(e.target.value)}
                placeholder="e.g. Penicillin, Ibuprofen (separate with commas)" className="rounded-xl text-xs min-h-[60px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Surgeries / procedures</Label>
              <Textarea value={hSurgeries} onChange={(e) => setHSurg(e.target.value)}
                placeholder="e.g. Appendectomy 2010, Knee replacement 2019 (separate with commas)" className="rounded-xl text-xs min-h-[60px]" />
            </div>
            <div className="space-y-1.5">
              <Label>Other notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={hNotes} onChange={(e) => setHNotes(e.target.value)}
                placeholder="Any other relevant health information" className="rounded-xl text-xs min-h-[60px]" />
            </div>
            <Button onClick={saveHistory} disabled={histSaving} className="w-full h-11 rounded-xl bg-gradient-primary">
              {histSaving ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{editTarget ? "Edit Medication" : "Add Medication"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lisinopril" className="h-11 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dose</Label>
                <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 10" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={unit} onValueChange={(v) => setUnit(v as MedUnit)}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>

            {/* Colour */}
            <div className="space-y-1.5">
              <Label>Colour</Label>
              <div className="flex gap-2 flex-wrap">
                {MED_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "scale-125 border-foreground" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Times */}
            <div className="space-y-1.5">
              <Label>Dose times</Label>
              <div className="space-y-2">
                {times.map((t, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      type="time"
                      value={t}
                      onChange={(e) => updateTime(i, e.target.value)}
                      className="flex-1 h-10 rounded-xl"
                    />
                    <span className="text-xs text-muted-foreground w-20">{timeLabel(t)}</span>
                    {times.length > 1 && (
                      <button onClick={() => removeTime(i)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                <button onClick={addTime} className="text-xs text-primary font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add time
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Take with food" className="rounded-xl text-xs min-h-[60px]" />
            </div>

            <Button
              onClick={save}
              disabled={saving || !name.trim() || !dose.trim() || times.length === 0}
              className="w-full h-11 rounded-xl bg-gradient-primary"
            >
              {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Medication"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

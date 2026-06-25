import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Lock, KeyRound, Plus, Trash2, QrCode,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Clock, Calendar, FlaskConical, X,
  Settings, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubstances, type SubstanceLog, type WeaningEntry } from "@/hooks/useSubstances";
import { useAuth } from "@/auth/AuthContext";
import {
  format, parseISO, differenceInDays, startOfDay,
  startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  isToday, addMonths, subMonths,
} from "date-fns";
import QRCode from "react-qr-code";

const COMMON_UNITS = ["mg", "g", "ml", "μg", "tablet", "capsule", "dose", "line", "joint", "other"];

// ── Substance colour palette ─────────────────────────────────────────────────
const SUBSTANCE_PALETTE = [
  "#8b5cf6", "#0ea5e9", "#10b981", "#f59e0b",
  "#ef4444", "#ec4899", "#6366f1", "#84cc16", "#f97316", "#14b8a6",
];
function substanceColor(name: string, allNames: string[]): string {
  const idx = allNames.indexOf(name);
  if (idx < 0) return "#94a3b8";
  return SUBSTANCE_PALETTE[idx % SUBSTANCE_PALETTE.length];
}

// ── Calendar day status logic ────────────────────────────────────────────────
function computeDayStatus(
  date: string,
  logs: SubstanceLog[],
  plan: WeaningEntry[],
): "green" | "amber" | "red" | "neutral" {
  const entries = plan.filter((e) => e.date === date);
  if (entries.length === 0) return "neutral";
  const dayLogs = logs.filter((l) => l.date === date);
  let worst: "green" | "amber" | "red" = "green";
  let hasData = false;
  for (const entry of entries) {
    const matching = dayLogs.filter(
      (l) => l.name === entry.substance && l.unit === entry.unit,
    );
    if (matching.length === 0) continue;
    hasData = true;
    const logged = matching.reduce((s, l) => s + (parseFloat(l.dose) || 0), 0);
    if (logged > entry.targetDose * 1.1) { worst = "red"; }
    else if (logged > entry.targetDose && worst !== "red") { worst = "amber"; }
  }
  return hasData ? worst : "neutral";
}

// ── TOTP code input (6 boxes) ────────────────────────────────────────────────
function TotpInput({ onVerify, onSetupRequest }: {
  onVerify: (code: string) => boolean;
  onSetupRequest: () => void;
}) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const handleSubmit = () => {
    if (onVerify(code)) {
      // parent will unmount this
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => { setShaking(false); setCode(""); setError(false); }, 600);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 py-8">
      <div className="p-4 rounded-full bg-violet-500/15">
        <Lock className="w-8 h-8 text-violet-600" />
      </div>
      <div>
        <h3 className="text-base font-bold text-center text-card-foreground">Substances — Locked</h3>
        <p className="text-xs text-muted-foreground text-center mt-1">Enter your 6-digit authenticator code to continue</p>
      </div>

      <motion.div
        animate={shaking ? { x: [0, -8, 8, -8, 8, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-3"
      >
        <Input
          type="tel"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && handleSubmit()}
          placeholder="000000"
          className={`text-center text-2xl font-mono tracking-[0.5em] h-14 w-44 rounded-2xl border-2 ${
            error ? "border-destructive" : "border-border"
          }`}
          autoFocus
        />
        {error && <p className="text-xs text-destructive font-medium">Incorrect code — try again</p>}
      </motion.div>

      <div className="flex flex-col items-center gap-2 w-full max-w-xs">
        <Button
          onClick={handleSubmit}
          disabled={code.length !== 6}
          className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
        >
          <ShieldCheck className="w-4 h-4 mr-1.5" /> Unlock
        </Button>
        <button
          onClick={onSetupRequest}
          className="text-xs text-muted-foreground hover:text-foreground mt-1"
        >
          Reset / re-setup authenticator
        </button>
      </div>
    </div>
  );
}

// ── TOTP Setup flow ──────────────────────────────────────────────────────────
function TotpSetup({ email, onComplete }: { email: string; onComplete: () => void }) {
  const { setupTotp, confirmTotpSetup, verifyTotp } = useSubstances();
  const [step, setStep] = useState<"generate" | "scan" | "verify">("generate");
  const [secret, setSecret] = useState("");
  const [uri, setUri] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { secret: s, uri: u } = await setupTotp(email);
      setSecret(s);
      setUri(u);
      setStep("scan");
    } finally { setLoading(false); }
  };

  const verify = async () => {
    if (!verifyTotp(verifyCode)) {
      setVerifyError(true);
      setTimeout(() => setVerifyError(false), 2000);
      return;
    }
    await confirmTotpSetup();
    onComplete();
  };

  return (
    <div className="py-4 space-y-5">
      {step === "generate" && (
        <div className="flex flex-col items-center gap-5">
          <div className="p-4 rounded-full bg-violet-500/15">
            <KeyRound className="w-8 h-8 text-violet-600" />
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-card-foreground">Set up TOTP protection</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
              You'll scan a QR code with Google Authenticator, Authy, or any TOTP app. A 6-digit rotating code will lock this tab.
            </p>
          </div>
          <Button onClick={generate} disabled={loading} className="w-full max-w-xs h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
            {loading ? "Generating…" : "Generate QR Code"}
          </Button>
        </div>
      )}

      {step === "scan" && (
        <div className="flex flex-col items-center gap-4">
          <div className="text-center">
            <h3 className="text-sm font-bold text-card-foreground mb-0.5">Scan with your authenticator app</h3>
            <p className="text-xs text-muted-foreground">Open Google Authenticator or Authy, tap + and scan this QR code</p>
          </div>

          <div className="p-3 bg-white rounded-2xl border border-border/50 shadow-sm">
            <QRCode value={uri} size={180} />
          </div>

          <button
            onClick={() => setShowManual(!showManual)}
            className="flex items-center gap-1.5 text-xs text-primary font-medium"
          >
            <QrCode className="w-3.5 h-3.5" />
            {showManual ? "Hide" : "Show"} manual entry key
          </button>

          {showManual && (
            <div className="w-full max-w-xs p-3 rounded-xl bg-muted/40 border border-border/40">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Manual setup key</p>
              <p className="text-xs font-mono font-bold break-all select-all text-card-foreground">{secret}</p>
              <p className="text-[10px] text-muted-foreground mt-1.5">Issuer: Hardy Hub · Algorithm: SHA1 · Digits: 6 · Period: 30s</p>
            </div>
          )}

          <Button onClick={() => setStep("verify")} className="w-full max-w-xs h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
            I've scanned it →
          </Button>
        </div>
      )}

      {step === "verify" && (
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 rounded-full bg-green-500/15">
            <CheckCircle2 className="w-7 h-7 text-green-600" />
          </div>
          <div className="text-center">
            <h3 className="text-sm font-bold text-card-foreground">Verify your code</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Enter the 6-digit code from your app to confirm setup</p>
          </div>
          <Input
            type="tel"
            inputMode="numeric"
            maxLength={6}
            value={verifyCode}
            onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            onKeyDown={(e) => e.key === "Enter" && verifyCode.length === 6 && verify()}
            placeholder="000000"
            className={`text-center text-2xl font-mono tracking-[0.5em] h-14 w-44 rounded-2xl border-2 ${verifyError ? "border-destructive" : ""}`}
            autoFocus
          />
          {verifyError && <p className="text-xs text-destructive">Wrong code — wait for the next one</p>}
          <Button onClick={verify} disabled={verifyCode.length !== 6} className="w-full max-w-xs h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white">
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm &amp; Activate
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Weaning schedule settings dialog ────────────────────────────────────────
function WeaningScheduleDialog({
  open, onClose, weaningSchedule, substanceNames, onSave,
}: {
  open: boolean;
  onClose: () => void;
  weaningSchedule: WeaningEntry[];
  substanceNames: string[];
  onSave: (entries: WeaningEntry[]) => Promise<void>;
}) {
  const [entries, setEntries] = useState<WeaningEntry[]>([]);
  const [newDate, setNewDate] = useState(new Date().toISOString().split("T")[0]);
  const [newSub, setNewSub] = useState(substanceNames[0] ?? "");
  const [newDose, setNewDose] = useState("");
  const [newUnit, setNewUnit] = useState("mg");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEntries([...weaningSchedule].sort((a, b) => a.date.localeCompare(b.date)));
      setNewSub(substanceNames[0] ?? "");
    }
  }, [open, weaningSchedule, substanceNames]);

  const addEntry = () => {
    if (!newDate || !newSub || !newDose) return;
    setEntries((prev) =>
      [...prev, { id: `${newDate}_${newSub}_${Date.now()}`, date: newDate, substance: newSub, targetDose: parseFloat(newDose), unit: newUnit }]
        .sort((a, b) => a.date.localeCompare(b.date))
    );
    setNewDose("");
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(entries); onClose(); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-violet-600" /> Weaning Schedule
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-xs text-muted-foreground">Set target doses by date. The calendar highlights days where actual intake exceeded the plan.</p>

          {/* Existing entries */}
          {entries.length > 0 && (
            <div className="space-y-1 max-h-44 overflow-y-auto rounded-xl border border-border/40 p-2">
              {entries.map((e, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40 text-xs">
                  <span className="text-muted-foreground shrink-0 w-14">{format(parseISO(e.date), "d MMM yy")}</span>
                  <span className="flex-1 font-medium truncate">{e.substance}</span>
                  <span className="font-bold shrink-0">{e.targetDose} {e.unit}</span>
                  <button onClick={() => setEntries((p) => p.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new entry */}
          <div className="rounded-xl border border-border/50 p-3 space-y-2.5 bg-muted/10">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Add Entry</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-9 rounded-lg text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Substance</Label>
                {substanceNames.length > 0 ? (
                  <Select value={newSub} onValueChange={setNewSub}>
                    <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{substanceNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                  </Select>
                ) : (
                  <Input value={newSub} onChange={(e) => setNewSub(e.target.value)} className="h-9 rounded-lg text-xs" placeholder="Substance" />
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Target dose</Label>
                <Input type="number" value={newDose} onChange={(e) => setNewDose(e.target.value)} placeholder="e.g. 20" className="h-9 rounded-lg text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Select value={newUnit} onValueChange={setNewUnit}>
                  <SelectTrigger className="h-9 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{COMMON_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" onClick={addEntry} disabled={!newDate || !newSub || !newDose}
              className="w-full h-8 rounded-lg text-xs bg-violet-600 hover:bg-violet-700 text-white">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add to schedule
            </Button>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
            {saving ? "Saving…" : "Save Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Weaning calendar ─────────────────────────────────────────────────────────
function WeaningCalendar({
  logs, weaningSchedule, calendarOverrides, onSetOverride, allSubstanceNames,
}: {
  logs: SubstanceLog[];
  weaningSchedule: WeaningEntry[];
  calendarOverrides: Record<string, "green" | "amber" | "red">;
  onSetOverride: (date: string, status: "green" | "amber" | "red" | null) => void;
  allSubstanceNames: string[];
}) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [popDate, setPopDate] = useState<string | null>(null);

  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = (getDay(monthStart) + 6) % 7; // Mon=0
  const cells: (Date | null)[] = [...Array(startPad).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const DOW = ["M", "T", "W", "T", "F", "S", "S"];

  // Close popover when clicking outside
  useEffect(() => {
    if (!popDate) return;
    const close = () => setPopDate(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [popDate]);

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-soft p-3">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setMonth((m) => subMonths(m, 1))} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs font-bold text-card-foreground">{format(month, "MMMM yyyy")}</span>
        <button onClick={() => setMonth((m) => addMonths(m, 1))} className="p-1 rounded-lg hover:bg-muted text-muted-foreground">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 mb-0.5">
        {DOW.map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground py-0.5">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = format(day, "yyyy-MM-dd");
          const isFuture = day > new Date();
          const autoStatus = isFuture ? "neutral" : computeDayStatus(dateStr, logs, weaningSchedule);
          const override = calendarOverrides[dateStr] ?? null;
          const status = override ?? autoStatus;
          const today = isToday(day);

          const dayLogs = logs.filter((l) => l.date === dateStr);
          const uniqSubs = Array.from(new Set(dayLogs.map((l) => l.name)));
          const isPopped = popDate === dateStr;

          const cellBg =
            status === "green" ? "bg-green-100 border-green-300" :
            status === "amber" ? "bg-amber-100 border-amber-300" :
            status === "red"   ? "bg-red-100 border-red-300" :
            "bg-card border-border/30";

          return (
            <div key={i} className="relative">
              <button
                onClick={(e) => { e.stopPropagation(); setPopDate(isPopped ? null : dateStr); }}
                className={`w-full border rounded-lg flex flex-col items-start p-0.5 transition-all min-h-[40px] ${cellBg} ${today ? "ring-2 ring-violet-400 ring-inset" : ""} ${isFuture ? "opacity-40" : "hover:brightness-95"}`}
              >
                <span className={`text-[9px] font-bold leading-none px-0.5 ${today ? "text-violet-600" : "text-card-foreground"}`}>
                  {format(day, "d")}
                </span>
                {/* Override indicator dot */}
                {override && (
                  <div className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full border border-white ${
                    override === "green" ? "bg-green-600" : override === "amber" ? "bg-amber-500" : "bg-red-500"
                  }`} />
                )}
                {/* Substance name pills */}
                {uniqSubs.length > 0 && (
                  <div className="flex flex-col gap-0.5 mt-auto w-full px-0.5 pb-0.5">
                    {uniqSubs.slice(0, 3).map((sub) => {
                      const col = substanceColor(sub, allSubstanceNames);
                      return (
                        <span
                          key={sub}
                          style={{ backgroundColor: col + "33", color: col, borderColor: col + "66" }}
                          className="text-[7px] font-bold leading-none px-1 py-0.5 rounded border truncate w-full block text-center"
                        >
                          {sub.length > 6 ? sub.slice(0, 6) + "…" : sub}
                        </span>
                      );
                    })}
                    {uniqSubs.length > 3 && (
                      <span className="text-[7px] text-muted-foreground text-center">+{uniqSubs.length - 3}</span>
                    )}
                  </div>
                )}
              </button>

              {/* Detail / override popover */}
              {isPopped && (
                <div
                  className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-56 rounded-xl border border-border bg-card shadow-2xl p-3 space-y-2.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-xs font-bold">{format(day, "d MMMM yyyy")}</p>

                  {/* Logged doses */}
                  {dayLogs.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">No doses logged</p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground">Logged</p>
                      {dayLogs.map((log, li) => (
                        <div key={li} className="flex items-center gap-1.5 text-[10px]">
                          <div style={{ backgroundColor: substanceColor(log.name, allSubstanceNames) }} className="w-2 h-2 rounded-full shrink-0" />
                          <span className="font-medium flex-1 truncate">{log.name}</span>
                          <span className="text-muted-foreground shrink-0">{log.dose} {log.unit}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Weaning plan */}
                  {weaningSchedule.filter((e) => e.date === dateStr).length > 0 && (
                    <div className="border-t border-border/30 pt-1.5">
                      <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">Plan (max)</p>
                      {weaningSchedule.filter((e) => e.date === dateStr).map((e, ei) => (
                        <p key={ei} className="text-[10px] text-muted-foreground">{e.substance}: {e.targetDose} {e.unit}</p>
                      ))}
                    </div>
                  )}

                  {/* Colour override */}
                  <div className="border-t border-border/30 pt-1.5">
                    <p className="text-[9px] uppercase tracking-wider font-semibold text-muted-foreground mb-1.5">Override colour</p>
                    <div className="flex gap-1.5 items-center">
                      <button
                        onClick={() => { onSetOverride(dateStr, null); setPopDate(null); }}
                        className={`flex-1 py-1 text-[10px] rounded-md border font-medium transition-colors ${
                          !override ? "bg-primary/10 border-primary text-primary" : "border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >Auto</button>
                      {(["green", "amber", "red"] as const).map((s) => (
                        <button
                          key={s}
                          title={s}
                          onClick={() => { onSetOverride(dateStr, override === s ? null : s); setPopDate(null); }}
                          className={`w-7 h-7 rounded-md border-2 transition-all ${
                            s === "green" ? (override === "green" ? "bg-green-500 border-green-700" : "bg-green-100 border-green-300") :
                            s === "amber" ? (override === "amber" ? "bg-amber-500 border-amber-700" : "bg-amber-100 border-amber-300") :
                            (override === "red" ? "bg-red-500 border-red-700" : "bg-red-100 border-red-300")
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-2.5 border-t border-border/30">
        {([["green", "On target"] as const, ["amber", "≤10% over"] as const, ["red", ">10% over"] as const]).map(([s, label]) => (
          <div key={s} className="flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-sm ${s === "green" ? "bg-green-300" : s === "amber" ? "bg-amber-300" : "bg-red-300"}`} />
            <span className="text-[9px] text-muted-foreground">{label}</span>
          </div>
        ))}
        {allSubstanceNames.slice(0, 5).map((name) => (
          <div key={name} className="flex items-center gap-1">
            <div style={{ backgroundColor: substanceColor(name, allSubstanceNames) }} className="w-2.5 h-2.5 rounded-full" />
            <span className="text-[9px] text-muted-foreground">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main substance log view ──────────────────────────────────────────────────
function SubstancesContent({ onLock }: { onLock: () => void }) {
  const {
    logs, loading, addLog, deleteLog, resetTotp, substanceNames, addSubstanceName, removeSubstanceName,
    weaningSchedule, calendarOverrides, saveWeaningSchedule, setCalendarOverride,
  } = useSubstances();
  const [logOpen, setLogOpen] = useState(false);
  const [addSubstanceOpen, setAddSubstanceOpen] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [weaningOpen, setWeaningOpen] = useState(false);
  const [expandedSubstance, setExpandedSubstance] = useState<string | null>(null);

  // Form state
  const [logSubstance, setLogSubstance] = useState("");
  const [dose, setDose]   = useState("");
  const [unit, setUnit]   = useState("mg");
  const [date, setDate]   = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime]   = useState("morning");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Add substance form
  const [newSubName, setNewSubName] = useState("");
  const [addingName, setAddingName] = useState(false);

  // Combine tracked names with any names that appear in logs (for backwards compat)
  const logNames = Array.from(new Set(logs.map((l) => l.name)));
  const allSubstanceNames = Array.from(new Set([...substanceNames, ...logNames])).sort();

  const openLog = (substanceName?: string) => {
    setLogSubstance(substanceName ?? (allSubstanceNames[0] ?? ""));
    setDose(""); setUnit("mg");
    setDate(new Date().toISOString().split("T")[0]);
    setTime("morning");
    setNotes("");
    setLogOpen(true);
  };

  const save = async () => {
    if (!logSubstance.trim() || !dose.trim()) return;
    setSaving(true);
    try {
      // Auto-register substance name if not already tracked
      if (!substanceNames.includes(logSubstance.trim())) {
        await addSubstanceName(logSubstance.trim());
      }
      await addLog({ name: logSubstance.trim(), dose: dose.trim(), unit, date, time, notes: notes.trim() || undefined });
      setLogOpen(false);
    } finally { setSaving(false); }
  };

  const addNewSubstance = async () => {
    if (!newSubName.trim()) return;
    setAddingName(true);
    try {
      await addSubstanceName(newSubName.trim());
      setNewSubName("");
      setAddSubstanceOpen(false);
    } finally { setAddingName(false); }
  };

  // Group logs per substance
  const logsBySubstance = (name: string) => logs.filter((l) => l.name === name);

  function daysSince(dateStr: string): number {
    return differenceInDays(startOfDay(new Date()), startOfDay(parseISO(dateStr)));
  }

  function daysSinceLabel(days: number): { text: string; color: string } {
    if (days === 0) return { text: "Today",    color: "text-red-600 bg-red-50 border-red-200" };
    if (days === 1) return { text: "Yesterday", color: "text-orange-600 bg-orange-50 border-orange-200" };
    if (days <= 7)  return { text: `${days}d ago`, color: "text-amber-600 bg-amber-50 border-amber-200" };
    if (days <= 30) return { text: `${days}d ago`, color: "text-green-700 bg-green-50 border-green-200" };
    return { text: `${days}d ago`, color: "text-blue-700 bg-blue-50 border-blue-200" };
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-violet-500/15">
            <ShieldCheck className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-card-foreground">Substances</h3>
            <p className="text-[11px] text-muted-foreground">Private log · TOTP protected</p>
          </div>
        </div>
        <div className="flex gap-2 items-center">
          <Button
            onClick={() => setWeaningOpen(true)}
            size="sm"
            variant="outline"
            className="rounded-xl text-xs h-8 gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
          >
            <Settings className="w-3.5 h-3.5" /> Weaning
          </Button>
          <Button
            onClick={() => setAddSubstanceOpen(true)}
            size="sm"
            variant="outline"
            className="rounded-xl text-xs h-8 gap-1 border-violet-200 text-violet-700 hover:bg-violet-50"
          >
            <Plus className="w-3.5 h-3.5" /> Substance
          </Button>
          <Button
            onClick={() => openLog()}
            size="sm"
            className="rounded-xl text-xs bg-violet-600 hover:bg-violet-700 text-white h-8 gap-1"
          >
            <FlaskConical className="w-3.5 h-3.5" /> Log dose
          </Button>
        </div>
      </div>

      {/* Empty state */}
      {allSubstanceNames.length === 0 && (
        <div className="py-14 text-center">
          <div className="inline-flex p-4 rounded-full bg-violet-500/10 mb-3">
            <FlaskConical className="w-7 h-7 text-violet-400" />
          </div>
          <p className="text-sm font-semibold text-muted-foreground">No substances tracked yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1 mb-4 max-w-xs mx-auto">Add a substance to start tracking doses and see days since last use.</p>
          <Button onClick={() => setAddSubstanceOpen(true)} size="sm" className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add substance
          </Button>
        </div>
      )}

      {/* Per-substance tiles */}
      <div className="space-y-3 mb-6">
        {allSubstanceNames.map((name, i) => {
          const subLogs = logsBySubstance(name);
          const latest = subLogs[0];
          const days = latest ? daysSince(latest.date) : null;
          const badge = days !== null ? daysSinceLabel(days) : null;
          const isExpanded = expandedSubstance === name;

          return (
            <motion.div key={name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <div className="rounded-2xl bg-card border border-border/50 shadow-soft overflow-hidden">
                {/* Main tile */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-card-foreground truncate">{name}</h4>
                        {badge && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.text}
                          </span>
                        )}
                        {!latest && (
                          <span className="text-[10px] text-muted-foreground border border-border/40 px-2 py-0.5 rounded-full">No doses logged</span>
                        )}
                      </div>

                      {/* Days since — big counter */}
                      <div className="mt-2 flex items-end gap-3">
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Days since last dose</p>
                          <p className="text-3xl font-black font-display text-card-foreground leading-none mt-0.5">
                            {days !== null ? days : "—"}
                          </p>
                        </div>
                        {latest && (
                          <div className="pb-0.5">
                            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Last dose</p>
                            <p className="text-xs font-semibold text-card-foreground">{latest.dose} {latest.unit}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Calendar className="w-2.5 h-2.5" />
                              {format(parseISO(latest.date), "d MMM yyyy")} · {latest.time}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 items-end flex-shrink-0">
                      <Button
                        onClick={() => openLog(name)}
                        size="sm"
                        className="h-8 rounded-xl text-xs bg-violet-600 hover:bg-violet-700 text-white gap-1"
                      >
                        <Plus className="w-3 h-3" /> Log
                      </Button>
                      <button
                        onClick={() => setExpandedSubstance(isExpanded ? null : name)}
                        className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground px-1"
                      >
                        {subLogs.length} dose{subLogs.length !== 1 ? "s" : ""}
                        {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded dose history */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border/30 bg-muted/20 px-4 py-3 space-y-2">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Dose history</p>
                          <button
                            onClick={async () => { await removeSubstanceName(name); if (isExpanded) setExpandedSubstance(null); }}
                            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-3 h-3" /> Remove substance
                          </button>
                        </div>
                        {subLogs.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 text-center">No doses logged yet</p>
                        ) : (
                          subLogs.map((log) => (
                            <div key={log.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                              <div>
                                <p className="text-xs font-semibold text-card-foreground">{log.dose} {log.unit}</p>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-2.5 h-2.5" />
                                  {format(parseISO(log.date), "d MMM yyyy")} · {log.time}
                                </p>
                                {log.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">{log.notes}</p>}
                              </div>
                              <button onClick={() => deleteLog(log.id)} className="p-1.5 text-muted-foreground hover:text-destructive ml-2 flex-shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Reset TOTP */}
      <div className="mt-2 pt-4 border-t border-border/30">
        <button onClick={() => setResetOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
          <RefreshCw className="w-3 h-3" /> Reset authenticator
        </button>
      </div>

      {/* Weaning calendar */}
      <div className="mt-6">
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-violet-500" /> Weaning Calendar
          </h4>
          <button
            onClick={() => setWeaningOpen(true)}
            className="text-[11px] text-violet-600 hover:text-violet-800 flex items-center gap-1"
          >
            <Settings className="w-3 h-3" /> Edit schedule
          </button>
        </div>
        <WeaningCalendar
          logs={logs}
          weaningSchedule={weaningSchedule}
          calendarOverrides={calendarOverrides}
          onSetOverride={setCalendarOverride}
          allSubstanceNames={allSubstanceNames}
        />
      </div>

      {/* Weaning schedule settings */}
      <WeaningScheduleDialog
        open={weaningOpen}
        onClose={() => setWeaningOpen(false)}
        weaningSchedule={weaningSchedule}
        substanceNames={allSubstanceNames}
        onSave={saveWeaningSchedule}
      />

      {/* Add substance dialog */}
      <Dialog open={addSubstanceOpen} onOpenChange={setAddSubstanceOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><FlaskConical className="w-4 h-4 text-violet-600" /> Add Substance</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Substance name</Label>
              <Input
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && newSubName.trim() && addNewSubstance()}
                placeholder="e.g. Cannabis, MDMA, Psilocybin…"
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>
            <Button onClick={addNewSubstance} disabled={addingName || !newSubName.trim()} className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
              {addingName ? "Adding…" : "Add Substance"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log dose dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-violet-600" /> Log Dose</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Substance</Label>
              {allSubstanceNames.length > 0 ? (
                <Select value={logSubstance} onValueChange={setLogSubstance}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select substance" /></SelectTrigger>
                  <SelectContent>
                    {allSubstanceNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={logSubstance} onChange={(e) => setLogSubstance(e.target.value)} placeholder="e.g. Cannabis, MDMA…" className="h-11 rounded-xl" />
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Dose</Label>
                <Input value={dose} onChange={(e) => setDose(e.target.value)} placeholder="e.g. 3.5" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={unit} onValueChange={setUnit}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>{COMMON_UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Time of day</Label>
                <Select value={time} onValueChange={setTime}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Morning</SelectItem>
                    <SelectItem value="midday">Midday</SelectItem>
                    <SelectItem value="evening">Evening</SelectItem>
                    <SelectItem value="night">Night</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Setting, effects, etc." className="rounded-xl text-xs min-h-[60px]" />
            </div>
            <Button onClick={save} disabled={saving || !logSubstance.trim() || !dose.trim()} className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? "Saving…" : "Save Dose"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset confirm */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display text-destructive flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Reset Authenticator</DialogTitle></DialogHeader>
          <div className="pt-2 space-y-4">
            <p className="text-sm text-muted-foreground">This will delete your current TOTP secret and lock access to this tab until you set up a new authenticator. You will NOT lose your substance logs.</p>
            <Button onClick={async () => { await resetTotp(); setResetOpen(false); onLock(); }} variant="destructive" className="w-full h-11 rounded-xl">
              Yes, reset authenticator
            </Button>
            <Button variant="outline" onClick={() => setResetOpen(false)} className="w-full h-11 rounded-xl">Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Exported component ───────────────────────────────────────────────────────
export default function HealthSubstances() {
  const { loading } = useSubstances();

  if (loading) return <div className="py-20 text-center text-xs text-muted-foreground">Loading…</div>;

  return <SubstancesContent onLock={() => {}} />;
}

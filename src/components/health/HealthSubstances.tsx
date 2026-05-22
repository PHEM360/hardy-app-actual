import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, Lock, KeyRound, Plus, Trash2, QrCode,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSubstances, type SubstanceLog } from "@/hooks/useSubstances";
import { useAuth } from "@/auth/AuthContext";
import { format, parseISO } from "date-fns";

const COMMON_UNITS = ["mg", "g", "ml", "μg", "tablet", "capsule", "dose", "line", "joint", "other"];

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

  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(uri)}`;

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

          <div className="p-2 bg-white rounded-2xl border border-border/50 shadow-sm">
            <img src={qrUrl} alt="TOTP QR Code" width={180} height={180} className="rounded-xl" />
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

// ── Main substance log view ──────────────────────────────────────────────────
function SubstancesContent({ onLock }: { onLock: () => void }) {
  const { logs, loading, addLog, deleteLog, resetTotp } = useSubstances();
  const [logOpen, setLogOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);

  // Form
  const [name, setName]   = useState("");
  const [dose, setDose]   = useState("");
  const [unit, setUnit]   = useState("mg");
  const [date, setDate]   = useState(new Date().toISOString().split("T")[0]);
  const [time, setTime]   = useState(new Date().toTimeString().slice(0, 5));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !dose.trim()) return;
    setSaving(true);
    try {
      await addLog({ name: name.trim(), dose: dose.trim(), unit, date, time, notes: notes.trim() || undefined });
      setLogOpen(false);
      setName(""); setDose(""); setUnit("mg"); setDate(new Date().toISOString().split("T")[0]);
      setTime(new Date().toTimeString().slice(0, 5)); setNotes("");
    } finally { setSaving(false); }
  };

  const latest = logs[0];
  const displayLogs = showAll ? logs : logs.slice(0, 10);

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
          <button
            onClick={onLock}
            className="flex items-center gap-1 text-[11px] text-muted-foreground border border-border/50 px-2.5 py-1.5 rounded-lg hover:bg-muted"
          >
            <Lock className="w-3 h-3" /> Lock
          </button>
          <Button onClick={() => { setLogOpen(true); setDate(new Date().toISOString().split("T")[0]); setTime(new Date().toTimeString().slice(0, 5)); }}
            size="sm" className="rounded-xl text-xs bg-violet-600 hover:bg-violet-700 text-white h-8 gap-1">
            <Plus className="w-3.5 h-3.5" /> Log
          </Button>
        </div>
      </div>

      {/* Last taken card */}
      {latest && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-gradient-to-br from-violet-500/15 to-purple-500/10 border border-violet-200/40 mb-4">
          <p className="text-[11px] text-violet-600/70 uppercase tracking-wider font-semibold mb-1">Last taken</p>
          <p className="text-xl font-black font-display text-card-foreground">{latest.name}</p>
          <p className="text-sm font-semibold text-violet-700 mt-0.5">{latest.dose} {latest.unit}</p>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {format(parseISO(latest.date), "d MMMM yyyy")} at {latest.time}
          </div>
          {latest.notes && <p className="text-xs text-muted-foreground italic mt-1.5">{latest.notes}</p>}
        </motion.div>
      )}

      {/* History */}
      {logs.length === 0 && !loading && (
        <div className="py-12 text-center">
          <p className="text-sm font-semibold text-muted-foreground">No entries yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Tap Log to record a substance use</p>
        </div>
      )}

      {logs.length > 1 && (
        <div className="space-y-2 mb-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold px-1 mt-4 mb-2">History</p>
          {displayLogs.slice(1).map((log, i) => (
            <motion.div key={log.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/40">
              <div>
                <p className="text-xs font-bold text-card-foreground">{log.name} <span className="font-normal text-muted-foreground">· {log.dose} {log.unit}</span></p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{format(parseISO(log.date), "d MMM yyyy")} · {log.time}</p>
                {log.notes && <p className="text-[10px] text-muted-foreground italic">{log.notes}</p>}
              </div>
              <button onClick={() => deleteLog(log.id)} className="p-1.5 text-muted-foreground hover:text-destructive transition-colors ml-2 flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
          {logs.length > 11 && (
            <button onClick={() => setShowAll(!showAll)} className="flex items-center gap-1 text-xs text-primary font-medium mx-auto">
              {showAll ? <><ChevronUp className="w-3 h-3" />Show less</> : <><ChevronDown className="w-3 h-3" />Show all {logs.length} entries</>}
            </button>
          )}
        </div>
      )}

      {/* Reset TOTP */}
      <div className="mt-6 pt-4 border-t border-border/30">
        <button onClick={() => setResetOpen(true)} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
          <RefreshCw className="w-3 h-3" /> Reset authenticator
        </button>
      </div>

      {/* Log dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-violet-600" /> Log Substance</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Substance</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cannabis, MDMA, Psilocybin…" className="h-11 rounded-xl" />
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
                <Label>Time</Label>
                <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Setting, effects, etc." className="rounded-xl text-xs min-h-[60px]" />
            </div>
            <Button onClick={save} disabled={saving || !name.trim() || !dose.trim()} className="w-full h-11 rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
              {saving ? "Saving…" : "Save Entry"}
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
  const { user } = useAuth();
  const { isTotpConfigured, verifyTotp, loading } = useSubstances();

  const [state, setState] = useState<"locked" | "unlocked" | "setup">("locked");

  // Auto-show setup if not configured
  useEffect(() => {
    if (!loading && !isTotpConfigured) setState("setup");
  }, [loading, isTotpConfigured]);

  if (loading) return <div className="py-20 text-center text-xs text-muted-foreground">Loading…</div>;

  if (state === "setup" || !isTotpConfigured) {
    return (
      <TotpSetup
        email={user?.email ?? "user"}
        onComplete={() => setState("unlocked")}
      />
    );
  }

  if (state === "locked") {
    return (
      <TotpInput
        onVerify={(code) => {
          if (verifyTotp(code)) { setState("unlocked"); return true; }
          return false;
        }}
        onSetupRequest={() => setState("setup")}
      />
    );
  }

  return <SubstancesContent onLock={() => setState("locked")} />;
}

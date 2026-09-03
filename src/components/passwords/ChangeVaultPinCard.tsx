import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { KeyRound, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordVaultPin,
  type PasswordVaultConfig,
} from "@/lib/passwordVaultCrypto";

function PinField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        className="h-10 rounded-xl text-center text-lg tracking-[0.4em] font-bold"
      />
    </div>
  );
}

/** Change the Log Ins vault 4-digit passcode from Settings / profile. */
export function ChangeVaultPinCard() {
  const { dataUid } = useAuth();
  const [config, setConfig] = useState<PasswordVaultConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!dataUid) {
      setConfig(null);
      setLoading(false);
      return;
    }
    return onSnapshot(
      doc(db, "users", dataUid, "vault", "config"),
      (snap) => {
        setConfig(snap.exists() ? (snap.data() as PasswordVaultConfig) : null);
        setLoading(false);
      },
      () => {
        setConfig(null);
        setLoading(false);
      },
    );
  }, [dataUid]);

  const save = async () => {
    if (!dataUid || !config) return;
    if (newPin.length !== 4 || newPin !== confirmPin) {
      toast.error(newPin.length !== 4 ? "Choose exactly 4 digits" : "New passcodes do not match");
      return;
    }
    setSaving(true);
    try {
      const next = await changePasswordVaultPin(currentPin, newPin, config);
      await setDoc(
        doc(db, "users", dataUid, "vault", "config"),
        { ...next, updatedAt: serverTimestamp() },
        { merge: true },
      );
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
      toast.success("Log Ins passcode updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change passcode");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        Checking your Log Ins vault…
      </div>
    );
  }

  if (!config) {
    return (
      <div className="rounded-2xl border border-border/60 bg-muted/25 p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">Log Ins passcode</p>
        <p className="mt-1 text-xs">
          Open Log Ins once to create your vault and 4-digit passcode. You can change it here afterwards.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LockKeyhole className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Change Log Ins passcode</p>
          <p className="text-[11px] text-muted-foreground">
            This 4-digit code unlocks your encrypted logins. Face ID / fingerprint unlock (if enabled) stays the same.
          </p>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <PinField label="Current" value={currentPin} onChange={setCurrentPin} />
        <PinField label="New" value={newPin} onChange={setNewPin} />
        <PinField label="Confirm new" value={confirmPin} onChange={setConfirmPin} />
      </div>
      <Button
        className="w-full rounded-xl bg-gradient-primary text-primary-foreground border-0"
        disabled={saving || currentPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4}
        onClick={() => void save()}
      >
        <KeyRound className="mr-2 h-4 w-4" />
        {saving ? "Updating…" : "Update passcode"}
      </Button>
    </div>
  );
}

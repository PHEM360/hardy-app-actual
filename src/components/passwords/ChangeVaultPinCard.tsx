import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { Fingerprint, KeyRound, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  changePasswordVaultPin,
  clearVaultBiometrics,
  enableVaultBiometricsWithPin,
  passwordVaultBiometricsAvailable,
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

/** Log Ins vault passcode + device biometric controls on Settings. */
export function ChangeVaultPinCard() {
  const { user, dataUid } = useAuth();
  const [config, setConfig] = useState<PasswordVaultConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [bioPin, setBioPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [bioBusy, setBioBusy] = useState(false);
  const biometricsAvailable = passwordVaultBiometricsAvailable();
  const biometricsEnabled = !!config?.biometric;

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

  const saveConfig = async (next: PasswordVaultConfig) => {
    if (!dataUid) return;
    await setDoc(
      doc(db, "users", dataUid, "vault", "config"),
      { ...next, updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  const save = async () => {
    if (!dataUid || !config) return;
    if (newPin.length !== 4 || newPin !== confirmPin) {
      toast.error(newPin.length !== 4 ? "Choose exactly 4 digits" : "New passcodes do not match");
      return;
    }
    setSaving(true);
    try {
      const next = await changePasswordVaultPin(currentPin, newPin, config);
      await saveConfig(next);
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

  const enableBiometrics = async () => {
    if (!dataUid || !config) return;
    if (bioPin.length !== 4) {
      toast.error("Enter your current 4-digit passcode to enable device unlock");
      return;
    }
    setBioBusy(true);
    try {
      const next = await enableVaultBiometricsWithPin(
        bioPin,
        config,
        dataUid,
        user?.displayName || user?.email || "Hardy Hub",
      );
      await saveConfig(next);
      setBioPin("");
      toast.success("Device unlock enabled for this browser");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not enable device unlock");
    } finally {
      setBioBusy(false);
    }
  };

  const disableBiometrics = async () => {
    if (!config) return;
    if (!window.confirm("Turn off device biometric unlock? Your 4-digit passcode will still work.")) return;
    setBioBusy(true);
    try {
      await saveConfig(clearVaultBiometrics(config));
      toast.success("Device unlock turned off");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update vault settings");
    } finally {
      setBioBusy(false);
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
        <p className="font-semibold text-foreground">Log Ins vault</p>
        <p className="mt-1 text-xs">
          Open Log Ins once to create your vault and 4-digit passcode. You can change it and enable device unlock here afterwards.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LockKeyhole className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Change Log Ins passcode</p>
            <p className="text-[11px] text-muted-foreground">
              This 4-digit code unlocks your encrypted logins. Device biometric unlock (if enabled) stays the same.
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

      <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Fingerprint className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Device unlock</p>
            <p className="text-[11px] text-muted-foreground">
              Uses this device’s built-in unlock — Touch ID, Face ID, fingerprint, Windows Hello, or similar.
              {biometricsEnabled ? " Enabled on this vault." : " Not enabled yet."}
            </p>
          </div>
        </div>

        {!biometricsAvailable ? (
          <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            This browser cannot enrol device biometrics. Use the 4-digit passcode instead.
          </p>
        ) : biometricsEnabled ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              disabled={bioBusy || bioPin.length !== 4}
              onClick={() => void enableBiometrics()}
            >
              <Fingerprint className="mr-2 h-4 w-4" />
              {bioBusy ? "Updating…" : "Re-enable on this device"}
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-xl text-destructive hover:text-destructive"
              disabled={bioBusy}
              onClick={() => void disableBiometrics()}
            >
              Turn off device unlock
            </Button>
          </div>
        ) : (
          <Button
            className="w-full rounded-xl bg-gradient-primary text-primary-foreground border-0"
            disabled={bioBusy || bioPin.length !== 4}
            onClick={() => void enableBiometrics()}
          >
            <Fingerprint className="mr-2 h-4 w-4" />
            {bioBusy ? "Enabling…" : "Enable device unlock"}
          </Button>
        )}

        {biometricsAvailable && (
          <PinField
            label={biometricsEnabled ? "Passcode (to re-enable on this device)" : "Current passcode"}
            value={bioPin}
            onChange={setBioPin}
          />
        )}
      </div>
    </div>
  );
}

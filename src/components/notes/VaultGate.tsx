import { useState } from "react";
import { Fingerprint, KeyRound, Lock, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { assertPlatformPasskey, hashPin, registerPlatformPasskey, webauthnAvailable } from "@/lib/noteCrypto";
import type { NotesVaultSettings, VaultUnlockMethod } from "@/types/notes";
import { useAuth } from "@/auth/AuthContext";
import { toast } from "sonner";

interface VaultGateProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: NotesVaultSettings | null;
  onSaveSettings: (settings: NotesVaultSettings) => Promise<void>;
  onUnlocked: (pin?: string) => void;
  mode?: "unlock" | "setup";
}

export function VaultGate({
  open,
  onOpenChange,
  settings,
  onSaveSettings,
  onUnlocked,
  mode: modeProp,
}: VaultGateProps) {
  const { user, dataUid } = useAuth();
  const needsSetup = !settings?.method;
  const mode = modeProp ?? (needsSetup ? "setup" : "unlock");
  const [method, setMethod] = useState<VaultUnlockMethod>(settings?.method ?? "pin");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const setup = async () => {
    if (!dataUid) return;
    if ((method === "pin" || method === "both") && (pin.length < 4 || pin !== confirm)) {
      toast.error("Passcode must be at least 4 characters and match");
      return;
    }
    setBusy(true);
    try {
      const next: NotesVaultSettings = { method };
      if (method === "pin" || method === "both") {
        const hashed = await hashPin(pin);
        next.pinSalt = hashed.salt;
        next.pinHash = hashed.hash;
      }
      if (method === "webauthn" || method === "both") {
        if (!webauthnAvailable()) throw new Error("This device does not support Face ID / biometrics in the browser");
        next.webauthnCredentialId = await registerPlatformPasskey(
          dataUid,
          user?.displayName || user?.email || "Hardy Hub"
        );
      }
      await onSaveSettings(next);
      onUnlocked(method === "webauthn" ? undefined : pin);
      onOpenChange(false);
      toast.success("Secure notes are set up");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set up secure notes");
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    setBusy(true);
    try {
      if (!settings?.method) return;
      if (settings.method === "webauthn" || settings.method === "both") {
        if (!settings.webauthnCredentialId) throw new Error("Biometrics are not registered");
        const ok = await assertPlatformPasskey(settings.webauthnCredentialId);
        if (!ok) throw new Error("Biometric unlock cancelled");
      }
      if (settings.method === "pin" || settings.method === "both") {
        if (!settings.pinSalt || !settings.pinHash) throw new Error("No passcode is set");
        const { hash } = await hashPin(pin, settings.pinSalt);
        if (hash !== settings.pinHash) throw new Error("Incorrect passcode");
        onUnlocked(pin);
      } else {
        onUnlocked();
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unlock");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {mode === "setup" ? "Set up Secure Notes" : "Unlock Secure Notes"}
          </DialogTitle>
        </DialogHeader>

        {mode === "setup" ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Extra protection on top of your Hardy Hub sign-in. You choose Face ID / device biometrics, a passcode, or both.
            </p>
            <div className="grid gap-2">
              {([
                { id: "webauthn" as const, label: "Face ID / biometrics", icon: Fingerprint, sub: "Unlocks this device only" },
                { id: "pin" as const, label: "Passcode", icon: KeyRound, sub: "Also encrypts the note contents" },
                { id: "both" as const, label: "Both", icon: Lock, sub: "Biometrics, then passcode" },
              ]).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMethod(opt.id)}
                  className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-colors ${
                    method === opt.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <opt.icon className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">{opt.label}</span>
                    <span className="text-[11px] text-muted-foreground">{opt.sub}</span>
                  </span>
                </button>
              ))}
            </div>
            {(method === "pin" || method === "both") && (
              <div className="space-y-2">
                <Label>Passcode</Label>
                <Input type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value)} />
                <Label>Confirm</Label>
                <Input type="password" inputMode="numeric" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </div>
            )}
            <Button className="w-full" disabled={busy} onClick={setup}>
              {busy ? "Setting up…" : "Enable Secure Notes"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Secure notes stay hidden until you unlock them on this device.
            </p>
            {(settings?.method === "pin" || settings?.method === "both") && (
              <div className="space-y-2">
                <Label>Passcode</Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && unlock()}
                />
              </div>
            )}
            <Button className="w-full" disabled={busy} onClick={unlock}>
              {busy
                ? "Checking…"
                : settings?.method === "webauthn"
                  ? "Unlock with Face ID / biometrics"
                  : "Unlock"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

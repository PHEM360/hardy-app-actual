import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/auth/AuthContext";
import {
  createPasswordVault,
  enrollVaultBiometrics,
  passwordVaultBiometricsAvailable,
  unlockPasswordVaultWithBiometrics,
  unlockPasswordVaultWithPin,
  type PasswordVaultConfig,
  type VaultPublicKey,
} from "@/lib/passwordVaultCrypto";
import { toast } from "sonner";
import {
  clearPinThrottle,
  pinThrottleRemaining,
  readPinThrottle,
  recordFailedPin,
} from "@/lib/passwordVaultThrottle";

interface PasswordVaultGateProps {
  config: PasswordVaultConfig | null;
  loading: boolean;
  onSetup: (
    config: PasswordVaultConfig,
    publicProfile: VaultPublicKey,
    privateKey: JsonWebKey,
  ) => Promise<void>;
  onUnlock: (privateKey: JsonWebKey) => void;
}

type UnlockMode = "choose" | "passkey" | "pin";

function PinInput({
  value,
  onChange,
  label,
  autoFocus,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        autoFocus={autoFocus}
        disabled={disabled}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        maxLength={4}
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 4))}
        className="h-12 rounded-xl text-center text-xl tracking-[0.55em] font-bold"
        aria-label={label}
      />
    </div>
  );
}

function isUserCancelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /cancel|abort|not allowed|dismiss/i.test(message);
}

export default function PasswordVaultGate({
  config,
  loading,
  onSetup,
  onUnlock,
}: PasswordVaultGateProps) {
  const { user, dataUid } = useAuth();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [addBiometrics, setAddBiometrics] = useState(passwordVaultBiometricsAvailable());
  const [busy, setBusy] = useState<"pin" | "passkey" | "setup" | null>(null);
  const [blockedUntil, setBlockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState<UnlockMode>("choose");
  const blockedFor = Math.max(0, blockedUntil - now);
  const passkeyAvailable = !!config?.biometric && passwordVaultBiometricsAvailable();

  useEffect(() => {
    if (!dataUid) return;
    setBlockedUntil(readPinThrottle(dataUid).blockedUntil);
  }, [dataUid]);

  useEffect(() => {
    if (blockedFor <= 0) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [blockedFor]);

  useEffect(() => {
    // Fresh unlock screen each time the gate mounts — user chooses deliberately.
    setMode("choose");
    setPin("");
    setConfirmPin("");
    setBusy(null);
  }, [config?.pinSalt]);

  const setup = async () => {
    if (!dataUid || pin.length !== 4 || pin !== confirmPin) {
      toast.error(pin.length !== 4 ? "Choose exactly 4 digits" : "The passcodes do not match");
      return;
    }
    setBusy("setup");
    try {
      const created = await createPasswordVault(pin);
      if (addBiometrics) {
        created.config.biometric = await enrollVaultBiometrics(
          dataUid,
          user?.displayName || user?.email || "Hardy Hub",
          created.privateKey,
        );
      }
      await onSetup(created.config, created.publicProfile, created.privateKey);
      toast.success("Your password vault is ready");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not set up the vault");
    } finally {
      setBusy(null);
    }
  };

  const unlockWithPin = async () => {
    if (!config || !dataUid || pin.length !== 4 || busy) return;
    const remaining = pinThrottleRemaining(dataUid);
    if (remaining > 0) {
      setBlockedUntil(Date.now() + remaining);
      toast.error(`Too many attempts. Try again in ${Math.ceil(remaining / 1000)} seconds.`);
      return;
    }
    setBusy("pin");
    try {
      onUnlock(await unlockPasswordVaultWithPin(pin, config));
      clearPinThrottle(dataUid);
      setBlockedUntil(0);
      setPin("");
    } catch (error) {
      const throttle = recordFailedPin(dataUid);
      setBlockedUntil(throttle.blockedUntil);
      setNow(Date.now());
      toast.error(error instanceof Error ? error.message : "Could not unlock the vault");
    } finally {
      setBusy(null);
    }
  };

  const unlockWithPasskey = async () => {
    if (!config || busy) return;
    setBusy("passkey");
    try {
      onUnlock(await unlockPasswordVaultWithBiometrics(config));
    } catch (error) {
      if (!isUserCancelError(error)) {
        toast.error(error instanceof Error ? error.message : "Could not unlock with passkey");
      }
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-10 text-center shadow-card">
        <LockKeyhole className="mx-auto h-8 w-8 animate-pulse text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Checking your vault…</p>
      </div>
    );
  }

  const isSetup = !config;
  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-primary/20 bg-card shadow-card">
      <div className="bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--card)))] px-6 py-7 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-lg">
          {isSetup ? <ShieldCheck className="h-7 w-7" /> : <LockKeyhole className="h-7 w-7" />}
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">
          {isSetup ? "Create your private vault" : "Unlock Log Ins"}
        </h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          {isSetup
            ? "Your passwords are encrypted on this device before they are saved."
            : "Choose passkey or your 4-digit code — nothing runs until you pick one."}
        </p>
      </div>

      <div className="space-y-4 p-6">
        {isSetup ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <PinInput value={pin} onChange={setPin} label="Choose 4-digit passcode" autoFocus />
              <PinInput value={confirmPin} onChange={setConfirmPin} label="Confirm passcode" />
            </div>
            {passwordVaultBiometricsAvailable() && (
              <button
                type="button"
                onClick={() => setAddBiometrics((value) => !value)}
                className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                  addBiometrics ? "border-primary/40 bg-primary/10" : "border-border bg-muted/30"
                }`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-card text-primary shadow-sm">
                  <Fingerprint className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold">Also enable passkey unlock</span>
                  <span className="block text-xs text-muted-foreground">
                    Touch ID, Face ID, fingerprint, Windows Hello — whatever this device supports
                  </span>
                </span>
                <span className={`h-5 w-9 rounded-full p-0.5 ${addBiometrics ? "bg-primary" : "bg-muted-foreground/30"}`}>
                  <span className={`block h-4 w-4 rounded-full bg-white transition-transform ${addBiometrics ? "translate-x-4" : ""}`} />
                </span>
              </button>
            )}
            <Button
              className="h-11 w-full rounded-xl bg-gradient-primary"
              disabled={busy !== null || pin.length !== 4 || confirmPin.length !== 4}
              onClick={() => void setup()}
            >
              <ShieldCheck className="mr-2 h-4 w-4" />
              {busy === "setup" ? "Securing your vault…" : "Create secure vault"}
            </Button>
          </>
        ) : mode === "choose" ? (
          <>
            {passkeyAvailable ? (
              <Button
                className="h-12 w-full rounded-xl bg-gradient-primary"
                disabled={busy !== null}
                onClick={() => {
                  setMode("passkey");
                  void unlockWithPasskey();
                }}
              >
                <Fingerprint className="mr-2 h-5 w-5" />
                Unlock with passkey
              </Button>
            ) : (
              <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Passkey unlock isn’t set up on this device. Use your 4-digit code, or enable passkey in Settings.
              </p>
            )}
            <Button
              variant="outline"
              className="h-12 w-full rounded-xl"
              disabled={busy !== null}
              onClick={() => setMode("pin")}
            >
              <KeyRound className="mr-2 h-5 w-5" />
              Unlock with 4-digit code
            </Button>
          </>
        ) : mode === "passkey" ? (
          <>
            <Button
              className="h-12 w-full rounded-xl bg-gradient-primary"
              disabled={busy !== null}
              onClick={() => void unlockWithPasskey()}
            >
              <Fingerprint className="mr-2 h-5 w-5" />
              {busy === "passkey" ? "Waiting for passkey…" : "Try passkey again"}
            </Button>
            <Button variant="ghost" className="w-full rounded-xl" disabled={busy !== null} onClick={() => setMode("choose")}>
              Back to options
            </Button>
            <Button variant="outline" className="w-full rounded-xl" disabled={busy !== null} onClick={() => setMode("pin")}>
              Use 4-digit code instead
            </Button>
          </>
        ) : (
          <>
            <PinInput value={pin} onChange={setPin} label="4-digit passcode" autoFocus disabled={busy === "pin"} />
            <Button
              className="h-11 w-full rounded-xl bg-gradient-primary text-primary-foreground border-0"
              disabled={busy !== null || pin.length !== 4 || blockedFor > 0}
              onClick={() => void unlockWithPin()}
            >
              <KeyRound className="mr-2 h-4 w-4" />
              {busy === "pin"
                ? "Unlocking…"
                : blockedFor > 0
                  ? `Try again in ${Math.ceil(blockedFor / 1000)}s`
                  : "Unlock with passcode"}
            </Button>
            <Button variant="ghost" className="w-full rounded-xl" disabled={busy !== null} onClick={() => setMode("choose")}>
              Back to options
            </Button>
          </>
        )}
        <div className="flex items-start gap-2 rounded-xl bg-muted/50 px-3 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
          Passwords stay end-to-end encrypted — Hardy Hub cannot read them.
        </div>
      </div>
    </div>
  );
}

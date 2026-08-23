import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { EmailAuthProvider, reauthenticateWithCredential, signOut } from "firebase/auth";
import { Fingerprint, KeyRound, LockKeyhole, LogOut, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useSecuritySettings } from "@/hooks/useSecuritySettings";
import {
  authenticateWithPasskey,
  passkeyErrorMessage,
  passkeysSupported,
  registerPasskey,
} from "@/lib/passkeys";
import {
  appSessionRequiresAuthentication,
  hasFreshSecurityAuthentication,
  markOpenSessionSatisfied,
  markSecurityAuthentication,
} from "@/lib/securitySession";
import { moduleForPath, type SecurityRequirement } from "@/types/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DogLoader from "@/components/DogLoader";
import { toast } from "sonner";

function SecurityFrame({
  icon,
  title,
  description,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-gradient-hero px-4 py-8">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-card shadow-elevated">
        <div className="bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--card)))] px-6 py-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-lg">
            {icon}
          </span>
          <h1 className="mt-4 font-display text-xl font-bold">{title}</h1>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="space-y-4 p-6">{children}</div>
      </div>
    </div>
  );
}

function AuthenticationPrompt({
  requirement,
  title,
  description,
  onVerified,
  onCancel,
}: {
  requirement: SecurityRequirement | "either";
  title: string;
  description: string;
  onVerified: (method: "passkey" | "password") => void;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"passkey" | "password" | "local-setup" | null>(null);
  const [error, setError] = useState("");
  const [showPasskeyRecovery, setShowPasskeyRecovery] = useState(false);
  const showPasskey = requirement === "passkey" || requirement === "either";
  const showPassword = requirement === "password" || requirement === "either";
  const canRecoverPasskey = showPasskey && !showPassword;

  const verifyPasskey = async () => {
    setBusy("passkey");
    setError("");
    try {
      await authenticateWithPasskey(true);
      onVerified("passkey");
    } catch (caught) {
      setError(passkeyErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  const verifyPassword = async () => {
    if (!user?.email || !password) return;
    setBusy("password");
    setError("");
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      await user.getIdToken(true);
      markSecurityAuthentication(user.uid, "password");
      setPassword("");
      onVerified("password");
    } catch {
      setError("That password was not accepted.");
    } finally {
      setBusy(null);
    }
  };

  const recoverPasskeyForThisDevice = async () => {
    if (!user?.email || !password) return;
    setBusy("local-setup");
    setError("");
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
      await user.getIdToken(true);
      await registerPasskey(window.location.hostname === "localhost" ? "Local development passkey" : "This device");
      setPassword("");
      onVerified("passkey");
    } catch (caught) {
      setError(passkeyErrorMessage(caught));
    } finally {
      setBusy(null);
    }
  };

  return (
    <SecurityFrame icon={<LockKeyhole className="h-7 w-7" />} title={title} description={description}>
      {showPasskey && (
        <>
          <Button
            className="h-12 w-full rounded-xl bg-gradient-primary"
            disabled={busy !== null || !passkeysSupported()}
            onClick={() => void verifyPasskey()}
          >
            <Fingerprint className="mr-2 h-5 w-5" />
            {busy === "passkey" ? "Checking passkey…" : "Continue with passkey"}
          </Button>
          <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
            Touch ID or Face ID appears when this device has the matching passkey. A QR code lets you use a passkey stored on another device.
          </p>
        </>
      )}
      {canRecoverPasskey && !showPasskeyRecovery && (
        <Button type="button" variant="ghost" className="w-full rounded-xl text-xs text-muted-foreground" disabled={busy !== null} onClick={() => setShowPasskeyRecovery(true)}>
          Can’t find your passkey? Set up this device
        </Button>
      )}
      {canRecoverPasskey && showPasskeyRecovery && (
        <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
          <p className="text-xs font-semibold">Create a passkey for this device</p>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Confirm your account password. If your existing passkey belongs to an older Hardy Hub address, you can then create a replacement using Apple Passwords, Google Password Manager or this device.
          </p>
          <Input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && void recoverPasskeyForThisDevice()}
            placeholder="Account password"
            className="h-10 rounded-xl bg-card"
          />
          <Button type="button" variant="outline" className="h-10 w-full rounded-xl" disabled={busy !== null || !password} onClick={() => void recoverPasskeyForThisDevice()}>
            <KeyRound className="mr-2 h-4 w-4" />
            {busy === "local-setup" ? "Creating passkey…" : "Confirm password and create passkey"}
          </Button>
        </div>
      )}
      {showPassword && (
        <>
          {showPasskey && (
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />or<span className="h-px flex-1 bg-border" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="security-password">Password</Label>
            <Input
              id="security-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && void verifyPassword()}
              className="h-11 rounded-xl"
            />
          </div>
          <Button
            variant={showPasskey ? "outline" : "default"}
            className="h-11 w-full rounded-xl"
            disabled={busy !== null || !password}
            onClick={() => void verifyPassword()}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            {busy === "password" ? "Checking password…" : "Continue with password"}
          </Button>
        </>
      )}
      {error && <p className="rounded-xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{error}</p>}
      {onCancel && <Button variant="ghost" className="w-full rounded-xl" onClick={onCancel}>Go back</Button>}
    </SecurityFrame>
  );
}

export function MandatoryPasskeyGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings, passkeyEnrolled, loading } = useSecuritySettings();
  const [registering, setRegistering] = useState(false);
  const [sessionVerified, setSessionVerified] = useState(false);

  useEffect(() => setSessionVerified(false), [user?.uid, settings]);

  if (!user || loading) return <DogLoader text="Checking account security…" />;

  if (!passkeyEnrolled) {
    return (
      <SecurityFrame
        icon={<ShieldCheck className="h-7 w-7" />}
        title="Create your passkey"
        description="A passkey is now required for every Hardy Hub account. It uses Face ID, your fingerprint, device PIN, or a security key."
      >
        <Button
          className="h-12 w-full rounded-xl bg-gradient-primary"
          disabled={registering || !passkeysSupported()}
          onClick={() => {
            setRegistering(true);
            void registerPasskey().then(() => {
              markOpenSessionSatisfied(user.uid);
              toast.success("Passkey created");
            }).catch((error) => {
              toast.error(passkeyErrorMessage(error));
            }).finally(() => setRegistering(false));
          }}
        >
          <Fingerprint className="mr-2 h-5 w-5" />
          {registering ? "Creating passkey…" : "Create passkey"}
        </Button>
        {!passkeysSupported() && (
          <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            Open Hardy Hub in a current secure browser on a passkey-compatible device.
          </p>
        )}
        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          Passkeys are phishing-resistant. Your face and fingerprint never leave your device.
        </p>
        <Button variant="ghost" className="w-full rounded-xl text-muted-foreground" onClick={() => void signOut(auth)}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </Button>
      </SecurityFrame>
    );
  }

  const due = !sessionVerified && appSessionRequiresAuthentication(user.uid, settings);
  if (due) {
    const requirement = settings.appUnlockMethod === "either" ? "either" : settings.appUnlockMethod;
    return (
      <AuthenticationPrompt
        requirement={requirement}
        title="Confirm it’s you"
        description={
          settings.appUnlockMode === "every_open"
            ? "Your settings require verification whenever Hardy Hub is opened."
            : `Your ${settings.appUnlockIntervalDays}-day sign-in period has ended.`
        }
        onVerified={() => {
          markOpenSessionSatisfied(user.uid);
          setSessionVerified(true);
        }}
      />
    );
  }

  return <>{children}</>;
}

export function ModuleSecurityGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { settings, loading } = useSecuritySettings();
  const location = useLocation();
  const navigate = useNavigate();
  const moduleId = moduleForPath(location.pathname);
  const requirement = moduleId ? settings.moduleRequirements[moduleId] || "none" : "none";
  const verificationKey = `${moduleId || "none"}:${location.key}`;
  const [verifiedKey, setVerifiedKey] = useState("");
  const [tokenPasskeyAt, setTokenPasskeyAt] = useState(0);
  const [claimsChecked, setClaimsChecked] = useState(false);
  const verified = useMemo(() => verifiedKey === verificationKey, [verificationKey, verifiedKey]);
  const localPasskeyIsFresh = !!user && requirement === "passkey" &&
    hasFreshSecurityAuthentication(user.uid, "passkey", settings.appUnlockIntervalDays);
  const tokenPasskeyIsFresh = tokenPasskeyAt > Date.now() - settings.appUnlockIntervalDays * 24 * 60 * 60 * 1000;

  useEffect(() => {
    let active = true;
    if (!user || requirement !== "passkey") {
      setTokenPasskeyAt(0);
      setClaimsChecked(true);
      return () => { active = false; };
    }
    setClaimsChecked(false);
    void user.getIdTokenResult().then((result) => {
      if (!active) return;
      setTokenPasskeyAt(Number(result.claims.passkeyVerifiedAt || 0) * 1000);
      setClaimsChecked(true);
    }).catch(() => {
      if (!active) return;
      setTokenPasskeyAt(0);
      setClaimsChecked(true);
    });
    return () => { active = false; };
  }, [user, requirement, location.pathname]);

  if (!user || loading || requirement === "none" || verified || (localPasskeyIsFresh && tokenPasskeyIsFresh)) {
    return <>{children}</>;
  }
  if (requirement === "passkey" && localPasskeyIsFresh && !claimsChecked) {
    return <DogLoader text="Checking recent passkey…" />;
  }
  return (
    <AuthenticationPrompt
      requirement={requirement}
      title="Protected page"
      description={`Your security settings require ${requirement === "passkey" ? "a passkey" : "your password"} before opening this section.`}
      onVerified={() => setVerifiedKey(verificationKey)}
      onCancel={() => navigate(-1)}
    />
  );
}

/** Requires a passkey verified within the last five minutes for a sensitive action. */
export function PasskeyGate({
  children,
  title = "Confirm with your passkey",
  description = "Confirm it’s you before continuing.",
}: {
  children: ReactNode;
  title?: string;
  description?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;
    if (!user) {
      setChecking(false);
      return () => { active = false; };
    }
    void user.getIdTokenResult().then((result) => {
      if (!active) return;
      const verifiedAt = Number(result.claims.passkeyVerifiedAt || 0);
      setVerified(verifiedAt >= Date.now() / 1000 - 300);
      setChecking(false);
    }).catch(() => {
      if (active) setChecking(false);
    });
    return () => { active = false; };
  }, [user]);

  if (checking) return <DogLoader text="Checking recent passkey…" />;
  if (verified) return <>{children}</>;
  return (
    <AuthenticationPrompt
      requirement="passkey"
      title={title}
      description={description}
      onVerified={() => setVerified(true)}
      onCancel={() => navigate(-1)}
    />
  );
}

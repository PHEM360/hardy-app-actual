import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  markSecurityAuthenticationAt,
  passkeyClaimIsFresh,
  passkeyClaimVerifiedAt,
} from "@/lib/securitySession";
import { moduleForPath, type SecurityRequirement } from "@/types/security";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DogLoader from "@/components/DogLoader";
import { toast } from "sonner";

function localPasskeyNeedsDefaultPort() {
  const { hostname, port } = window.location;
  if (hostname !== "localhost" && hostname !== "127.0.0.1") return false;
  return port !== "8080" && port !== "5173";
}

function LocalPasskeyPortNotice() {
  if (!localPasskeyNeedsDefaultPort()) return null;
  return (
    <p className="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
      This local copy is on port {window.location.port || "80"}. Open{" "}
      <a className="font-semibold underline" href="http://localhost:8080/dashboard">http://localhost:8080</a>
      {" "}to confirm your passkey.
    </p>
  );
}

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

/**
 * Reads the passkey timestamp minted into the ID token when a passkey was last
 * presented. One verification therefore covers every gate for the whole period
 * the account owner chose, on any device signed into that session.
 */
function usePasskeyClaimFreshness(maxAgeDays: number, enabled: boolean) {
  const { user } = useAuth();
  const uid = user?.uid;
  const userRef = useRef(user);
  userRef.current = user;
  const [checking, setChecking] = useState(enabled);
  const [verifiedAtMs, setVerifiedAtMs] = useState(0);

  useEffect(() => {
    let active = true;
    if (!uid || !enabled) {
      setChecking(false);
      setVerifiedAtMs(0);
      return () => { active = false; };
    }
    setChecking(true);
    const read = async () => {
      const current = userRef.current;
      if (!current) return 0;
      const cached = await current.getIdTokenResult();
      if (passkeyClaimIsFresh(cached.claims, maxAgeDays)) return passkeyClaimVerifiedAt(cached.claims);
      // The claim may have been minted in another tab or on another gate, so
      // take one refreshed look before asking the person to authenticate again.
      const refreshed = await current.getIdTokenResult(true);
      return passkeyClaimIsFresh(refreshed.claims, maxAgeDays) ? passkeyClaimVerifiedAt(refreshed.claims) : 0;
    };
    read()
      .then((claimedAt) => {
        if (!active) return;
        // Remember when the passkey was actually shown so the next page opens
        // without another round trip to discover the period is still running.
        if (claimedAt > 0) markSecurityAuthenticationAt(uid, "passkey", claimedAt);
        setVerifiedAtMs(claimedAt);
        setChecking(false);
      })
      .catch(() => {
        if (!active) return;
        setVerifiedAtMs(0);
        setChecking(false);
      });
    return () => { active = false; };
  }, [uid, enabled, maxAgeDays]);

  return { checking, fresh: verifiedAtMs > 0 };
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
      <LocalPasskeyPortNotice />
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
  const sessionDue = !!user && !loading && passkeyEnrolled && !sessionVerified &&
    appSessionRequiresAuthentication(user.uid, settings);
  const { fresh: passkeyFresh, checking: checkingPasskey } = usePasskeyClaimFreshness(
    settings.appUnlockIntervalDays,
    sessionDue && settings.appUnlockMode !== "every_open",
  );

  useEffect(() => setSessionVerified(false), [user?.uid, settings]);

  if (!user || loading) return <DogLoader text="Checking account security…" />;

  if (!passkeyEnrolled) {
    return (
      <SecurityFrame
        icon={<ShieldCheck className="h-7 w-7" />}
        title="Create your passkey"
        description="A passkey is now required for every Hardy Hub account. It uses Face ID, your fingerprint, device PIN, or a security key."
      >
        <LocalPasskeyPortNotice />
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

  if (sessionDue && checkingPasskey) return <DogLoader text="Checking your recent passkey…" />;

  if (sessionDue && !passkeyFresh) {
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
  const verified = useMemo(() => verifiedKey === verificationKey, [verificationKey, verifiedKey]);
  const { fresh: passkeyFresh, checking } = usePasskeyClaimFreshness(
    settings.appUnlockIntervalDays,
    !!user && !loading && requirement === "passkey" && !verified,
  );
  const passwordIsFresh = !!user && requirement === "password" &&
    hasFreshSecurityAuthentication(user.uid, "password", settings.appUnlockIntervalDays);

  if (!user || loading || requirement === "none" || verified || passwordIsFresh) {
    return <>{children}</>;
  }
  if (requirement === "passkey") {
    if (checking) return <DogLoader text="Checking your recent passkey…" />;
    if (passkeyFresh) return <>{children}</>;
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

/**
 * Guards a sensitive action, such as approving a remote display, with the same
 * passkey period the account owner chose rather than a separate short window.
 */
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
  const { settings, loading } = useSecuritySettings();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);
  const { fresh, checking } = usePasskeyClaimFreshness(
    settings.appUnlockIntervalDays,
    !!user && !loading && !verified,
  );

  if (loading || checking) return <DogLoader text="Checking your recent passkey…" />;
  if (verified || fresh) return <>{children}</>;
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

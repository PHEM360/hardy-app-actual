import { useEffect, useRef, useState, useCallback } from "react";
import { signInWithCustomToken, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import { claimDevicePairing, createDevicePairing, getDevicePairingStatus } from "@/lib/devicePairingApi";

const DEVICE_ID_KEY = "hardyhub-display-device-id";
const POLL_INTERVAL_MS = 2500;

export type DeviceAuthStatus = "loading" | "signed_out" | "ready" | "revoked";
export type PairingPhase = "starting" | "waiting" | "claiming" | "denied" | "expired" | "error";

export interface PairingState {
  phase: PairingPhase;
  qrUrl: string | null;
  error: string | null;
}

/**
 * Owns the /display page's own sign-in lifecycle: either a QR code is scanned
 * and approved from a phone (custom-token sign-in, minted by Cloud Functions),
 * or the device signs in directly with email/password. Either way, once
 * signed in it stays signed in indefinitely via Firebase's local persistence.
 */
export function useDeviceAuth() {
  const { user, initializing } = useAuth();
  const { activeHouseholdId } = useActiveHousehold();
  const [deviceId, setDeviceId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(DEVICE_ID_KEY)
  );
  const [status, setStatus] = useState<DeviceAuthStatus>("loading");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [pairing, setPairing] = useState<PairingState>({ phase: "starting", qrUrl: null, error: null });
  const [restartNonce, setRestartNonce] = useState(0);
  const pairingIdRef = useRef<string | null>(null);
  const pairingGenerationRef = useRef(0);

  // Resolve / create the devices/{id} doc once we know the auth state.
  useEffect(() => {
    let cancelled = false;

    async function resolve() {
      if (initializing) return;
      if (!user) {
        setStatus("signed_out");
        return;
      }

      try {
        if (deviceId) {
          const snap = await getDoc(doc(db, "devices", deviceId));
          if (cancelled) return;
          const data = snap.exists() ? snap.data() : null;
          if (data && data.uid === user.uid && data.revoked !== true) {
            setStatus("ready");
            return;
          }
          if (data?.revoked === true) {
            window.localStorage.removeItem(DEVICE_ID_KEY);
            setDeviceId(null);
            setStatus("revoked");
            return;
          }
          window.localStorage.removeItem(DEVICE_ID_KEY);
        }
      } catch {
        // Transient read failure (e.g. a just-completed sign-in still
        // propagating) — fall through and let the retry below settle it
        // rather than getting stuck on a permanent loading state.
        if (cancelled) return;
      }

      // No stored device (or it was stale) — this is a direct email/password
      // sign-in on this device, so provision a device doc for it now.
      const ref = await addDoc(collection(db, "devices"), {
        uid: user.uid,
        householdId: activeHouseholdId ?? null,
        label: "New Display",
        deviceType: "display",
        pairedVia: "direct",
        revoked: false,
        createdAt: serverTimestamp(),
        lastSeenAt: serverTimestamp(),
        settings: {},
      });
      if (cancelled) return;
      window.localStorage.setItem(DEVICE_ID_KEY, ref.id);
      setDeviceId(ref.id);
      setStatus("ready");
    }

    resolve();
    return () => {
      cancelled = true;
    };
    // activeHouseholdId intentionally excluded — only read once, at provisioning time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializing, user, deviceId]);

  // QR pairing lifecycle — only runs while nobody's signed in on this device.
  useEffect(() => {
    if (status !== "signed_out") return;

    const generation = ++pairingGenerationRef.current;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function start() {
      setPairing({ phase: "starting", qrUrl: null, error: null });
      try {
        const { pairingId } = await createDevicePairing();
        if (generation !== pairingGenerationRef.current) return;
        pairingIdRef.current = pairingId;
        const qrUrl = `${window.location.origin}/pair/${pairingId}`;
        setPairing({ phase: "waiting", qrUrl, error: null });

        pollTimer = setInterval(async () => {
          if (generation !== pairingGenerationRef.current || !pairingIdRef.current) return;
          try {
            const pairingStatus = await getDevicePairingStatus(pairingIdRef.current);
            if (generation !== pairingGenerationRef.current) return;

            if (pairingStatus === "approved") {
              if (pollTimer) clearInterval(pollTimer);
              setPairing((p) => ({ ...p, phase: "claiming" }));
              try {
                const claimed = await claimDevicePairing(pairingIdRef.current);
                if (generation !== pairingGenerationRef.current) return;
                // Sign in FIRST — only once the SDK actually holds a valid session do we
                // flip deviceId, which triggers Firestore reads gated on request.auth.
                // Setting deviceId any earlier races the sign-in and permission-denies.
                await signInWithCustomToken(auth, claimed.customToken);
                if (generation !== pairingGenerationRef.current) return;
                window.localStorage.setItem(DEVICE_ID_KEY, claimed.deviceId);
                setDeviceId(claimed.deviceId);
              } catch {
                if (generation === pairingGenerationRef.current) {
                  setPairing((p) => ({ ...p, phase: "error", error: "Couldn't finish linking this display. Try scanning again." }));
                }
              }
            } else if (pairingStatus === "denied") {
              if (pollTimer) clearInterval(pollTimer);
              setPairing((p) => ({ ...p, phase: "denied" }));
            } else if (pairingStatus === "expired" || pairingStatus === "not_found") {
              if (pollTimer) clearInterval(pollTimer);
              setPairing((p) => ({ ...p, phase: "expired" }));
            }
          } catch {
            // Transient network hiccup while polling — try again next tick.
          }
        }, POLL_INTERVAL_MS);
      } catch {
        if (generation === pairingGenerationRef.current) {
          setPairing({ phase: "error", qrUrl: null, error: "Couldn't generate a pairing code. Check your connection and try again." });
        }
      }
    }

    start();
    return () => {
      pairingGenerationRef.current += 1; // invalidate this run
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [status, restartNonce]);

  const restartPairing = useCallback(() => {
    setRestartNonce((n) => n + 1);
  }, []);

  // Heartbeat so "Linked Displays" can show roughly-online status later.
  useEffect(() => {
    if (status !== "ready" || !deviceId) return;
    const tick = () =>
      updateDoc(doc(db, "devices", deviceId), { lastSeenAt: serverTimestamp() }).catch(() => {});
    tick();
    const interval = setInterval(tick, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [status, deviceId]);

  const signInDirect = useCallback(async (email: string, password: string) => {
    setSignInError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      const code = String((err as { code?: string } | undefined)?.code || "");
      let message = "Sign-in failed. Please check your details and try again.";
      if (code.includes("invalid-email")) message = "That email address doesn't look right.";
      else if (code.includes("invalid-credential") || code.includes("wrong-password")) message = "Incorrect email or password.";
      else if (code.includes("user-not-found")) message = "No account found for that email.";
      else if (code.includes("too-many-requests")) message = "Too many attempts. Please wait a moment and try again.";
      setSignInError(message);
      throw err;
    }
  }, []);

  const forgetThisDevice = useCallback(async () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(DEVICE_ID_KEY);
    setDeviceId(null);
    await signOut(auth);
    setStatus("signed_out");
  }, []);

  return { status, deviceId, signInError, signInDirect, forgetThisDevice, pairing, restartPairing };
}

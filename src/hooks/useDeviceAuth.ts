import { useEffect, useRef, useState, useCallback } from "react";
import { getIdTokenResult, signInWithCustomToken, signOut } from "firebase/auth";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
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
 * Owns the /display page's QR-only sign-in lifecycle. A display session is
 * accepted only when its Firebase token carries the server-minted deviceId
 * claim that identifies the revocable devices/{id} record.
 */
export function useDeviceAuth() {
  const { user, initializing } = useAuth();
  const [deviceId, setDeviceId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : window.localStorage.getItem(DEVICE_ID_KEY)
  );
  const [status, setStatus] = useState<DeviceAuthStatus>("loading");
  const [pairing, setPairing] = useState<PairingState>({ phase: "starting", qrUrl: null, error: null });
  const [restartNonce, setRestartNonce] = useState(0);
  const [validationNonce, setValidationNonce] = useState(0);
  const pairingIdRef = useRef<string | null>(null);
  const claimSecretRef = useRef<string | null>(null);
  const pairingGenerationRef = useRef(0);

  // Resolve only server-minted display sessions. A normal account session
  // visiting /display is signed out instead of being promoted into a device.
  useEffect(() => {
    let cancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    async function resolve() {
      if (initializing) return;
      if (!user) {
        setStatus("signed_out");
        return;
      }

      try {
        const token = await getIdTokenResult(user);
        const claimedDeviceId = typeof token.claims.deviceId === "string" ? token.claims.deviceId : null;

        if (!claimedDeviceId) {
          window.localStorage.removeItem(DEVICE_ID_KEY);
          setDeviceId(null);
          await signOut(auth);
          if (!cancelled) setStatus("signed_out");
          return;
        }

        const snap = await getDoc(doc(db, "devices", claimedDeviceId));
        if (cancelled) return;
        const data = snap.exists() ? snap.data() : null;
        if (!data || data.uid !== user.uid || data.revoked === true) {
          window.localStorage.removeItem(DEVICE_ID_KEY);
          setDeviceId(null);
          await signOut(auth);
          if (!cancelled) setStatus("signed_out");
          return;
        }

        window.localStorage.setItem(DEVICE_ID_KEY, claimedDeviceId);
        if (deviceId !== claimedDeviceId) setDeviceId(claimedDeviceId);
        setStatus("ready");
      } catch (error) {
        if (cancelled) return;
        // Revoked device tokens are denied by Firestore before their device
        // document can be read. Clear that session and offer a fresh QR,
        // while retrying ordinary network failures without disconnecting.
        const code = String((error as { code?: unknown })?.code || "");
        if (code.includes("permission-denied") || code.includes("unauthenticated")) {
          window.localStorage.removeItem(DEVICE_ID_KEY);
          setDeviceId(null);
          await signOut(auth).catch(() => {});
          if (!cancelled) setStatus("signed_out");
        } else {
          setStatus("loading");
          retryTimer = setTimeout(() => setValidationNonce((value) => value + 1), POLL_INTERVAL_MS);
        }
      }
    }

    resolve();
    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [initializing, user, deviceId, validationNonce]);

  // QR pairing lifecycle — only runs while nobody's signed in on this device.
  useEffect(() => {
    if (status !== "signed_out") return;

    const generation = ++pairingGenerationRef.current;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function start() {
      setPairing({ phase: "starting", qrUrl: null, error: null });
      try {
        const { pairingId, claimSecret } = await createDevicePairing();
        if (generation !== pairingGenerationRef.current) return;
        pairingIdRef.current = pairingId;
        claimSecretRef.current = claimSecret;
        const qrUrl = `${window.location.origin}/pair/${pairingId}`;
        setPairing({ phase: "waiting", qrUrl, error: null });

        pollTimer = setInterval(async () => {
          if (generation !== pairingGenerationRef.current || !pairingIdRef.current || !claimSecretRef.current) return;
          try {
            const pairingStatus = await getDevicePairingStatus(pairingIdRef.current);
            if (generation !== pairingGenerationRef.current) return;

            if (pairingStatus === "approved") {
              if (pollTimer) clearInterval(pollTimer);
              setPairing((p) => ({ ...p, phase: "claiming" }));
              try {
                const claimed = await claimDevicePairing(pairingIdRef.current, claimSecretRef.current!);
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
      pairingIdRef.current = null;
      claimSecretRef.current = null;
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

  const forgetThisDevice = useCallback(async () => {
    if (typeof window !== "undefined") window.localStorage.removeItem(DEVICE_ID_KEY);
    setDeviceId(null);
    await signOut(auth);
    setStatus("signed_out");
  }, []);

  return { status, deviceId, forgetThisDevice, pairing, restartPairing };
}

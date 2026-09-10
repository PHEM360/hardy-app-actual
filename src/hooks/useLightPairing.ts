import { useCallback, useRef, useState } from "react";
import { createLightPairing, getLightPairingStatus, type CreatedLightPairing } from "@/lib/lightPairingApi";
import { getWledInfo, provisionWledDevice } from "@/lib/wledLocalApi";

const POLL_INTERVAL_MS = 2500;

export type LightPairingPhase =
  | "idle"
  | "starting"
  | "ready_to_join"
  | "configuring"
  | "waiting"
  | "claimed"
  | "expired"
  | "error";

export interface LightPairingState {
  phase: LightPairingPhase;
  error: string | null;
  deviceId: string | null;
}

/**
 * Orchestrates adding a sunrise light: unlike /display pairing there's no
 * separate "approve from your phone" step — this same signed-in browser
 * stays in the loop the whole time, briefly joining the light's own setup
 * WiFi network to hand it home-WiFi + MQTT details directly, then polling
 * until the light shows up on the broker (see functions/src/lightPairing.ts
 * and functions/src/sunriseLights.ts's tickSunriseLights).
 */
export function useLightPairing() {
  const [state, setState] = useState<LightPairingState>({ phase: "idle", error: null, deviceId: null });
  const pairingRef = useRef<CreatedLightPairing | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationRef = useRef(0);

  const stopPolling = () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    pollTimerRef.current = null;
  };

  const reset = useCallback(() => {
    generationRef.current += 1;
    stopPolling();
    pairingRef.current = null;
    setState({ phase: "idle", error: null, deviceId: null });
  }, []);

  const start = useCallback(async () => {
    const generation = ++generationRef.current;
    setState({ phase: "starting", error: null, deviceId: null });
    try {
      const pairing = await createLightPairing();
      if (generation !== generationRef.current) return;
      pairingRef.current = pairing;
      setState({ phase: "ready_to_join", error: null, deviceId: null });
    } catch {
      if (generation === generationRef.current) {
        setState({ phase: "error", error: "Couldn't start pairing. Check your connection and try again.", deviceId: null });
      }
    }
  }, []);

  const startPolling = useCallback((generation: number, pairingId: string) => {
    stopPolling();
    pollTimerRef.current = setInterval(async () => {
      if (generation !== generationRef.current) return;
      try {
        const result = await getLightPairingStatus(pairingId);
        if (generation !== generationRef.current) return;
        if (result.status === "claimed") {
          stopPolling();
          setState({ phase: "claimed", error: null, deviceId: result.deviceId || null });
        } else if (result.status === "expired" || result.status === "not_found") {
          stopPolling();
          setState({ phase: "expired", error: null, deviceId: null });
        }
      } catch {
        // Transient network hiccup while polling — try again next tick.
      }
    }, POLL_INTERVAL_MS);
  }, []);

  /** Call once the browser has joined the light's own setup WiFi network. */
  const configure = useCallback(async (homeSsid: string, homePassword: string) => {
    const generation = generationRef.current;
    const pairing = pairingRef.current;
    if (!pairing) return;
    setState({ phase: "configuring", error: null, deviceId: null });
    try {
      await getWledInfo();
      if (generation !== generationRef.current) return;
      await provisionWledDevice({
        homeSsid,
        homePassword,
        mqttBrokerUrl: pairing.mqttBrokerUrl,
        mqttUsername: pairing.mqttUsername,
        mqttPassword: pairing.mqttPassword,
        mqttTopic: pairing.mqttTopic,
        deviceId: pairing.deviceId,
      });
      if (generation !== generationRef.current) return;
      setState({ phase: "waiting", error: null, deviceId: null });
      startPolling(generation, pairing.pairingId);
    } catch (error) {
      if (generation === generationRef.current) {
        setState({
          phase: "error",
          error: error instanceof Error ? error.message : "Couldn't set up the light. Make sure you're still joined to its WiFi network.",
          deviceId: null,
        });
      }
    }
  }, [startPolling]);

  return { state, start, configure, reset };
}

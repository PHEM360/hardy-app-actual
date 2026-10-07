import { useCallback, useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, query, where, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import type { Alarm, AlarmLightCue } from "@/hooks/useDeviceSettings";

interface DisplayAlarms {
  id: string;
  label: string;
  alarms: Alarm[];
}

function asAlarm(value: unknown): Alarm | null {
  if (!value || typeof value !== "object") return null;
  const alarm = value as Alarm;
  if (!alarm.id || !alarm.time) return null;
  return {
    ...alarm,
    days: Array.isArray(alarm.days) ? alarm.days : [],
    label: alarm.label || "",
    enabled: alarm.enabled !== false,
    lightCues: Array.isArray(alarm.lightCues) ? alarm.lightCues : [],
  };
}

/** One alarm list for the household, stored on every linked display so they all ring together. */
export function useHouseholdAlarms() {
  const { user } = useAuth();
  const [displays, setDisplays] = useState<DisplayAlarms[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setDisplays([]);
      setLoading(false);
      return;
    }
    const q = query(collection(db, "devices"), where("uid", "==", user.uid));
    return onSnapshot(q, (snap) => {
      setDisplays(
        snap.docs
          .filter((item) => item.data().deviceType !== "light" && item.data().revoked !== true)
          .map((item) => ({
            id: item.id,
            label: String(item.data().label || "Display"),
            alarms: (Array.isArray(item.data().settings?.alarms) ? item.data().settings.alarms : [])
              .map(asAlarm)
              .filter((alarm): alarm is Alarm => !!alarm),
          })),
      );
      setLoading(false);
    }, () => {
      setDisplays([]);
      setLoading(false);
    });
  }, [user]);

  const alarms = useMemo(() => {
    const byId = new Map<string, Alarm>();
    for (const display of displays) {
      for (const alarm of display.alarms) {
        if (!byId.has(alarm.id)) byId.set(alarm.id, alarm);
      }
    }
    return [...byId.values()].sort((a, b) => a.time.localeCompare(b.time));
  }, [displays]);

  const save = useCallback(async (next: Alarm[]) => {
    if (displays.length === 0) throw new Error("Link a screen before saving an alarm.");
    const prepared = next.map((alarm) => {
      const cues = alarm.lightCues || [];
      const lead = cues.reduce((max, cue) => Math.max(max, cue.leadMinutes || 0), 0);
      return {
        ...alarm,
        linkedLightIds: cues.map((cue) => cue.lightId),
        sunriseMinutes: lead,
      };
    });
    const batch = writeBatch(db);
    for (const display of displays) {
      batch.update(doc(db, "devices", display.id), { "settings.alarms": prepared });
    }
    await batch.commit();
  }, [displays]);

  const addAlarm = useCallback(async (alarm: Omit<Alarm, "id">) => {
    const next: Alarm = { ...alarm, id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` };
    await save([...alarms, next]);
  }, [alarms, save]);

  const updateAlarm = useCallback(async (id: string, patch: Partial<Alarm>) => {
    await save(alarms.map((alarm) => (alarm.id === id ? { ...alarm, ...patch } : alarm)));
  }, [alarms, save]);

  const deleteAlarm = useCallback(async (id: string) => {
    await save(alarms.filter((alarm) => alarm.id !== id));
  }, [alarms, save]);

  return { alarms, displays, loading, addAlarm, updateAlarm, deleteAlarm };
}

export function emptyLightCue(lightId: string): AlarmLightCue {
  return {
    lightId,
    startBrightness: 18,
    leadMinutes: 20,
    peakBrightness: 200,
    rampMinutes: 20,
    offMode: "after",
    offAfterMinutes: 10,
    offAt: "07:30",
  };
}

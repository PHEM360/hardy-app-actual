import { useCallback, useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export interface HouseholdCalendarEvent {
  id: string;
  title: string;
  description?: string;
  location?: string;
  category: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  ownerUid: string;
  ownerName: string;
  ownerColor: string;
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Aggregated read-only calendar across every member of a household, via the
 * getHouseholdCalendarEvents Cloud Function (calendar sharing today is
 * per-owner pageShares, not household membership — see that function for why
 * this can't just be assembled from client-side Firestore reads).
 */
export function useHouseholdCalendar(householdId: string | null) {
  const [events, setEvents] = useState<HouseholdCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!householdId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    try {
      const fn = httpsCallable<{ householdId: string }, { events: HouseholdCalendarEvent[] }>(
        functions,
        "getHouseholdCalendarEvents"
      );
      const res = await fn({ householdId });
      setEvents(res.data.events);
      setError(null);
    } catch (err) {
      setError((err as { message?: string })?.message || "Couldn't load the household calendar.");
    } finally {
      setLoading(false);
    }
  }, [householdId]);

  useEffect(() => {
    setLoading(true);
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { events, loading, error, refresh };
}

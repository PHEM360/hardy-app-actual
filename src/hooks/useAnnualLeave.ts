import { useEffect, useState, useCallback } from "react";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { differenceInCalendarDays, eachDayOfInterval, isWeekend, parseISO } from "date-fns";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import type { AnnualLeaveEntry, AnnualLeavePeriod, AnnualLeavePool, CalendarEvent } from "@/types/app";

export function weekdayCount(startDate: string, endDate: string): number {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (end < start) return 0;
  return eachDayOfInterval({ start, end }).filter((d) => !isWeekend(d)).length;
}

function fractionOfYear(period: Pick<AnnualLeavePeriod, "startDate" | "endDate">): number {
  const days = differenceInCalendarDays(parseISO(period.endDate), parseISO(period.startDate)) + 1;
  return Math.max(days, 0) / 365.25;
}

export interface EntitlementBreakdown {
  annualBase: number;
  annualTotal: number;
  bankHolidayTotal: number;
  annualUsed: number;
  annualPending: number;
  annualRemaining: number;
  bankHolidayUsed: number;
  bankHolidayPending: number;
  bankHolidayRemaining: number;
}

export function calculateEntitlement(
  period: AnnualLeavePeriod,
  entries: AnnualLeaveEntry[]
): EntitlementBreakdown {
  const frac = fractionOfYear(period);
  const annualBase = period.baseDaysOverride ?? (period.yearsOfService === "5plus" ? 32 : 27);
  const annualTotal =
    annualBase * frac * (period.ltftPercentage / 100) + period.carriedForwardDays + period.daysInLieu;
  const bankHolidayTotal = period.includeBankHolidays
    ? period.bankHolidayDaysPerYear * frac * (period.ltftPercentage / 100)
    : 0;

  const sumFor = (pool: AnnualLeavePool, statuses: AnnualLeaveEntry["status"][]) =>
    entries
      .filter((e) => e.periodId === period.id && e.pool === pool && statuses.includes(e.status))
      .reduce((sum, e) => sum + e.days, 0);

  const annualUsed = sumFor("annual", ["approved", "taken"]);
  const annualPending = sumFor("annual", ["requested"]);
  const bankHolidayUsed = sumFor("bank_holiday", ["approved", "taken"]);
  const bankHolidayPending = sumFor("bank_holiday", ["requested"]);

  return {
    annualBase,
    annualTotal,
    bankHolidayTotal,
    annualUsed,
    annualPending,
    annualRemaining: annualTotal - annualUsed,
    bankHolidayUsed,
    bankHolidayPending,
    bankHolidayRemaining: bankHolidayTotal - bankHolidayUsed,
  };
}

function stripUndefined<T extends object>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function leaveEventTitle(status: AnnualLeaveEntry["status"], pool: AnnualLeavePool) {
  const poolLabel = pool === "bank_holiday" ? "Bank Holiday" : "Annual Leave";
  const statusLabel = status === "requested" ? "Requested" : status === "approved" ? "Approved" : "Taken";
  return `${poolLabel} (${statusLabel})`;
}

const CALENDAR_VISIBLE_STATUSES: AnnualLeaveEntry["status"][] = ["requested", "approved", "taken"];

export function useAnnualLeave() {
  const { dataUid: uid } = useAuth();
  const [periods, setPeriods] = useState<AnnualLeavePeriod[]>([]);
  const [entries, setEntries] = useState<AnnualLeaveEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) {
      setPeriods([]);
      setEntries([]);
      setLoading(false);
      return;
    }

    setError(null);
    let periodsLoaded = false;
    let entriesLoaded = false;
    const checkDone = () => {
      if (periodsLoaded && entriesLoaded) setLoading(false);
    };
    const onError = (err: unknown) => {
      console.error("Annual leave subscription failed", err);
      setError(err instanceof Error ? err.message : "Failed to load annual leave data.");
      setLoading(false);
    };

    const unsubPeriods = onSnapshot(
      query(collection(db, "annualLeave", uid, "periods"), orderBy("startDate", "desc")),
      (snap) => {
        setPeriods(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AnnualLeavePeriod) })));
        periodsLoaded = true;
        checkDone();
      },
      onError
    );

    const unsubEntries = onSnapshot(
      query(collection(db, "annualLeave", uid, "entries"), orderBy("startDate", "desc")),
      (snap) => {
        setEntries(snap.docs.map((d) => ({ id: d.id, ...(d.data() as AnnualLeaveEntry) })));
        entriesLoaded = true;
        checkDone();
      },
      onError
    );

    return () => {
      unsubPeriods();
      unsubEntries();
    };
  }, [uid]);

  const startNewPeriod = useCallback(
    async (data: Omit<AnnualLeavePeriod, "id" | "isActive" | "createdAt" | "updatedAt">) => {
      if (!uid) return;
      const batch = writeBatch(db);
      const currentActive = periods.find((p) => p.isActive);
      if (currentActive?.id) {
        batch.update(doc(db, "annualLeave", uid, "periods", currentActive.id), {
          isActive: false,
          updatedAt: serverTimestamp(),
        });
      }
      const newRef = doc(collection(db, "annualLeave", uid, "periods"));
      batch.set(newRef, {
        ...stripUndefined(data),
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    },
    [uid, periods]
  );

  const updatePeriod = useCallback(
    async (id: string, data: Partial<AnnualLeavePeriod>) => {
      if (!uid) return;
      await updateDoc(doc(db, "annualLeave", uid, "periods", id), {
        ...stripUndefined(data),
        updatedAt: serverTimestamp(),
      });
    },
    [uid]
  );

  const syncCalendarEvent = useCallback(
    async (entry: AnnualLeaveEntry): Promise<string | undefined> => {
      if (!uid) return entry.calendarEventId;
      const shouldShow = CALENDAR_VISIBLE_STATUSES.includes(entry.status);

      if (!shouldShow) {
        if (entry.calendarEventId) {
          await deleteDoc(doc(db, "calendar", uid, "events", entry.calendarEventId)).catch(() => {});
        }
        return undefined;
      }

      const eventPayload: Omit<CalendarEvent, "id"> = {
        title: leaveEventTitle(entry.status, entry.pool),
        description: entry.notes ?? null,
        category: "work",
        startDate: entry.startDate,
        endDate: entry.endDate,
        allDay: true,
        createdBy: uid,
        updatedAt: serverTimestamp(),
      } as Omit<CalendarEvent, "id">;

      if (entry.calendarEventId) {
        await updateDoc(doc(db, "calendar", uid, "events", entry.calendarEventId), eventPayload);
        return entry.calendarEventId;
      }

      const ref = await addDoc(collection(db, "calendar", uid, "events"), {
        ...eventPayload,
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    [uid]
  );

  const addEntry = useCallback(
    async (data: Omit<AnnualLeaveEntry, "id" | "calendarEventId" | "createdAt" | "updatedAt">) => {
      if (!uid) return;
      const calendarEventId = await syncCalendarEvent({ ...data, id: undefined } as AnnualLeaveEntry);
      await addDoc(collection(db, "annualLeave", uid, "entries"), {
        ...stripUndefined(data),
        calendarEventId: calendarEventId ?? null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    },
    [uid, syncCalendarEvent]
  );

  const updateEntry = useCallback(
    async (id: string, data: Partial<AnnualLeaveEntry>, existing: AnnualLeaveEntry) => {
      if (!uid) return;
      const merged: AnnualLeaveEntry = { ...existing, ...data, id };
      const calendarEventId = await syncCalendarEvent(merged);
      await updateDoc(doc(db, "annualLeave", uid, "entries", id), {
        ...stripUndefined(data),
        calendarEventId: calendarEventId ?? null,
        updatedAt: serverTimestamp(),
      });
    },
    [uid, syncCalendarEvent]
  );

  const deleteEntry = useCallback(
    async (entry: AnnualLeaveEntry) => {
      if (!uid || !entry.id) return;
      if (entry.calendarEventId) {
        await deleteDoc(doc(db, "calendar", uid, "events", entry.calendarEventId)).catch(() => {});
      }
      await deleteDoc(doc(db, "annualLeave", uid, "entries", entry.id));
    },
    [uid]
  );

  const activePeriod = periods.find((p) => p.isActive) ?? null;

  return {
    periods,
    entries,
    loading,
    error,
    activePeriod,
    startNewPeriod,
    updatePeriod,
    addEntry,
    updateEntry,
    deleteEntry,
  };
}

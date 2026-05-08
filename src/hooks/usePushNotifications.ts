import { useEffect, useRef, useState } from "react";
import { HouseholdItem, HouseholdReminder } from "@/types/app";
import type { Pet } from "@/hooks/usePets";

// ─── helpers ──────────────────────────────────────────────────────────────────

function calcNotifyAt(endDate: string, r: HouseholdReminder): Date {
  const end = new Date(endDate);
  const msPerUnit: Record<HouseholdReminder["unit"], number> = {
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000,
    months: 30 * 24 * 60 * 60 * 1000,
  };
  return new Date(end.getTime() - r.amount * msPerUnit[r.unit]);
}

function showNotification(title: string, body: string) {
  if (Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    icon: "/favicon.ico",
  });
}

// ─── hook ─────────────────────────────────────────────────────────────────────

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isSupported = typeof Notification !== "undefined";

  const requestPermission = async () => {
    if (!isSupported) return "denied" as NotificationPermission;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  };

  /** Cancel all scheduled in-session reminders (e.g. on logout) */
  const clearReminders = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  /**
   * Schedule a browser notification for a single item.
   * Fires when the app is open; otherwise silently skipped.
   */
  const scheduleReminder = (item: HouseholdItem) => {
    if (!item.pushEnabled || !item.reminders?.length || !item.endDate) return;

    for (const r of item.reminders) {
      const notifyAt = calcNotifyAt(item.endDate, r);
      const delay = notifyAt.getTime() - Date.now();
      if (delay <= 0) continue; // already past

      const id = setTimeout(() => {
        showNotification(
          `Reminder: ${item.type}`,
          `Your ${item.type} (${item.provider}) renews in ${r.amount} ${r.unit}.`
        );
      }, delay);
      timers.current.push(id);
    }
  };

  /** Schedule in-session notifications for pet flea/wormer treatments. */
  const schedulePetReminders = (pets: Pet[]) => {
    for (const pet of pets) {
      for (const treatmentType of ["flea", "worming"] as const) {
        const notifications =
          treatmentType === "flea" ? pet.fleaNotifications : pet.wormNotifications;
        if (!notifications?.length) continue;

        const latestRecord = [...pet.treatmentHistory]
          .filter((t) => t.type === treatmentType)
          .sort((a, b) => b.dateDue.localeCompare(a.dateDue))[0];
        if (!latestRecord?.dateDue) continue;

        const dueDate = new Date(latestRecord.dateDue);

        for (const n of notifications) {
          const notifyAt = new Date(
            dueDate.getTime() - n.daysBeforeDue * 24 * 60 * 60 * 1000
          );
          const delay = notifyAt.getTime() - Date.now();
          if (delay <= 0) continue;

          const id = setTimeout(() => {
            showNotification(
              `${pet.name} — ${treatmentType === "flea" ? "Flea treatment" : "Wormer"} due soon`,
              `${treatmentType === "flea" ? "Flea treatment" : "Wormer"} for ${pet.name} is due in ${n.daysBeforeDue} day${n.daysBeforeDue !== 1 ? "s" : ""} (${latestRecord.dateDue}).`
            );
          }, delay);
          timers.current.push(id);
        }
      }
    }
  };

  /** Call on mount with all household items to re-schedule any pending reminders. */
  const checkAndScheduleAll = (items: HouseholdItem[]) => {
    clearReminders();
    items.forEach(scheduleReminder);
  };

  // Clean up on unmount
  useEffect(() => () => clearReminders(), []);

  return {
    isSupported,
    permission,
    requestPermission,
    scheduleReminder,
    checkAndScheduleAll,
    schedulePetReminders,
    calcNotifyAt,
  };
}

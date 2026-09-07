/**
 * Firestore triggers that schedule email/SMS/push notifications for
 * Calendar, Households, Pets, and Medications — replacing in-tab setTimeout
 * reminders that only fire while the app is open.
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import {
  calculateOffsetBefore,
  londonLocalToUtc,
  londonTodayString,
  parseEventStart,
} from "./calculations";
import {
  activeChannels,
  cancelBySourceKey,
  enqueueNotification,
  loadPrefs,
} from "./helpers";
import type { NotifChannel } from "./types";

type CalNotif = {
  id?: string;
  via?: "push" | "email" | "sms";
  amount?: number;
  unit?: "minutes" | "hours" | "days";
};

type HouseholdReminder = {
  amount?: number;
  unit?: "hours" | "days" | "weeks" | "months";
  via?: "push" | "email" | "sms";
};

type PetNotif = { id?: string; daysBeforeDue?: number };

function asChannels(via: string | undefined): NotifChannel[] {
  if (via === "email" || via === "sms" || via === "push") return [via];
  return ["push"];
}

// ── Calendar events ───────────────────────────────────────────────────────────

export const onCalendarEventWrite = onDocumentWritten(
  {
    document: "calendar/{userId}/events/{eventId}",
  },
  async (event) => {
    const userId = event.params.userId;
    const eventId = event.params.eventId;
    const after = event.data?.after?.data();
    const prefix = `calendar:${eventId}:`;

    await cancelBySourceKey(userId, prefix);
    if (!after) return;

    const prefs = await loadPrefs(userId);
    if (prefs.events.calendar && prefs.events.calendar.enabled === false) return;

    const start = parseEventStart(String(after.startDate || ""));
    if (!start) return;

    const notifs = (after.notifications || []) as CalNotif[];
    for (const n of notifs) {
      const amount = Number(n.amount) || 0;
      const unit = (n.unit || "minutes") as "minutes" | "hours" | "days";
      const when = calculateOffsetBefore(start, amount, unit);
      const channels = activeChannels(asChannels(n.via), prefs);
      if (!channels.length) continue;
      try {
        await enqueueNotification({
          uid: userId,
          type: "calendarEvent",
          title: String(after.title || "Calendar event"),
          channels,
          scheduledFor: when,
          sourceKey: `${prefix}${n.id || `${n.via}-${amount}-${unit}`}`,
          reminderId: n.id,
          eventId,
        });
      } catch (err) {
        logger.error("Failed to schedule calendar notification", { userId, eventId, err });
      }
    }
  },
);

// ── Household renewals ────────────────────────────────────────────────────────

export const onHouseholdItemWrite = onDocumentWritten(
  {
    document: "household/{householdId}/items/{itemId}",
  },
  async (event) => {
    const householdId = event.params.householdId;
    const itemId = event.params.itemId;
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();

    // Resolve members to notify
    const householdSnap = await admin.firestore().doc(`households/${householdId}`).get();
    const memberIds: string[] = Array.isArray(householdSnap.data()?.memberIds)
      ? householdSnap.data()!.memberIds
      : [];

    // Cancel previous schedules for this item across members we know about
    const cancelTargets = new Set<string>([
      ...memberIds,
      ...(before?.notifyUids || []),
    ]);
    for (const uid of cancelTargets) {
      await cancelBySourceKey(uid, `household:${householdId}:${itemId}:`);
    }

    if (!after || !after.pushEnabled) return;
    const endDate = String(after.endDate || "");
    if (!/^\d{4}-\d{2}-\d{2}/.test(endDate)) return;

    const reminders = (after.reminders || []) as HouseholdReminder[];
    if (!reminders.length) return;

    const recipients = memberIds.length ? memberIds : [];
    // Prefer assigned member if they map to a user id
    const assigned = String(after.assignedTo || "");
    const targets = assigned && memberIds.includes(assigned) ? [assigned] : recipients;

    for (const uid of targets) {
      const prefs = await loadPrefs(uid);
      if (prefs.events.household && prefs.events.household.enabled === false) continue;

      for (const r of reminders) {
        const amount = Number(r.amount) || 0;
        const unit = r.unit || "days";
        const msPerUnit: Record<string, number> = {
          hours: 3_600_000,
          days: 86_400_000,
          weeks: 7 * 86_400_000,
          months: 30 * 86_400_000,
        };
        const end = parseEventStart(endDate.slice(0, 10));
        if (!end) continue;
        // Renewals are date-only; fire at 09:00 London on the offset day for day+ units
        const when =
          unit === "hours"
            ? new Date(end.getTime() - amount * msPerUnit.hours)
            : (() => {
                const offsetDays =
                  unit === "weeks" ? amount * 7 : unit === "months" ? amount * 30 : amount;
                const [y, m, d] = endDate.slice(0, 10).split("-").map(Number);
                const base = new Date(Date.UTC(y, m - 1, d));
                base.setUTCDate(base.getUTCDate() - offsetDays);
                return londonLocalToUtc(
                  base.getUTCFullYear(),
                  base.getUTCMonth() + 1,
                  base.getUTCDate(),
                  9,
                  0,
                );
              })();

        const channels = activeChannels(asChannels(r.via || "push"), prefs);
        if (!channels.length) continue;

        try {
          await enqueueNotification({
            uid,
            type: "householdRenewal",
            title: `${after.type || "Item"} (${after.provider || "household"})`,
            channels,
            scheduledFor: when,
            sourceKey: `household:${householdId}:${itemId}:${r.via || "push"}-${amount}-${unit}`,
            itemId,
            householdId,
          });
        } catch (err) {
          logger.error("Failed to schedule household notification", { uid, itemId, err });
        }
      }
    }
  },
);

// ── Pet flea / worm treatments ────────────────────────────────────────────────

export const onPetWrite = onDocumentWritten(
  {
    document: "pets/{petId}",
  },
  async (event) => {
    const petId = event.params.petId;
    const after = event.data?.after?.data();
    const before = event.data?.before?.data();

    const prevUids = new Set<string>([
      String(before?.ownerId || ""),
      ...((before?.sharedWith || []) as string[]),
    ].filter(Boolean));
    for (const uid of prevUids) {
      await cancelBySourceKey(uid, `pet:${petId}:`);
    }
    if (!after) return;

    const recipients = new Set<string>([
      String(after.ownerId || ""),
      ...((after.sharedWith || []) as string[]),
    ].filter(Boolean));

    const history = (after.treatmentHistory || []) as {
      type?: string;
      dateDue?: string;
    }[];

    for (const treatmentType of ["flea", "worming"] as const) {
      const notifications = (
        treatmentType === "flea" ? after.fleaNotifications : after.wormNotifications
      ) as PetNotif[];
      if (!notifications?.length) continue;

      const latest = [...history]
        .filter((t) => t.type === treatmentType)
        .sort((a, b) => String(b.dateDue || "").localeCompare(String(a.dateDue || "")))[0];
      if (!latest?.dateDue) continue;

      const due = String(latest.dateDue).slice(0, 10);
      const [y, m, d] = due.split("-").map(Number);

      for (const uid of recipients) {
        const prefs = await loadPrefs(uid);
        if (prefs.events.pets && prefs.events.pets.enabled === false) continue;
        const featureChannels = prefs.events.pets?.channels || ["push", "email", "sms"];
        const channels = activeChannels(featureChannels, prefs);
        if (!channels.length) continue;

        for (const n of notifications) {
          const days = Number(n.daysBeforeDue) || 0;
          const base = new Date(Date.UTC(y, m - 1, d));
          base.setUTCDate(base.getUTCDate() - days);
          const when = londonLocalToUtc(
            base.getUTCFullYear(),
            base.getUTCMonth() + 1,
            base.getUTCDate(),
            9,
            0,
          );
          const label =
            treatmentType === "flea"
              ? `Flea treatment for ${after.name}`
              : `Wormer for ${after.name}`;
          try {
            await enqueueNotification({
              uid,
              type: "petTreatment",
              title: `${label} due in ${days} day${days === 1 ? "" : "s"} (${due})`,
              channels,
              scheduledFor: when,
              sourceKey: `pet:${petId}:${treatmentType}:${n.id || days}`,
              petId,
              reminderId: n.id,
            });
          } catch (err) {
            logger.error("Failed to schedule pet notification", { uid, petId, err });
          }
        }
      }
    }
  },
);

// ── Medications — schedule today's remaining doses + next 2 days ─────────────

export const onMedicationWrite = onDocumentWritten(
  {
    document: "medications/{userId}/meds/{medId}",
  },
  async (event) => {
    const userId = event.params.userId;
    const medId = event.params.medId;
    const after = event.data?.after?.data();
    const prefix = `med:${medId}:`;

    await cancelBySourceKey(userId, prefix);
    if (!after || after.active === false) return;

    const prefs = await loadPrefs(userId);
    if (prefs.events.medications && prefs.events.medications.enabled === false) return;
    const channels = activeChannels(prefs.events.medications?.channels || ["push"], prefs);
    if (!channels.length) return;

    const times = (after.times || []) as string[];
    if (!times.length) return;

    // Schedule for today + next 2 London calendar days
    const today = londonTodayString();
    const [ty, tm, td] = today.split("-").map(Number);
    for (let offset = 0; offset < 3; offset++) {
      const day = new Date(Date.UTC(ty, tm - 1, td + offset));
      const y = day.getUTCFullYear();
      const m = day.getUTCMonth() + 1;
      const d = day.getUTCDate();
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      for (const time of times) {
        const [h, mi] = String(time).split(":").map(Number);
        const when = londonLocalToUtc(y, m, d, h || 0, mi || 0);
        try {
          await enqueueNotification({
            uid: userId,
            type: "medication",
            title: `${after.name} — ${after.dose || ""} ${after.unit || ""}`.trim(),
            channels,
            scheduledFor: when,
            sourceKey: `${prefix}${dateStr}:${time}`,
            medId,
          });
        } catch (err) {
          logger.error("Failed to schedule medication notification", { userId, medId, err });
        }
      }
    }
  },
);

import { onSchedule } from "firebase-functions/v2/scheduler";

/** Nightly top-up so medication reminders stay 2 days ahead. */
export const scheduleMedicationTopUp = onSchedule(
  {
    schedule: "5 0 * * *",
    timeZone: "Europe/London",
  },
  async () => {
    const db = admin.firestore();
    // Walk active meds via collection group would need an index; instead scan med owners
    // from notificationPrefs who have medications feature enabled, then their meds.
    const prefsSnap = await db.collection("notificationPrefs").limit(200).get();
    for (const prefsDoc of prefsSnap.docs) {
      const uid = prefsDoc.id;
      const prefs = await loadPrefs(uid);
      if (prefs.events.medications && prefs.events.medications.enabled === false) continue;
      const channels = activeChannels(prefs.events.medications?.channels || ["push"], prefs);
      if (!channels.length) continue;

      const meds = await db.collection(`medications/${uid}/meds`).get();
      for (const medDoc of meds.docs) {
        const med = medDoc.data();
        if (med.active === false) continue;
        const times = (med.times || []) as string[];
        if (!times.length) continue;

        const today = londonTodayString();
        const [ty, tm, td] = today.split("-").map(Number);
        for (let offset = 0; offset < 3; offset++) {
          const day = new Date(Date.UTC(ty, tm - 1, td + offset));
          const y = day.getUTCFullYear();
          const m = day.getUTCMonth() + 1;
          const d = day.getUTCDate();
          const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          for (const time of times) {
            const [h, mi] = String(time).split(":").map(Number);
            const when = londonLocalToUtc(y, m, d, h || 0, mi || 0);
            try {
              await enqueueNotification({
                uid,
                type: "medication",
                title: `${med.name} — ${med.dose || ""} ${med.unit || ""}`.trim(),
                channels,
                scheduledFor: when,
                sourceKey: `med:${medDoc.id}:${dateStr}:${time}`,
                medId: medDoc.id,
              });
            } catch (err) {
              logger.error("Med top-up schedule failed", { uid, medId: medDoc.id, err });
            }
          }
        }
      }
    }
  },
);

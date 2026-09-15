/**
 * Schedules reminders for the Birthdays widget and keeps a read-only calendar
 * event synced for each recipient the birthday is shared with. Mirrors the
 * pattern in featureSchedulers.ts (onHouseholdItemWrite/onPetWrite).
 */
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { calculateReminderTime, londonLocalToUtc, londonTodayString } from "./calculations";
import { activeChannels, cancelBySourceKey, enqueueNotification, loadPrefs, sanitizeNotifTitle } from "./helpers";
import type { ReminderConfig } from "./types";

interface BirthdaySharing {
  mode: "all" | "some" | "none";
  uids?: string[];
}

interface BirthdayDoc {
  name?: string;
  month?: number;
  day?: number;
  householdId?: string | null;
  createdBy?: string;
  sharedWith?: BirthdaySharing;
  reminders?: ReminderConfig[];
  /** Recipients as of the last successful schedule run — see scheduleBirthdayReminders. */
  lastSyncedRecipients?: string[];
}

const MAX_REMINDERS = 3;

/** Next occurrence (today counts) of month/day, in Europe/London terms, as "YYYY-MM-DD". */
function nextOccurrenceDateStr(month: number, day: number, todayStr: string): string {
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const thisYear = `${ty}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (month > tm || (month === tm && day >= td)) return thisYear;
  return `${ty + 1}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function resolveRecipients(sharing: BirthdaySharing | undefined, householdId: string | null | undefined, createdBy: string): Promise<string[]> {
  const creator = createdBy ? [createdBy] : [];
  if (!sharing || sharing.mode === "none") return creator;
  if (sharing.mode === "some") {
    return [...new Set([...creator, ...(sharing.uids || [])])];
  }
  if (sharing.mode === "all" && householdId) {
    try {
      const snap = await admin.firestore().doc(`households/${householdId}`).get();
      const memberIds: string[] = Array.isArray(snap.data()?.memberIds) ? snap.data()!.memberIds : [];
      return [...new Set([...creator, ...memberIds])];
    } catch {
      return creator;
    }
  }
  return creator;
}

async function scheduleBirthdayReminders(birthdayId: string, after: BirthdayDoc, prevRecipients: string[]): Promise<void> {
  const db = admin.firestore();
  const month = Number(after.month);
  const day = Number(after.day);
  if (!month || !day) return;

  const recipients = await resolveRecipients(after.sharedWith, after.householdId, String(after.createdBy || ""));

  // Cancel schedules + drop calendar events for anyone no longer a recipient.
  // Union the caller's before/after diff (fast path, from onBirthdayWrite) with
  // the last-synced snapshot stored on the doc itself: the nightly self-heal
  // has no "before" of its own to diff against (it only sees current state),
  // so without this stored snapshot it can never detect someone who dropped
  // out — e.g. left the household — since the birthday doc was last edited.
  const storedPrev = Array.isArray(after.lastSyncedRecipients) ? after.lastSyncedRecipients : [];
  const removed = [...new Set([...prevRecipients, ...storedPrev])].filter((uid) => !recipients.includes(uid));
  for (const uid of removed) {
    await cancelBySourceKey(uid, `birthday:${birthdayId}:`);
    await db.doc(`calendar/${uid}/events/birthday_${birthdayId}`).delete().catch(() => undefined);
  }

  const todayStr = londonTodayString();
  const occurrence = nextOccurrenceDateStr(month, day, todayStr);
  const [occYear, occMonth, occDay] = occurrence.split("-").map(Number);
  const name = sanitizeNotifTitle(String(after.name || "Birthday"), 80);
  const reminders = (after.reminders || []).slice(0, MAX_REMINDERS);

  for (const uid of recipients) {
    // Calendar sync — display only, independent of that user's reminder prefs.
    const eventRef = db.doc(`calendar/${uid}/events/birthday_${birthdayId}`);
    const existing = await eventRef.get();
    await eventRef.set(
      {
        title: `🎂 ${name}'s birthday`,
        category: "birthday",
        source: "birthday",
        birthdayId,
        // A bare `${occurrence}T23:59:59.000Z` is actually 00:59:59 the *next*
        // UK day during BST — londonLocalToUtc converts the real UK wall-clock
        // boundary so the event never looks like it spills into the next day.
        startDate: londonLocalToUtc(occYear, occMonth, occDay, 0, 0).toISOString(),
        endDate: londonLocalToUtc(occYear, occMonth, occDay, 23, 59).toISOString(),
        allDay: true,
        createdBy: String(after.createdBy || uid),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(existing.exists ? {} : { createdAt: admin.firestore.FieldValue.serverTimestamp() }),
      },
      { merge: true },
    );

    // Reminders — gated by that recipient's own notification prefs, like every other feature.
    await cancelBySourceKey(uid, `birthday:${birthdayId}:`);
    const prefs = await loadPrefs(uid);
    if (prefs.events.birthdays && prefs.events.birthdays.enabled === false) continue;

    for (const reminder of reminders) {
      const when = calculateReminderTime(occurrence, reminder);
      if (!when) continue;
      const channels = activeChannels(reminder.channels, prefs);
      if (!channels.length) continue;
      try {
        await enqueueNotification({
          uid,
          type: "birthday",
          title: `${name}'s birthday`,
          channels,
          scheduledFor: when,
          sourceKey: `birthday:${birthdayId}:${reminder.id}:${uid}`,
          reminderId: reminder.id,
          birthdayId,
        });
      } catch (err) {
        logger.error("Failed to schedule birthday notification", { uid, birthdayId, err });
      }
    }
  }

  // Persist this run's recipient list so the next run (write or nightly
  // self-heal) has an accurate "previous" snapshot to diff against. Guarded
  // by an actual-change check since this function runs inside an
  // onDocumentWritten trigger for this same document — writing unconditionally
  // would retrigger itself every single time (harmlessly, since a second pass
  // would see recipients unchanged and stop, but still worth avoiding).
  const recipientsSet = [...recipients].sort();
  const storedSet = [...storedPrev].sort();
  const changed = recipientsSet.length !== storedSet.length || recipientsSet.some((uid, i) => uid !== storedSet[i]);
  if (changed) {
    await db.doc(`birthdays/${birthdayId}`).set({ lastSyncedRecipients: recipients }, { merge: true }).catch(() => undefined);
  }
}

export const onBirthdayWrite = onDocumentWritten(
  { document: "birthdays/{birthdayId}" },
  async (event) => {
    const birthdayId = event.params.birthdayId;
    const after = event.data?.after?.data() as BirthdayDoc | undefined;
    const before = event.data?.before?.data() as BirthdayDoc | undefined;

    const prevRecipients = before
      ? await resolveRecipients(before.sharedWith, before.householdId, String(before.createdBy || ""))
      : [];

    if (!after) {
      // Deleted — cancel everywhere it was previously scheduled/synced.
      for (const uid of prevRecipients) {
        await cancelBySourceKey(uid, `birthday:${birthdayId}:`);
        await admin.firestore().doc(`calendar/${uid}/events/birthday_${birthdayId}`).delete().catch(() => undefined);
      }
      return;
    }

    await scheduleBirthdayReminders(birthdayId, after, prevRecipients);
  },
);

/** Daily self-heal: rolls each birthday's reminders/calendar sync forward once its
 *  date has passed, since (unlike a one-off due date) birthdays repeat every year. */
export const refreshBirthdayReminders = onSchedule(
  { schedule: "0 1 * * *", timeZone: "Europe/London" },
  async () => {
    const db = admin.firestore();
    const snap = await db.collection("birthdays").get();
    for (const docSnap of snap.docs) {
      const after = docSnap.data() as BirthdayDoc;
      const recipients = await resolveRecipients(after.sharedWith, after.householdId, String(after.createdBy || ""));
      try {
        await scheduleBirthdayReminders(docSnap.id, after, recipients);
      } catch (err) {
        logger.error("Failed to refresh birthday reminders", { birthdayId: docSnap.id, err });
      }
    }
  },
);

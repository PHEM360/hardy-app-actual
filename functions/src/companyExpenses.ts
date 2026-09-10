/**
 * Recurring ("regular") company expenses: generates the next occurrence of
 * every active monthly/yearly expense as its own real expense entry (ready
 * for that period's receipt to be attached), and periodically reminds each
 * company owner to review their regular expenses.
 */
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import * as admin from "firebase-admin";
import { londonTodayString } from "./notifications/calculations";
import { enqueueNotification } from "./notifications/helpers";

interface Recurrence {
  frequency?: "monthly" | "yearly";
  active?: boolean;
}

interface ExpenseDoc {
  date?: string;
  description?: string;
  amount?: number;
  category?: string;
  companyIds?: string[];
  recurrence?: Recurrence;
}

const MAX_CATCHUP_PERIODS = 36; // 3 years of monthly, or well beyond any realistic yearly gap

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date): string {
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Adds N months to a UTC date, clamping the day so e.g. 31 Jan + 1 month -> 28/29 Feb, not overflowing into March. */
function addMonthsClamped(date: Date, months: number): Date {
  const day = date.getUTCDate();
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInTarget = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, daysInTarget));
  return first;
}

/** Adds N years to a UTC date, clamping 29 Feb -> 28 Feb in non-leap years. */
function addYearsClamped(date: Date, years: number): Date {
  const year = date.getUTCFullYear() + years;
  const daysInMonth = new Date(Date.UTC(year, date.getUTCMonth() + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, date.getUTCMonth(), Math.min(date.getUTCDate(), daysInMonth)));
}

function periodKeyFor(frequency: "monthly" | "yearly", occurrence: Date): string {
  return frequency === "monthly"
    ? `${occurrence.getUTCFullYear()}-${pad2(occurrence.getUTCMonth() + 1)}`
    : `${occurrence.getUTCFullYear()}`;
}

/**
 * Every day, walk every active recurring expense (across all companies) and
 * create any occurrence that's now due but doesn't exist yet — catching up on
 * more than one missed period if needed, e.g. after the app was untouched for
 * a couple of months.
 */
export const generateRecurringExpenses = onSchedule(
  { schedule: "0 6 * * *", timeZone: "Europe/London" },
  async () => {
    const db = admin.firestore();
    const todayStr = londonTodayString();
    const today = new Date(`${todayStr}T00:00:00.000Z`);

    const templatesSnap = await db
      .collectionGroup("expenses")
      .where("recurrence.active", "==", true)
      .get();

    for (const templateDoc of templatesSnap.docs) {
      const template = templateDoc.data() as ExpenseDoc;
      const frequency = template.recurrence?.frequency;
      const startDateStr = String(template.date || "");
      if (!frequency || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) continue;

      const companyRef = templateDoc.ref.parent.parent;
      if (!companyRef) continue;
      const startDate = new Date(`${startDateStr}T00:00:00.000Z`);

      for (let n = 1; n <= MAX_CATCHUP_PERIODS; n++) {
        const occurrence = frequency === "monthly" ? addMonthsClamped(startDate, n) : addYearsClamped(startDate, n);
        if (occurrence > today) break;

        const periodKey = periodKeyFor(frequency, occurrence);
        const existing = await companyRef
          .collection("expenses")
          .where("recurringSourceId", "==", templateDoc.id)
          .where("recurrencePeriod", "==", periodKey)
          .limit(1)
          .get();
        if (!existing.empty) continue;

        try {
          await companyRef.collection("expenses").add({
            date: toISODate(occurrence),
            description: template.description || "Regular expense",
            amount: Number(template.amount) || 0,
            category: template.category || "Other",
            receipts: [],
            receiptNames: [],
            companyIds: Array.isArray(template.companyIds) ? template.companyIds : [],
            groupId: null,
            recurringSourceId: templateDoc.id,
            recurrencePeriod: periodKey,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        } catch (err) {
          logger.error("Failed to generate recurring expense occurrence", {
            templateId: templateDoc.id,
            companyId: companyRef.id,
            periodKey,
            err,
          });
        }
      }
    }
  },
);

const REVIEW_INTERVAL_MS = 183 * 24 * 60 * 60 * 1000; // ~6 months

/**
 * Weekly check: any company owner with at least one active regular expense
 * who hasn't been reminded in ~6 months gets a nudge to review their list.
 */
export const remindRegularExpenseReview = onSchedule(
  { schedule: "0 8 * * 1", timeZone: "Europe/London" },
  async () => {
    const db = admin.firestore();
    const templatesSnap = await db
      .collectionGroup("expenses")
      .where("recurrence.active", "==", true)
      .get();

    const ownersWithCount = new Map<string, number>();
    for (const templateDoc of templatesSnap.docs) {
      const companyRef = templateDoc.ref.parent.parent;
      if (!companyRef) continue;
      const companySnap = await companyRef.get();
      const ownerId = String(companySnap.data()?.ownerId || "");
      if (!ownerId) continue;
      ownersWithCount.set(ownerId, (ownersWithCount.get(ownerId) || 0) + 1);
    }

    const now = Date.now();
    for (const [ownerId, count] of ownersWithCount) {
      const trackerRef = db.doc(`expenseReviewReminders/${ownerId}`);
      const tracker = await trackerRef.get();
      const lastSentAt = tracker.data()?.lastSentAtMs;
      if (typeof lastSentAt === "number" && now - lastSentAt < REVIEW_INTERVAL_MS) continue;

      try {
        await enqueueNotification({
          uid: ownerId,
          type: "expenseReview",
          title: `You have ${count} regular expense${count === 1 ? "" : "s"} running — worth a quick review`,
          channels: ["push", "email"],
          scheduledFor: new Date(now + 60_000),
          sourceKey: `expenseReview:${ownerId}:${now}`,
        });
        await trackerRef.set({ lastSentAtMs: now, lastSentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } catch (err) {
        logger.error("Failed to schedule expense review reminder", { ownerId, err });
      }
    }
  },
);

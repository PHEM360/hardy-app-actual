import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { ScheduledNotification } from "./types";
import { sendNotification } from "./sender";
import { loadPrefs, resolveAuthEmail, escapeHtml, sanitizeNotifTitle, isInQuietHours, activeChannels } from "./helpers";
import { londonLocalToUtc, londonTodayString } from "./calculations";
import { buildDailyBrief } from "./dailyBrief";

const APP_ORIGIN = "https://hardyapp.co.uk";

const postmarkKey = defineSecret("POSTMARK_API_KEY");
const twilioSid = defineSecret("TWILIO_ACCOUNT_SID");
const twilioToken = defineSecret("TWILIO_AUTH_TOKEN");
const twilioFrom = defineSecret("TWILIO_FROM");

export const processScheduledNotifications = onSchedule(
  {
    schedule: "every 5 minutes",
    timeZone: "Europe/London",
    secrets: [postmarkKey, twilioSid, twilioToken, twilioFrom],
  },
  async () => {
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();

    const snap = await db
      .collection("scheduledNotifications")
      .where("scheduledFor", "<=", now)
      .where("sent", "==", false)
      .limit(50)
      .get();

    if (snap.empty) return;

    for (const doc of snap.docs) {
      const notif = doc.data() as ScheduledNotification;
      try {
        const prefs = await loadPrefs(notif.uid);

        // Quiet hours: hold non-brief notifications until the window ends.
        // Daily brief always sends at its chosen time (user picked that slot).
        if (notif.type !== "dailyDigest" && isInQuietHours(prefs)) {
          continue;
        }

        // Re-check master channel switches at send time.
        const channels = activeChannels(notif.channels || [], prefs);
        if (!channels.length) {
          await doc.ref.update({
            sent: true,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            skipped: "no-active-channels",
          });
          continue;
        }

        const authEmail = await resolveAuthEmail(notif.uid);
        const emailTo = prefs.email.enabled ? (prefs.email.address || authEmail) : "";
        const smsTo = prefs.sms.enabled ? prefs.sms.phone : "";

        let subject = buildSubject(notif.type, sanitizeNotifTitle(notif.taskTitle ?? "Reminder"));
        let text = buildText(notif.type, sanitizeNotifTitle(notif.taskTitle ?? "Reminder"));
        let htmlBody = `<p>${escapeHtml(text)}</p>`;

        if (notif.type === "dailyDigest") {
          if (!prefs.events.dailyDigest.enabled) {
            await doc.ref.update({
              sent: true,
              sentAt: admin.firestore.FieldValue.serverTimestamp(),
              skipped: "digest-disabled",
            });
            continue;
          }
          const brief = await buildDailyBrief(notif.uid, prefs.events.dailyDigest);
          subject = brief.title;
          text = brief.text;
          htmlBody = brief.html;
        }

        const clickPath = clickPathFor(notif.type);

        await sendNotification({
          uid: notif.uid,
          channels,
          emailEnabled: prefs.email.enabled,
          emailTo,
          smsEnabled: prefs.sms.enabled,
          smsTo,
          pushEnabled: prefs.push.enabled,
          subject,
          textBody: text,
          htmlBody,
          pushClickPath: clickPath,
          actionUrl: clickPath ? `${APP_ORIGIN}${clickPath}` : undefined,
          actionLabel: clickPath ? "Open in Hardy Hub" : undefined,
          postmarkKey: postmarkKey.value(),
          twilioSid: twilioSid.value(),
          twilioToken: twilioToken.value(),
          twilioFrom: twilioFrom.value(),
        });

        await doc.ref.update({
          sent: true,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        logger.error("Failed to send scheduled notification", { id: doc.id, err });
      }
    }
  },
);

export const scheduleDailyDigests = onSchedule(
  {
    schedule: "0 0 * * *",
    timeZone: "Europe/London",
    secrets: [postmarkKey, twilioSid, twilioToken, twilioFrom],
  },
  async () => {
    const db = admin.firestore();
    const prefsSnap = await db.collection("notificationPrefs").get();
    const todayStr = londonTodayString();
    const [y, mo, d] = todayStr.split("-").map(Number);

    for (const prefsDoc of prefsSnap.docs) {
      const prefs = await loadPrefs(prefsDoc.id);
      if (!prefs.events.dailyDigest.enabled) continue;

      const uid = prefsDoc.id;
      const [dh, dm] = (prefs.events.dailyDigest.time || "08:00").split(":").map(Number);
      const sendAt = londonLocalToUtc(y, mo, d, dh, dm);

      if (sendAt <= new Date()) continue;

      const existing = await db
        .collection("scheduledNotifications")
        .where("uid", "==", uid)
        .where("type", "==", "dailyDigest")
        .where("sent", "==", false)
        .get();

      if (existing.empty) {
        await db.collection("scheduledNotifications").add({
          uid,
          type: "dailyDigest",
          taskTitle: `Daily brief for ${todayStr}`,
          sourceKey: `digest:${uid}:${todayStr}`,
          scheduledFor: admin.firestore.Timestamp.fromDate(sendAt),
          channels: prefs.events.dailyDigest.channels,
          sent: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }
  },
);

function clickPathFor(type: ScheduledNotification["type"]): string {
  switch (type) {
    case "taskDue":
    case "taskCompleted":
    case "taskAdded":
      return "/tasks";
    case "dailyDigest":
      return "/today";
    case "calendarEvent":
      return "/calendar";
    case "householdRenewal":
      return "/households";
    case "petTreatment":
      return "/pets";
    case "medication":
      return "/health";
    case "birthday":
      return "/today";
    case "expenseReview":
      return "/companies";
    default:
      return "/";
  }
}

function buildSubject(type: ScheduledNotification["type"], title: string): string {
  switch (type) {
    case "taskDue":
      return `Reminder: "${title}" is due`;
    case "taskCompleted":
      return `Task completed: ${title}`;
    case "taskAdded":
      return `New task: ${title}`;
    case "dailyDigest":
      return "Your daily brief";
    case "calendarEvent":
      return `Upcoming: ${title}`;
    case "householdRenewal":
      return `Renewal reminder: ${title}`;
    case "petTreatment":
      return `Pet care: ${title}`;
    case "medication":
      return `Medication: ${title}`;
    case "birthday":
      return title;
    case "expenseReview":
      return "Time to review your regular expenses";
    default:
      return "Hardy Hub notification";
  }
}

function buildText(type: ScheduledNotification["type"], title: string): string {
  switch (type) {
    case "taskDue":
      return `Don't forget — "${title}" is due today.`;
    case "taskCompleted":
      return `"${title}" has been marked as done. Great work!`;
    case "taskAdded":
      return `A new task has been added: "${title}".`;
    case "dailyDigest":
      return "Here is your daily brief. Open Hardy Hub to review the day.";
    case "calendarEvent":
      return `"${title}" is coming up soon.`;
    case "householdRenewal":
      return `"${title}" is due for renewal soon.`;
    case "petTreatment":
      return title;
    case "medication":
      return `Time for ${title}.`;
    case "birthday":
      return title;
    case "expenseReview":
      return title;
    default:
      return "You have a new notification from Hardy Hub.";
  }
}

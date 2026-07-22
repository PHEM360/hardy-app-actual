import * as admin from "firebase-admin";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { NotificationPrefs, ScheduledNotification } from "./types";
import { sendNotification } from "./sender";

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
        const prefsDoc = await db.doc(`notificationPrefs/${notif.uid}`).get();
        const prefs = prefsDoc.data() as NotificationPrefs | undefined;
        if (!prefs) {
          await doc.ref.update({ sent: true, sentAt: admin.firestore.FieldValue.serverTimestamp() });
          continue;
        }

        let authEmail = "";
        try {
          const u = await admin.auth().getUser(notif.uid);
          authEmail = u.email ?? "";
        } catch (err) {
          logger.debug("Unable to resolve auth email for scheduled notification", {
            uid: notif.uid,
            err,
          });
        }

        const emailTo = prefs.email.enabled ? (prefs.email.address || authEmail) : "";
        const smsTo = prefs.sms.enabled ? prefs.sms.phone : "";

        const title = notif.taskTitle ?? "Task";
        const subject = buildSubject(notif.type, title);
        const text = buildText(notif.type, title);

        await sendNotification({
          uid: notif.uid,
          channels: notif.channels,
          emailEnabled: prefs.email.enabled,
          emailTo,
          smsEnabled: prefs.sms.enabled,
          smsTo,
          pushEnabled: prefs.push.enabled,
          subject,
          textBody: text,
          htmlBody: `<p>${text}</p>`,
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
  }
);

export const scheduleDailyDigests = onSchedule(
  {
    schedule: "0 0 * * *", // midnight London time
    timeZone: "Europe/London",
    secrets: [postmarkKey, twilioSid, twilioToken, twilioFrom],
  },
  async () => {
    const db = admin.firestore();

    // Find all users with daily digest enabled
    const prefsSnap = await db.collection("notificationPrefs").get();
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const todayStr = `${yyyy}-${mm}-${dd}`;

    for (const prefsDoc of prefsSnap.docs) {
      const prefs = prefsDoc.data() as NotificationPrefs;
      if (!prefs.events.dailyDigest.enabled) continue;

      const uid = prefsDoc.id;

      // Parse digest send time
      const [dh, dm] = (prefs.events.dailyDigest.time || "09:00").split(":").map(Number);
      const sendAt = new Date(yyyy, today.getMonth(), today.getDate(), dh, dm, 0, 0);

      // Skip if already passed
      if (sendAt <= new Date()) continue;

      // Check for tasks due today to determine subject/body at send time
      const notif = {
        uid,
        type: "dailyDigest" as const,
        taskTitle: `Daily digest for ${todayStr}`,
        scheduledFor: admin.firestore.Timestamp.fromDate(sendAt),
        channels: prefs.events.dailyDigest.channels,
        sent: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Don't duplicate if already scheduled today
      const existing = await db
        .collection("scheduledNotifications")
        .where("uid", "==", uid)
        .where("type", "==", "dailyDigest")
        .where("sent", "==", false)
        .get();

      if (existing.empty) {
        await db.collection("scheduledNotifications").add(notif);
      }
    }
  }
);

function buildSubject(type: ScheduledNotification["type"], title: string): string {
  switch (type) {
    case "taskDue": return `Reminder: "${title}" is due`;
    case "taskCompleted": return `Task completed: ${title}`;
    case "taskAdded": return `New task: ${title}`;
    case "dailyDigest": return "Your daily task digest";
    default: return "Family Vault notification";
  }
}

function buildText(type: ScheduledNotification["type"], title: string): string {
  switch (type) {
    case "taskDue": return `Don't forget — "${title}" is due today.`;
    case "taskCompleted": return `"${title}" has been marked as done. Great work!`;
    case "taskAdded": return `A new task has been added: "${title}".`;
    case "dailyDigest": return "Here's your daily summary of tasks due today. Log in to Family Vault to review them.";
    default: return "You have a new notification from Family Vault.";
  }
}

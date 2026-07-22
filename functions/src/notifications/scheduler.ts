import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { NotificationPrefs, ScheduledNotification } from "./types";
import { calculateReminderTime } from "./calculations";
import { sendNotification } from "./sender";

export const postmarkKey = defineSecret("POSTMARK_API_KEY");
export const twilioSid = defineSecret("TWILIO_ACCOUNT_SID");
export const twilioToken = defineSecret("TWILIO_AUTH_TOKEN");
export const twilioFrom = defineSecret("TWILIO_FROM");

export const onTaskWrite = onDocumentWritten(
  {
    document: "tasks/{userId}/items/{taskId}",
    secrets: [postmarkKey, twilioSid, twilioToken, twilioFrom],
  },
  async (event) => {
    const userId = event.params.userId;
    const taskId = event.params.taskId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    const db = admin.firestore();

    // Get user notification prefs
    const prefsDoc = await db.doc(`notificationPrefs/${userId}`).get();
    const prefs = prefsDoc.data() as NotificationPrefs | undefined;
    if (!prefs) return;

    // Resolve contact details
    let authEmail = "";
    try {
      const userRecord = await admin.auth().getUser(userId);
      authEmail = userRecord.email ?? "";
    } catch (err) {
      logger.debug("Unable to resolve auth email while scheduling notification", {
        userId,
        err,
      });
    }

    const emailTo = prefs.email.enabled ? (prefs.email.address || authEmail) : "";
    const smsTo = prefs.sms.enabled ? prefs.sms.phone : "";

    const sendBase = {
      uid: userId,
      emailEnabled: prefs.email.enabled,
      emailTo,
      smsEnabled: prefs.sms.enabled,
      smsTo,
      pushEnabled: prefs.push.enabled,
      postmarkKey: postmarkKey.value(),
      twilioSid: twilioSid.value(),
      twilioToken: twilioToken.value(),
      twilioFrom: twilioFrom.value(),
    };

    // ── Task created: send immediate "taskAdded" notification ──
    if (!before && after && prefs.events.taskAdded.enabled) {
      const title = after.title ?? "New task";
      const dueNote = after.dueDate ? ` Due: ${after.dueDate}.` : "";
      await sendNotification({
        ...sendBase,
        channels: prefs.events.taskAdded.channels,
        subject: `New task added: ${title}`,
        textBody: `A new task has been added: "${title}".${dueNote}`,
        htmlBody: `<p>A new task has been added: <strong>${title}</strong>.${dueNote}</p>`,
      }).catch((e) => logger.error("taskAdded send failed", e));
    }

    // ── Status changed to done: send "taskCompleted" notification ──
    if (
      after &&
      before?.status !== "done" &&
      after.status === "done" &&
      prefs.events.taskCompleted.enabled
    ) {
      const title = after.title ?? "Task";
      await sendNotification({
        ...sendBase,
        channels: prefs.events.taskCompleted.channels,
        subject: `Task completed: ${title}`,
        textBody: `Great work! "${title}" has been marked as done.`,
        htmlBody: `<p>Great work! <strong>${title}</strong> has been marked as done. ✅</p>`,
      }).catch((e) => logger.error("taskCompleted send failed", e));
    }

    // ── Task deleted: cancel any pending scheduled notifications ──
    if (!after && before) {
      await cancelScheduledForTask(db, userId, taskId);
      return;
    }

    // ── Due date changed or new task: reschedule taskDue notifications ──
    const dueDateChanged = before?.dueDate !== after?.dueDate;
    const isNew = !before;
    if ((dueDateChanged || isNew) && after && prefs.events.taskDue.enabled) {
      await cancelScheduledForTask(db, userId, taskId);

      if (after.dueDate) {
        const now = new Date();
        for (const reminder of prefs.events.taskDue.reminders) {
          const hasActiveChannel = reminder.channels.some(
            (c) =>
              (c === "email" && prefs.email.enabled) ||
              (c === "sms" && prefs.sms.enabled) ||
              (c === "push" && prefs.push.enabled)
          );
          if (!hasActiveChannel) continue;

          const scheduledDate = calculateReminderTime(after.dueDate, reminder);
          if (!scheduledDate || scheduledDate <= now) continue;

          const notif: Omit<ScheduledNotification, "scheduledFor" | "createdAt"> & {
            scheduledFor: admin.firestore.Timestamp;
            createdAt: admin.firestore.FieldValue;
          } = {
            uid: userId,
            taskId,
            taskTitle: after.title ?? "Task",
            type: "taskDue",
            reminderId: reminder.id,
            scheduledFor: admin.firestore.Timestamp.fromDate(scheduledDate),
            channels: reminder.channels,
            sent: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          };
          await db.collection("scheduledNotifications").add(notif);
        }
      }
    }
  }
);

async function cancelScheduledForTask(
  db: admin.firestore.Firestore,
  uid: string,
  taskId: string
): Promise<void> {
  const snap = await db
    .collection("scheduledNotifications")
    .where("uid", "==", uid)
    .where("taskId", "==", taskId)
    .where("sent", "==", false)
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  snap.forEach((d) => batch.delete(d.ref));
  await batch.commit();
}

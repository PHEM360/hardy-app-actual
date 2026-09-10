import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { DEFAULT_NOTIF_PREFS, NotifChannel, NotificationPrefs, ScheduledNotifType } from "./types";

export async function loadPrefs(uid: string): Promise<NotificationPrefs> {
  const snap = await admin.firestore().doc(`notificationPrefs/${uid}`).get();
  if (!snap.exists) return { ...DEFAULT_NOTIF_PREFS };
  const data = snap.data() as NotificationPrefs;
  return {
    ...DEFAULT_NOTIF_PREFS,
    ...data,
    email: { ...DEFAULT_NOTIF_PREFS.email, ...(data.email || {}) },
    sms: { ...DEFAULT_NOTIF_PREFS.sms, ...(data.sms || {}) },
    push: { ...DEFAULT_NOTIF_PREFS.push, ...(data.push || {}) },
    events: { ...DEFAULT_NOTIF_PREFS.events, ...(data.events || {}) },
  };
}

export async function resolveAuthEmail(uid: string): Promise<string> {
  try {
    return (await admin.auth().getUser(uid)).email ?? "";
  } catch (err) {
    logger.debug("Unable to resolve auth email", { uid, err });
    return "";
  }
}

export function activeChannels(
  requested: NotifChannel[],
  prefs: NotificationPrefs,
): NotifChannel[] {
  return requested.filter(
    (c) =>
      (c === "email" && prefs.email.enabled) ||
      (c === "sms" && prefs.sms.enabled) ||
      (c === "push" && prefs.push.enabled),
  );
}

/** Escape text before embedding in HTML email bodies. */
export function escapeHtml(input: string): string {
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Strip control chars and clamp length for notification titles/subjects. */
export function sanitizeNotifTitle(input: string, max = 160): string {
  return Array.from(String(input || ""))
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code < 32 || code === 127 ? " " : ch;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export async function cancelBySourceKey(uid: string, sourceKeyPrefix: string): Promise<void> {
  const db = admin.firestore();
  // Prefixed cancel: match exact keys we wrote, or query by sourceKey equality one-by-one
  // We store exact sourceKeys; callers pass the full key or we query startsWith via in-memory filter.
  const snap = await db
    .collection("scheduledNotifications")
    .where("uid", "==", uid)
    .where("sent", "==", false)
    .get();
  if (snap.empty) return;
  const batch = db.batch();
  let n = 0;
  snap.forEach((d) => {
    const key = String(d.data().sourceKey || "");
    if (key === sourceKeyPrefix || key.startsWith(sourceKeyPrefix)) {
      batch.delete(d.ref);
      n++;
    }
  });
  if (n > 0) await batch.commit();
}

export async function cancelScheduledForTask(
  db: admin.firestore.Firestore,
  uid: string,
  taskId: string,
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

export async function enqueueNotification(opts: {
  uid: string;
  type: ScheduledNotifType;
  title: string;
  channels: NotifChannel[];
  scheduledFor: Date;
  sourceKey: string;
  reminderId?: string;
  taskId?: string;
  eventId?: string;
  itemId?: string;
  petId?: string;
  medId?: string;
  householdId?: string;
  birthdayId?: string;
}): Promise<void> {
  if (!opts.channels.length) return;
  if (opts.scheduledFor.getTime() <= Date.now()) return;

  const db = admin.firestore();
  // Replace any existing unsent row with the same sourceKey
  const existing = await db
    .collection("scheduledNotifications")
    .where("uid", "==", opts.uid)
    .where("sourceKey", "==", opts.sourceKey)
    .where("sent", "==", false)
    .get();
  const batch = db.batch();
  existing.forEach((d) => batch.delete(d.ref));
  const ref = db.collection("scheduledNotifications").doc();
  batch.set(ref, {
    uid: opts.uid,
    type: opts.type,
    taskTitle: opts.title,
    channels: opts.channels,
    scheduledFor: admin.firestore.Timestamp.fromDate(opts.scheduledFor),
    sourceKey: opts.sourceKey,
    reminderId: opts.reminderId || null,
    taskId: opts.taskId || null,
    eventId: opts.eventId || null,
    itemId: opts.itemId || null,
    petId: opts.petId || null,
    medId: opts.medId || null,
    householdId: opts.householdId || null,
    birthdayId: opts.birthdayId || null,
    sent: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await batch.commit();
}

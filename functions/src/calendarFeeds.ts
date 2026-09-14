import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { randomBytes } from "crypto";

type IncomingEvent = {
  title: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
  uid?: string;
};

function unfoldIcs(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeIcs(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\");
}

function parseIcsDate(value: string): { iso: string; allDay: boolean } {
  const cleaned = value.replace(/^.*?:/, "").trim();
  if (/^\d{8}$/.test(cleaned)) {
    return { iso: `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00.000Z`, allDay: true };
  }
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!match) {
    const parsed = new Date(cleaned);
    return { iso: Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(), allDay: false };
  }
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${match[7] ? "Z" : ""}`;
  return { iso: new Date(iso).toISOString(), allDay: false };
}

export function parseIcsEvents(ics: string): IncomingEvent[] {
  const text = unfoldIcs(ics);
  return text.split("BEGIN:VEVENT").slice(1).map((block) => {
    const body = block.split("END:VEVENT")[0] || "";
    const field = (name: string) => {
      const line = body.split("\n").find((row) => row.startsWith(name));
      if (!line) return "";
      return unescapeIcs(line.slice(line.indexOf(":") + 1).trim());
    };
    const startRaw = body.split("\n").find((row) => row.startsWith("DTSTART")) || "";
    const endRaw = body.split("\n").find((row) => row.startsWith("DTEND")) || startRaw;
    const start = parseIcsDate(startRaw);
    const end = parseIcsDate(endRaw);
    return {
      title: field("SUMMARY") || "Untitled",
      description: field("DESCRIPTION") || "",
      location: field("LOCATION") || "",
      startDate: start.iso,
      endDate: end.iso,
      allDay: start.allDay,
      uid: field("UID") || undefined,
    };
  }).filter((event) => event.title);
}

function requireUser(auth?: { uid: string; token?: Record<string, unknown> }) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (auth.token?.deviceId) throw new HttpsError("permission-denied", "Displays cannot manage calendars.");
  return auth.uid;
}

function normalizeFeedUrl(url: string): string {
  const trimmed = url.trim();
  if (trimmed.startsWith("webcal://")) return `https://${trimmed.slice("webcal://".length)}`;
  if (!/^https:\/\//i.test(trimmed)) throw new HttpsError("invalid-argument", "Use an https or webcal calendar link.");
  return trimmed;
}

export const syncCalendarFeed = onCall({ maxInstances: 10 }, async (request) => {
  const uid = requireUser(request.auth);
  const feedId = String(request.data?.id || "").trim();
  const name = String(request.data?.name || "Calendar").trim();
  const url = normalizeFeedUrl(String(request.data?.url || ""));
  if (!feedId) throw new HttpsError("invalid-argument", "Missing feed id.");

  const response = await fetch(url, { headers: { Accept: "text/calendar, text/plain, */*" } });
  if (!response.ok) {
    throw new HttpsError("unavailable", `That calendar link returned ${response.status}.`);
  }
  const ics = await response.text();
  const incoming = parseIcsEvents(ics).slice(0, 200);
  const eventsCol = admin.firestore().collection("calendar").doc(uid).collection("events");
  const existing = await eventsCol.where("feedId", "==", feedId).get();
  const keep = new Set(incoming.map((event) => event.uid || `${event.startDate}|${event.title}`));

  const batch = admin.firestore().batch();
  let writes = 0;
  for (const event of incoming) {
    const key = event.uid || `${event.startDate}|${event.title}`;
    const ref = eventsCol.doc(`feed_${feedId}_${Buffer.from(key).toString("base64url").slice(0, 40)}`);
    batch.set(ref, {
      title: event.title,
      description: event.description || "",
      location: event.location || "",
      category: "other",
      startDate: event.startDate,
      endDate: event.endDate,
      allDay: event.allDay === true,
      source: "import",
      feedId,
      googleEventId: event.uid || null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    writes += 1;
  }
  existing.docs.forEach((doc) => {
    const key = String(doc.data().googleEventId || `${doc.data().startDate}|${doc.data().title}`);
    if (!keep.has(key)) batch.delete(doc.ref);
  });
  await batch.commit();

  const settingsRef = admin.firestore().doc(`calendar/${uid}/meta/settings`);
  const snap = await settingsRef.get();
  const feeds = Array.isArray(snap.data()?.feeds) ? snap.data()!.feeds : [];
  const nextFeeds = feeds.map((feed: { id?: string }) =>
    feed.id === feedId
      ? { ...feed, name, url, lastSyncAt: new Date().toISOString(), lastError: null }
      : feed,
  );
  await settingsRef.set({ feeds: nextFeeds, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return { upserted: writes };
});

export const publishMergedCalendar = onCall({ maxInstances: 5 }, async (request) => {
  const uid = requireUser(request.auth);
  const settingsRef = admin.firestore().doc(`calendar/${uid}/meta/settings`);
  const snap = await settingsRef.get();
  let token = String(snap.data()?.mergeShareToken || "");
  if (!token) {
    token = randomBytes(18).toString("hex");
    await settingsRef.set({ mergeShareToken: token, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }
  await admin.firestore().doc(`calendarFeedTokens/${token}`).set({ uid, updatedAt: FieldValue.serverTimestamp() });
  const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "hardyhub-7b30d";
  return {
    token,
    url: `https://us-central1-${project}.cloudfunctions.net/mergedCalendarIcs?token=${token}`,
  };
});

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function stamp(iso: string, allDay?: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return `:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `;VALUE=DATE:${y}${m}${d}`;
  }
  return `:${date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
}

function applyRules(events: Array<Record<string, unknown>>, rules: Record<string, unknown> | undefined) {
  const hideSources = new Set((rules?.hideSources as string[]) || []);
  const hideFeeds = new Set((rules?.hideFeedIds as string[]) || []);
  const needles = ((rules?.hideTitleContains as string[]) || []).map((item) => item.trim().toLowerCase()).filter(Boolean);
  const hideHolidays = rules?.hideAllDayHolidays === true;
  const hideDuplicates = rules?.hideDuplicates !== false;
  const holiday = /\b(holiday|bank holiday|public holiday|uk holidays?)\b/i;
  const filtered = events.filter((event) => {
    if (event.source && hideSources.has(String(event.source))) return false;
    if (event.feedId && hideFeeds.has(String(event.feedId))) return false;
    const title = String(event.title || "").toLowerCase();
    if (needles.some((needle) => title.includes(needle))) return false;
    if (hideHolidays && event.allDay && holiday.test(String(event.title || ""))) return false;
    return true;
  });
  if (!hideDuplicates) return filtered;
  const seen = new Set<string>();
  return filtered.filter((event) => {
    const day = String(event.startDate || "").slice(0, 10);
    const key = `${day}|${String(event.title || "").trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const mergedCalendarIcs = onRequest({ maxInstances: 10, cors: true }, async (req, res) => {
  const token = String(req.query.token || "").trim();
  if (!token) {
    res.status(400).send("Missing token");
    return;
  }
  const tokenSnap = await admin.firestore().doc(`calendarFeedTokens/${token}`).get();
  if (!tokenSnap.exists) {
    res.status(404).send("Unknown calendar");
    return;
  }
  const uid = String(tokenSnap.data()?.uid || "");
  const settingsSnap = await admin.firestore().doc(`calendar/${uid}/meta/settings`).get();
  if (settingsSnap.data()?.mergeShareToken !== token) {
    res.status(404).send("Unknown calendar");
    return;
  }
  const eventsSnap = await admin.firestore().collection("calendar").doc(uid).collection("events").get();
  const events = applyRules(eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })), settingsSnap.data()?.mergeRules);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hardy Hub//Merged Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Hardy Hub",
  ];
  for (const event of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${event.id || event.googleEventId || event.title}@hardyhub`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART${stamp(String(event.startDate), event.allDay === true)}`,
      `DTEND${stamp(String(event.endDate || event.startDate), event.allDay === true)}`,
      `SUMMARY:${escapeIcs(String(event.title || "Untitled"))}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(String(event.description))}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(String(event.location))}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  res.set("Content-Type", "text/calendar; charset=utf-8");
  res.set("Cache-Control", "public, max-age=300");
  res.status(200).send(lines.join("\r\n"));
});

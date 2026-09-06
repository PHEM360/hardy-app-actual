import { randomUUID } from "node:crypto";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  APP_HOST,
  GOOGLE_SECRET_OPTS,
  formPost,
  googleAuthUrl,
  loadGoogleCredentials,
} from "./googleOAuth";
import { googleCalendarDocId, mapGoogleCalendarEvent, toGoogleCalendarBody } from "./googleCalendarParse";

const CALLBACK = `${APP_HOST}/api/calendar/callback`;
const SCOPES = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email";

function db() {
  return admin.firestore();
}

function requireUid(auth?: { uid: string; token?: Record<string, unknown> }) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote displays cannot connect a calendar.");
  }
  return auth.uid;
}

async function requireCalendarAccess(uid: string, ownerUid: string, mode: "view" | "edit") {
  if (uid === ownerUid) return;
  const snap = await db().doc(`users/${uid}`).get();
  const data = snap.data() || {};
  const role = String(data.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  if (role === "admin" || role === "superadmin" || data.isAdmin === true || data.isSuperAdmin === true) return;
  const share = await db().doc(`pageShares/${ownerUid}_calendar_${uid}`).get();
  if (!share.exists) throw new HttpsError("permission-denied", "This calendar has not been shared with you.");
  if (mode === "edit" && share.data()?.permission !== "edit") {
    throw new HttpsError("permission-denied", "You can look, but you cannot change this calendar.");
  }
}

async function getTokens(uid: string) {
  const snap = await db().doc(`calendarSecrets/${uid}`).get();
  const data = snap.data();
  if (!data?.refreshToken && !data?.accessToken) {
    throw new HttpsError("failed-precondition", "Connect Google Calendar first.");
  }
  const expiresAt = Number(data.accessExpiresAt || 0);
  if (data.accessToken && expiresAt > Date.now() + 60_000) {
    return { accessToken: String(data.accessToken) };
  }
  if (!data.refreshToken) throw new HttpsError("failed-precondition", "Connect Google Calendar again.");
  const { clientId, clientSecret } = await loadGoogleCredentials();
  const token = await formPost("https://oauth2.googleapis.com/token", {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: String(data.refreshToken),
    grant_type: "refresh_token",
  });
  const accessToken = String(token.access_token || "");
  await snap.ref.set({
    accessToken,
    accessExpiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
    refreshToken: data.refreshToken,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { accessToken };
}

async function googleJson(accessToken: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    throw new HttpsError("internal", String((data.error as { message?: string } | undefined)?.message || "Google Calendar request failed."));
  }
  return data;
}

export const startGoogleCalendarConnect = onCall(GOOGLE_SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const { clientId } = await loadGoogleCredentials();
  const state = randomUUID();
  await db().doc(`calendarOAuth/${state}`).set({
    uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  return { authUrl: googleAuthUrl(clientId, CALLBACK, SCOPES, state) };
});

export const googleCalendarCallback = onRequest(GOOGLE_SECRET_OPTS, async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const fail = (reason: string) => res.redirect(`${APP_HOST}/calendar?gcal=error&reason=${encodeURIComponent(reason)}`);
  if (!code || !state) {
    fail("missing");
    return;
  }
  const stateSnap = await db().doc(`calendarOAuth/${state}`).get();
  const stateData = stateSnap.data();
  if (!stateSnap.exists || !stateData || Number(stateData.expiresAt || 0) < Date.now()) {
    fail("expired");
    return;
  }
  try {
    const { clientId, clientSecret } = await loadGoogleCredentials();
    const token = await formPost("https://oauth2.googleapis.com/token", {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: CALLBACK,
      grant_type: "authorization_code",
    });
    const accessToken = String(token.access_token || "");
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profile = await profileRes.json() as { email?: string };
    await db().doc(`calendarSecrets/${stateData.uid}`).set({
      accessToken,
      refreshToken: token.refresh_token || null,
      accessExpiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await db().doc(`calendar/${stateData.uid}/meta/settings`).set({
      google: {
        connected: true,
        email: profile.email || "",
        calendarId: "primary",
        selectedCalendarIds: ["primary"],
        lastError: null,
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await stateSnap.ref.delete();
    res.redirect(`${APP_HOST}/calendar?gcal=connected`);
  } catch (err) {
    logger.error("googleCalendarCallback failed", err);
    fail("token");
  }
});

export const listGoogleCalendars = onCall(GOOGLE_SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const owner = String(request.data?.ownerUid || uid);
  await requireCalendarAccess(uid, owner, "view");
  const { accessToken } = await getTokens(owner);
  const data = await googleJson(accessToken, "https://www.googleapis.com/calendar/v3/users/me/calendarList");
  const items = Array.isArray(data.items) ? data.items as Array<{ id?: string; summary?: string; primary?: boolean }> : [];
  return {
    calendars: items.map((item) => ({
      id: item.id || "",
      name: item.summary || item.id || "Calendar",
      primary: Boolean(item.primary),
    })).filter((item) => item.id),
  };
});

export const saveGoogleCalendarSelection = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const owner = String(request.data?.ownerUid || uid);
  await requireCalendarAccess(uid, owner, "edit");
  const selected = Array.isArray(request.data?.calendarIds)
    ? (request.data.calendarIds as unknown[]).map((item) => String(item)).filter(Boolean)
    : [];
  const writeId = String(request.data?.writeCalendarId || selected[0] || "primary");
  const settingsSnap = await db().doc(`calendar/${owner}/meta/settings`).get();
  await db().doc(`calendar/${owner}/meta/settings`).set({
    google: {
      ...(settingsSnap.data()?.google || {}),
      selectedCalendarIds: selected.length ? selected : ["primary"],
      calendarId: writeId,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

async function syncOwner(owner: string) {
  const settingsSnap = await db().doc(`calendar/${owner}/meta/settings`).get();
  const google = (settingsSnap.data()?.google || {}) as {
    selectedCalendarIds?: string[];
    calendarId?: string;
  };
  const calendarIds = google.selectedCalendarIds?.length ? google.selectedCalendarIds : [google.calendarId || "primary"];
  const { accessToken } = await getTokens(owner);
  const min = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const max = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let upserted = 0;
  const keep = new Set<string>();

  for (const calendarId of calendarIds) {
    let pageToken = "";
    do {
      const params = new URLSearchParams({
        singleEvents: "true",
        orderBy: "startTime",
        timeMin: min,
        timeMax: max,
        maxResults: "250",
      });
      if (pageToken) params.set("pageToken", pageToken);
      const data = await googleJson(
        accessToken,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      );
      const items = Array.isArray(data.items) ? data.items as Parameters<typeof mapGoogleCalendarEvent>[0][] : [];
      for (const item of items) {
        const mapped = mapGoogleCalendarEvent(item, calendarId);
        if (!mapped) continue;
        const docId = googleCalendarDocId(calendarId, mapped.googleEventId);
        keep.add(docId);
        await db().doc(`calendar/${owner}/events/${docId}`).set({
          ...mapped,
          createdBy: owner,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        upserted += 1;
      }
      pageToken = String(data.nextPageToken || "");
    } while (pageToken);
  }

  const existing = await db().collection(`calendar/${owner}/events`).where("source", "==", "google").get();
  const stale = existing.docs.filter((docSnap) => !keep.has(docSnap.id));
  for (const docSnap of stale) await docSnap.ref.delete();

  await db().doc(`calendar/${owner}/meta/settings`).set({
    google: {
      ...google,
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { upserted, removed: stale.length };
}

export const syncGoogleCalendar = onCall({ ...GOOGLE_SECRET_OPTS, timeoutSeconds: 180 }, async (request) => {
  const uid = requireUid(request.auth);
  const owner = String(request.data?.ownerUid || uid);
  await requireCalendarAccess(uid, owner, "edit");
  try {
    return await syncOwner(owner);
  } catch (err) {
    const settingsSnap = await db().doc(`calendar/${owner}/meta/settings`).get();
    await db().doc(`calendar/${owner}/meta/settings`).set({
      google: {
        ...(settingsSnap.data()?.google || {}),
        lastError: err instanceof Error ? err.message : "Sync failed",
      },
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    throw err;
  }
});

export const pushCalendarEvent = onCall(GOOGLE_SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const owner = String(request.data?.ownerUid || uid);
  await requireCalendarAccess(uid, owner, "edit");
  const eventId = String(request.data?.eventId || "");
  if (!eventId) throw new HttpsError("invalid-argument", "Missing event.");
  const eventSnap = await db().doc(`calendar/${owner}/events/${eventId}`).get();
  if (!eventSnap.exists) throw new HttpsError("not-found", "That event was not found.");
  const event = eventSnap.data() || {};
  const settings = (await db().doc(`calendar/${owner}/meta/settings`).get()).data()?.google as { calendarId?: string } | undefined;
  const calendarId = String(event.googleCalendarId || settings?.calendarId || "primary");
  const { accessToken } = await getTokens(owner);
  const body = toGoogleCalendarBody({
    title: String(event.title || ""),
    description: String(event.description || ""),
    location: String(event.location || ""),
    startDate: String(event.startDate || ""),
    endDate: String(event.endDate || ""),
    allDay: Boolean(event.allDay),
  });
  if (event.googleEventId) {
    await googleJson(
      accessToken,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(String(event.googleEventId))}`,
      { method: "PUT", body: JSON.stringify(body) },
    );
    return { googleEventId: String(event.googleEventId) };
  }
  const created = await googleJson(
    accessToken,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(body) },
  );
  const googleEventId = String(created.id || "");
  await eventSnap.ref.set({
    source: event.source || "local",
    googleEventId,
    googleCalendarId: calendarId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { googleEventId };
});

export const disconnectGoogleCalendar = onCall(GOOGLE_SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  await db().doc(`calendarSecrets/${uid}`).delete().catch(() => undefined);
  const settingsSnap = await db().doc(`calendar/${uid}/meta/settings`).get();
  await db().doc(`calendar/${uid}/meta/settings`).set({
    google: {
      ...(settingsSnap.data()?.google || {}),
      connected: false,
      email: "",
      lastError: null,
    },
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

export const processGoogleCalendarSync = onSchedule(
  {
    schedule: "every 15 minutes",
    timeoutSeconds: 240,
    secrets: GOOGLE_SECRET_OPTS.secrets,
  },
  async () => {
    const secrets = await db().collection("calendarSecrets").limit(40).get();
    for (const secret of secrets.docs) {
      try {
        await syncOwner(secret.id);
      } catch (err) {
        logger.warn("calendar sync skipped", { uid: secret.id, err });
      }
    }
  },
);

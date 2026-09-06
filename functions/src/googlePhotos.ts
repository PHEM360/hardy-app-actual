import { randomUUID } from "node:crypto";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  extractGooglePhotosFromHtml,
  googlePhotosMediaId,
  googlePhotosShareLooksPrivate,
  isGooglePhotosShareUrl,
  sizedGooglePhotoUrl,
} from "./googlePhotosAlbum";
import {
  APP_HOST,
  GOOGLE_SECRET_OPTS,
  formPost,
  googleAuthUrl,
  loadGoogleCredentials,
} from "./googleOAuth";

const CALLBACK = `${APP_HOST}/api/google-photos/callback`;
const SCOPES = "https://www.googleapis.com/auth/photospicker.mediaitems.readonly https://www.googleapis.com/auth/userinfo.email";
const SECRET_OPTS = GOOGLE_SECRET_OPTS;

function db() {
  return admin.firestore();
}

function requireUid(auth?: { uid: string; token?: Record<string, unknown> }) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote displays cannot connect Google Photos.");
  }
  return auth.uid;
}

async function credentials() {
  return loadGoogleCredentials();
}

async function getTokens(uid: string) {
  const snap = await db().doc(`photosSecrets/${uid}`).get();
  const data = snap.data();
  if (!data?.refreshToken && !data?.accessToken) {
    throw new HttpsError("failed-precondition", "Link Google Photos first.");
  }
  const expiresAt = Number(data.accessExpiresAt || 0);
  if (data.accessToken && expiresAt > Date.now() + 60_000) {
    return { accessToken: String(data.accessToken), refreshToken: String(data.refreshToken || "") };
  }
  if (!data.refreshToken) throw new HttpsError("failed-precondition", "Link Google Photos again.");
  const { clientId, clientSecret } = await credentials();
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
  return { accessToken, refreshToken: String(data.refreshToken) };
}

async function requireOwnAlbum(uid: string, albumId: string) {
  if (!albumId) throw new HttpsError("invalid-argument", "Open an album first.");
  const albumSnap = await db().doc(`photos/${uid}/albums/${albumId}`).get();
  if (!albumSnap.exists) throw new HttpsError("not-found", "That album was not found.");
  return albumSnap;
}

function proxyUrl(uid: string, mediaId: string, token: string) {
  return `${APP_HOST}/api/gphotos-photo?o=${encodeURIComponent(uid)}&f=${encodeURIComponent(mediaId)}&t=${token}`;
}

async function addSharedPhoto(uid: string, albumId: string, sourceUrl: string, caption: string) {
  const mediaId = googlePhotosMediaId(sourceUrl);
  const token = randomUUID();
  await db().collection(`photos/${uid}/albums/${albumId}/items`).add({
    ownerId: uid,
    albumId,
    url: proxyUrl(uid, mediaId, token),
    storagePath: "",
    caption,
    source: "gphotos",
    googlePhotosId: mediaId,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await db().doc(`photos/${uid}/gphotosFiles/${mediaId}`).set({
    token,
    albumId,
    kind: "share",
    sourceUrl,
  });
}

async function knownGooglePhotoIds(uid: string, albumId: string) {
  const existing = await db().collection(`photos/${uid}/albums/${albumId}/items`).get();
  return new Set(existing.docs.map((item) => String(item.data().googlePhotosId || "")));
}

export const startGooglePhotosConnect = onCall(SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const { clientId } = await credentials();
  const state = randomUUID();
  await db().doc(`googlePhotosOAuth/${state}`).set({
    uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  return { authUrl: googleAuthUrl(clientId, CALLBACK, SCOPES, state) };
});

export const googlePhotosCallback = onRequest(SECRET_OPTS, async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const fail = (reason: string) => res.redirect(`${APP_HOST}/photos?gphotos=error&reason=${encodeURIComponent(reason)}`);
  if (!code || !state) {
    fail("missing");
    return;
  }
  const stateSnap = await db().doc(`googlePhotosOAuth/${state}`).get();
  const stateData = stateSnap.data();
  if (!stateSnap.exists || !stateData) {
    fail("expired");
    return;
  }
  if (Number(stateData.expiresAt || 0) < Date.now()) {
    await stateSnap.ref.delete();
    fail("expired");
    return;
  }
  try {
    const { clientId, clientSecret } = await credentials();
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
    await db().doc(`photosSecrets/${stateData.uid}`).set({
      accessToken,
      refreshToken: token.refresh_token || null,
      accessExpiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await db().doc(`photos/${stateData.uid}/settings/photos`).set({
      connected: true,
      email: profile.email || "",
      lastError: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await stateSnap.ref.delete();
    res.redirect(`${APP_HOST}/photos?gphotos=connected`);
  } catch (err) {
    logger.error("googlePhotosCallback failed", err);
    fail("token");
  }
});

export const startGooglePhotosPicker = onCall(SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const albumId = String(request.data?.albumId || "");
  await requireOwnAlbum(uid, albumId);
  const { accessToken } = await getTokens(uid);
  const response = await fetch("https://photospicker.googleapis.com/v1/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const data = await response.json() as { id?: string; pickerUri?: string; error?: { message?: string } };
  if (!response.ok || !data.id || !data.pickerUri) {
    logger.error("Photos picker session failed", { status: response.status, data });
    throw new HttpsError("internal", data.error?.message || "Could not open Google Photos.");
  }
  const pickerUri = data.pickerUri.endsWith("/autoclose") ? data.pickerUri : `${data.pickerUri.replace(/\/$/, "")}/autoclose`;
  return { sessionId: data.id, pickerUri };
});

export const pollGooglePhotosPicker = onCall({ ...SECRET_OPTS, timeoutSeconds: 180 }, async (request) => {
  const uid = requireUid(request.auth);
  const albumId = String(request.data?.albumId || "");
  const sessionId = String(request.data?.sessionId || "");
  if (!sessionId) throw new HttpsError("invalid-argument", "Missing Photos session.");
  const albumSnap = await requireOwnAlbum(uid, albumId);
  const { accessToken } = await getTokens(uid);
  const sessionRes = await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const session = await sessionRes.json() as { mediaItemsSet?: boolean; error?: { message?: string } };
  if (!sessionRes.ok) {
    throw new HttpsError("internal", session.error?.message || "Could not check Google Photos.");
  }
  if (!session.mediaItemsSet) return { done: false, added: 0 };

  const known = await knownGooglePhotoIds(uid, albumId);
  let added = 0;
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      sessionId,
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const listRes = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const list = await listRes.json() as {
      mediaItems?: PickerMediaItem[];
      nextPageToken?: string;
      error?: { message?: string };
    };
    if (!listRes.ok) throw new HttpsError("internal", list.error?.message || "Could not read the photos you picked.");
    for (const item of list.mediaItems || []) {
      if ((item.type || "PHOTO") === "VIDEO") continue;
      const mediaId = String(item.id || "");
      const baseUrl = item.mediaFile?.baseUrl;
      if (!mediaId || !baseUrl || known.has(mediaId)) continue;
      const caption = item.mediaFile?.filename || "";
      const stored = await storePickerPhoto(uid, albumId, mediaId, baseUrl, accessToken, caption);
      if (stored) {
        known.add(mediaId);
        added += 1;
      }
    }
    pageToken = list.nextPageToken || "";
  } while (pageToken);

  await albumSnap.ref.set({
    googlePhotosLinked: true,
    lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { done: true, added };
});

type PickerMediaItem = {
  id?: string;
  type?: string;
  mediaFile?: { baseUrl?: string; filename?: string; mimeType?: string };
};

async function storePickerPhoto(
  uid: string,
  albumId: string,
  mediaId: string,
  baseUrl: string,
  accessToken: string,
  caption: string,
) {
  const imageUrl = `${baseUrl}=w2048-h2048`;
  const fileRes = await fetch(imageUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!fileRes.ok) {
    logger.warn("Picker photo download failed", { mediaId, status: fileRes.status });
    return false;
  }
  const buffer = Buffer.from(await fileRes.arrayBuffer());
  const token = randomUUID();
  const safeId = mediaId.replace(/[^\w.-]+/g, "_").slice(0, 80);
  const path = `photos/${uid}/${albumId}/gphotos-${safeId}.jpg`;
  try {
    const file = admin.storage().bucket().file(path);
    await file.save(buffer, {
      contentType: fileRes.headers.get("content-type") || "image/jpeg",
      metadata: { metadata: { firebaseStorageDownloadTokens: token } },
    });
    const url = `https://firebasestorage.googleapis.com/v0/b/${file.bucket.name}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
    await db().collection(`photos/${uid}/albums/${albumId}/items`).add({
      ownerId: uid,
      albumId,
      url,
      storagePath: path,
      caption,
      source: "gphotos",
      googlePhotosId: mediaId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return true;
  } catch (err) {
    logger.warn("Picker photo storage failed, using proxy", err);
    await db().collection(`photos/${uid}/albums/${albumId}/items`).add({
      ownerId: uid,
      albumId,
      url: proxyUrl(uid, mediaId, token),
      storagePath: "",
      caption,
      source: "gphotos",
      googlePhotosId: mediaId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    await db().doc(`photos/${uid}/gphotosFiles/${mediaId}`).set({
      token,
      albumId,
      kind: "picker",
      sourceUrl: imageUrl,
    });
    return true;
  }
}

export const syncGooglePhotosAlbum = onCall({ timeoutSeconds: 180 }, async (request) => {
  const uid = requireUid(request.auth);
  const albumId = String(request.data?.albumId || "");
  const shareUrl = String(request.data?.shareUrl || "").trim();
  const albumSnap = await requireOwnAlbum(uid, albumId);
  const storedUrl = String(albumSnap.data()?.googlePhotosShareUrl || "");
  const target = shareUrl || storedUrl;
  if (!target || !isGooglePhotosShareUrl(target)) {
    throw new HttpsError("invalid-argument", "Paste a Google Photos shared album link.");
  }
  const fetched = await fetch(target, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html",
    },
  });
  if (!fetched.ok) {
    throw new HttpsError("failed-precondition", "Could not open that Google Photos album.");
  }
  const html = await fetched.text();
  if (googlePhotosShareLooksPrivate(html)) {
    throw new HttpsError(
      "failed-precondition",
      "That album is still private. Use Choose from Google Photos and search the album name, or in Google Photos tap Share and create a link anyone can view.",
    );
  }
  const parsed = extractGooglePhotosFromHtml(html);
  if (!parsed.urls.length) {
    throw new HttpsError(
      "failed-precondition",
      "Google did not include the pictures in that link. Use Choose from Google Photos, search the album name, select the photos, then Done.",
    );
  }
  const known = await knownGooglePhotoIds(uid, albumId);
  let added = 0;
  for (const url of parsed.urls) {
    const mediaId = googlePhotosMediaId(url);
    if (known.has(mediaId)) continue;
    await addSharedPhoto(uid, albumId, sizedGooglePhotoUrl(url), "");
    known.add(mediaId);
    added += 1;
  }
  await albumSnap.ref.set({
    googlePhotosShareUrl: fetched.url || target,
    googlePhotosAlbumName: parsed.title,
    lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { added, title: parsed.title, total: parsed.urls.length };
});

export const disconnectGooglePhotos = onCall(SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  await db().doc(`photosSecrets/${uid}`).delete().catch(() => undefined);
  await db().doc(`photos/${uid}/settings/photos`).set({
    connected: false,
    email: "",
    lastError: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

export const gphotosPhoto = onRequest({ cors: true, ...SECRET_OPTS }, async (req, res) => {
  const ownerId = String(req.query.o || "");
  const fileId = String(req.query.f || "");
  const token = String(req.query.t || "");
  if (!ownerId || !fileId || !token) {
    res.status(400).send("Missing photo");
    return;
  }
  const lookup = await db().doc(`photos/${ownerId}/gphotosFiles/${fileId}`).get();
  if (!lookup.exists || String(lookup.data()?.token || "") !== token) {
    res.status(404).send("Photo not found");
    return;
  }
  const sourceUrl = String(lookup.data()?.sourceUrl || "");
  if (!sourceUrl) {
    res.status(404).send("Photo not found");
    return;
  }
  try {
    const headers: Record<string, string> = {};
    if (lookup.data()?.kind === "picker") {
      try {
        const { accessToken } = await getTokens(ownerId);
        headers.Authorization = `Bearer ${accessToken}`;
      } catch {
        // Shared-style URLs still work without a token.
      }
    }
    const fileRes = await fetch(sourceUrl, { headers });
    if (!fileRes.ok) {
      res.status(fileRes.status).send("Google Photos file unavailable");
      return;
    }
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Content-Type", fileRes.headers.get("content-type") || "image/jpeg");
    res.status(200).send(Buffer.from(await fileRes.arrayBuffer()));
  } catch (err) {
    logger.error("gphotosPhoto failed", err);
    res.status(502).send("Could not load Google Photos picture");
  }
});

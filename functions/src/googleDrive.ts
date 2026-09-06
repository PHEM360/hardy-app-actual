import { randomUUID } from "node:crypto";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {
  APP_HOST,
  GOOGLE_SECRET_OPTS,
  formPost,
  googleAuthUrl,
  loadGoogleCredentials,
} from "./googleOAuth";

const CALLBACK = `${APP_HOST}/api/google-drive/callback`;
const SCOPES = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email";
const SECRET_OPTS = GOOGLE_SECRET_OPTS;

function db() {
  return admin.firestore();
}

function requireUid(auth?: { uid: string; token?: Record<string, unknown> }) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote displays cannot connect Google Drive.");
  }
  return auth.uid;
}

async function credentials() {
  return loadGoogleCredentials();
}

async function getTokens(uid: string) {
  const snap = await db().doc(`driveSecrets/${uid}`).get();
  const data = snap.data();
  if (!data?.refreshToken && !data?.accessToken) {
    throw new HttpsError("failed-precondition", "Link Google Drive first.");
  }
  const expiresAt = Number(data.accessExpiresAt || 0);
  if (data.accessToken && expiresAt > Date.now() + 60_000) {
    return { accessToken: String(data.accessToken), refreshToken: String(data.refreshToken || "") };
  }
  if (!data.refreshToken) throw new HttpsError("failed-precondition", "Link Google Drive again.");
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

export const startGoogleDriveConnect = onCall(SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const { clientId } = await credentials();
  const state = randomUUID();
  await db().doc(`googleDriveOAuth/${state}`).set({
    uid,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  return { authUrl: googleAuthUrl(clientId, CALLBACK, SCOPES, state) };
});

export const googleDriveCallback = onRequest(SECRET_OPTS, async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const fail = (reason: string) => res.redirect(`${APP_HOST}/photos?drive=error&reason=${encodeURIComponent(reason)}`);
  if (!code || !state) {
    fail("missing");
    return;
  }
  const stateSnap = await db().doc(`googleDriveOAuth/${state}`).get();
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
    await db().doc(`driveSecrets/${stateData.uid}`).set({
      accessToken,
      refreshToken: token.refresh_token || null,
      accessExpiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await db().doc(`photos/${stateData.uid}/settings/drive`).set({
      connected: true,
      email: profile.email || "",
      lastError: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    await stateSnap.ref.delete();
    res.redirect(`${APP_HOST}/photos?drive=connected`);
  } catch (err) {
    logger.error("googleDriveCallback failed", err);
    fail("token");
  }
});

export const listGoogleDriveFolders = onCall(SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const { accessToken } = await getTokens(uid);
  const folders: { id: string; name: string }[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: "mimeType = 'application/vnd.google-apps.folder' and trashed = false",
      fields: "nextPageToken,files(id,name)",
      pageSize: "100",
      orderBy: "name",
      spaces: "drive",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as { files?: { id: string; name: string }[]; nextPageToken?: string };
    if (!response.ok) throw new HttpsError("internal", "Could not list Drive folders.");
    folders.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken && folders.length < 400);
  return { folders };
});

export const syncGoogleDriveAlbum = onCall({ ...SECRET_OPTS, timeoutSeconds: 180 }, async (request) => {
  const uid = requireUid(request.auth);
  const albumId = String(request.data?.albumId || "");
  const folderId = String(request.data?.folderId || "");
  const folderName = String(request.data?.folderName || "Drive folder");
  if (!albumId || !folderId) throw new HttpsError("invalid-argument", "Pick an album and a Drive folder.");
  const albumSnap = await db().doc(`photos/${uid}/albums/${albumId}`).get();
  if (!albumSnap.exists) throw new HttpsError("not-found", "That album was not found.");
  const { accessToken } = await getTokens(uid);
  const existing = await db().collection(`photos/${uid}/albums/${albumId}/items`).get();
  const known = new Set(existing.docs.map((item) => String(item.data().driveFileId || "")));
  let added = 0;
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: `'${folderId.replace(/'/g, "\\'")}' in parents and mimeType contains 'image/' and trashed = false`,
      fields: "nextPageToken,files(id,name,thumbnailLink,webContentLink)",
      pageSize: "100",
      spaces: "drive",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json() as {
      files?: { id: string; name?: string; thumbnailLink?: string; webContentLink?: string }[];
      nextPageToken?: string;
    };
    if (!response.ok) throw new HttpsError("internal", "Could not read that Drive folder.");
    for (const file of data.files || []) {
      if (known.has(file.id)) continue;
      const token = randomUUID();
      const url = `${APP_HOST}/api/drive-photo?o=${encodeURIComponent(uid)}&f=${encodeURIComponent(file.id)}&t=${token}`;
      await db().collection(`photos/${uid}/albums/${albumId}/items`).add({
        ownerId: uid,
        albumId,
        url,
        storagePath: "",
        caption: file.name || "",
        source: "drive",
        driveFileId: file.id,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      await db().doc(`photos/${uid}/driveFiles/${file.id}`).set({
        token,
        albumId,
        fileId: file.id,
      });
      known.add(file.id);
      added += 1;
    }
    pageToken = data.nextPageToken || "";
  } while (pageToken);
  await albumSnap.ref.set({
    driveFolderId: folderId,
    driveFolderName: folderName,
    lastSyncedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { added };
});

export const disconnectGoogleDrive = onCall(SECRET_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  await db().doc(`driveSecrets/${uid}`).delete().catch(() => undefined);
  await db().doc(`photos/${uid}/settings/drive`).set({
    connected: false,
    email: "",
    lastError: null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return { ok: true };
});

export const drivePhoto = onRequest({ ...SECRET_OPTS, cors: true }, async (req, res) => {
  const ownerId = String(req.query.o || "");
  const fileId = String(req.query.f || "");
  const token = String(req.query.t || "");
  if (!ownerId || !fileId || !token) {
    res.status(400).send("Missing photo");
    return;
  }
  const lookup = await db().doc(`photos/${ownerId}/driveFiles/${fileId}`).get();
  if (!lookup.exists || String(lookup.data()?.token || "") !== token) {
    res.status(404).send("Photo not found");
    return;
  }
  try {
    const { accessToken } = await getTokens(ownerId);
    const fileRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!fileRes.ok) {
      res.status(fileRes.status).send("Drive file unavailable");
      return;
    }
    res.set("Cache-Control", "public, max-age=86400");
    res.set("Content-Type", fileRes.headers.get("content-type") || "image/jpeg");
    const buffer = Buffer.from(await fileRes.arrayBuffer());
    res.status(200).send(buffer);
  } catch (err) {
    logger.error("drivePhoto failed", err);
    res.status(502).send("Could not load Drive photo");
  }
});

/**
 * Google Drive connect + picture album sync (bidirectional deletes/imports).
 * Secrets: GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET
 */

import { createHash, randomBytes } from "node:crypto";
import { onCall, onRequest, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

const clientIdSecret = defineSecret("GOOGLE_DRIVE_CLIENT_ID");
const clientSecretSecret = defineSecret("GOOGLE_DRIVE_CLIENT_SECRET");

const APP_HOST = "https://hardyhub-7b30d.web.app";
const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");
const ROOT_NAME = "Hardy Hub Pictures";
const CALL_OPTS = { secrets: [clientIdSecret, clientSecretSecret], timeoutSeconds: 180 };

function firestore() {
  return admin.firestore();
}

function uidOf(auth?: { uid: string; token?: Record<string, unknown> }) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Sign in required.");
  if (auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote displays cannot manage pictures.");
  }
  return auth.uid;
}

function oauthCreds() {
  const clientId = clientIdSecret.value();
  const clientSecret = clientSecretSecret.value();
  if (!clientId || !clientSecret) {
    throw new HttpsError(
      "failed-precondition",
      "Google Drive is not configured. Set GOOGLE_DRIVE_CLIENT_ID and GOOGLE_DRIVE_CLIENT_SECRET.",
    );
  }
  return { clientId, clientSecret };
}

function callbackUri() {
  return `${APP_HOST}/api/google-drive/callback`;
}

function tokensDoc(uid: string) {
  return firestore().doc(`users/${uid}/secrets/googleDrive`);
}

function integrationDoc(uid: string) {
  return firestore().doc(`users/${uid}/integrations/googleDrive`);
}

async function getAccessToken(uid: string): Promise<string> {
  const snap = await tokensDoc(uid).get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "Connect Google Drive first.");
  const data = snap.data() || {};
  if (data.accessToken && Date.now() < Number(data.expiresAtMs || 0) - 60_000) {
    return String(data.accessToken);
  }
  const refreshToken = String(data.refreshToken || "");
  if (!refreshToken) throw new HttpsError("failed-precondition", "Reconnect Google Drive.");
  const { clientId, clientSecret } = oauthCreds();
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    logger.error("refresh failed", await res.text());
    throw new HttpsError("unauthenticated", "Google Drive session expired — reconnect.");
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  await tokensDoc(uid).set(
    {
      accessToken: json.access_token,
      expiresAtMs: Date.now() + json.expires_in * 1000,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return json.access_token;
}

async function driveApi(uid: string, path: string, init: RequestInit = {}) {
  const access = await getAccessToken(uid);
  return fetch(`https://www.googleapis.com/drive/v3/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${access}`, ...(init.headers || {}) },
  });
}

async function ensureRoot(uid: string): Promise<string> {
  const integ = await integrationDoc(uid).get();
  if (integ.data()?.rootFolderId) return String(integ.data()!.rootFolderId);
  const q = encodeURIComponent(
    `name='${ROOT_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
  );
  const list = await driveApi(uid, `files?q=${q}&fields=files(id)`);
  const files = ((await list.json()) as { files?: Array<{ id: string }> }).files || [];
  let id = files[0]?.id;
  if (!id) {
    const created = await driveApi(uid, "files?fields=id", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: ROOT_NAME, mimeType: "application/vnd.google-apps.folder" }),
    });
    if (!created.ok) throw new HttpsError("internal", "Could not create Drive root folder.");
    id = ((await created.json()) as { id: string }).id;
  }
  await integrationDoc(uid).set({ rootFolderId: id, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return id!;
}

async function ensureAlbumFolder(uid: string, albumId: string, name: string): Promise<string> {
  const ref = firestore().doc(`pictureAlbums/${albumId}`);
  const snap = await ref.get();
  if (snap.data()?.driveFolderId) return String(snap.data()!.driveFolderId);
  const root = await ensureRoot(uid);
  const created = await driveApi(uid, "files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: name || "Album",
      mimeType: "application/vnd.google-apps.folder",
      parents: [root],
    }),
  });
  if (!created.ok) throw new HttpsError("internal", "Could not create album folder.");
  const folderId = ((await created.json()) as { id: string }).id;
  await ref.set({ driveFolderId: folderId, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  return folderId;
}

async function assertAlbumAccess(uid: string, albumId: string, needEdit: boolean) {
  const snap = await firestore().doc(`pictureAlbums/${albumId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Album not found.");
  const data = snap.data() || {};
  if (data.ownerId === uid) return data;
  const shares = Array.isArray(data.shares) ? data.shares : [];
  const mine = shares.find((s: { uid?: string; permission?: string }) => s.uid === uid);
  if (!mine) throw new HttpsError("permission-denied", "No access to this album.");
  if (needEdit && mine.permission !== "edit") {
    throw new HttpsError("permission-denied", "View-only access.");
  }
  return data;
}

export const startGoogleDriveConnect = onCall(CALL_OPTS, async (req) => {
  const uid = uidOf(req.auth);
  const { clientId } = oauthCreds();
  const state = randomBytes(24).toString("hex");
  await firestore().doc(`googleDriveOAuthStates/${state}`).set({
    uid,
    createdAt: FieldValue.serverTimestamp(),
  });
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUri(),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return { url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` };
});

export const googleDriveOAuthCallback = onRequest(CALL_OPTS, async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const state = String(req.query.state || "");
    if (!code || !state) {
      res.status(400).send("Missing code/state");
      return;
    }
    const stateRef = firestore().doc(`googleDriveOAuthStates/${state}`);
    const stateSnap = await stateRef.get();
    if (!stateSnap.exists) {
      res.status(400).send("Invalid state");
      return;
    }
    const uid = String(stateSnap.data()?.uid || "");
    await stateRef.delete();

    const { clientId, clientSecret } = oauthCreds();
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUri(),
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) {
      logger.error("exchange failed", await tokenRes.text());
      res.redirect(`${APP_HOST}/pictures?drive=error`);
      return;
    }
    const tokens = (await tokenRes.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope?: string;
    };

    let email: string | null = null;
    try {
      const info = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (info.ok) email = ((await info.json()) as { email?: string }).email || null;
    } catch {
      /* ignore */
    }

    const patch: Record<string, unknown> = {
      accessToken: tokens.access_token,
      expiresAtMs: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope || SCOPES,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (tokens.refresh_token) patch.refreshToken = tokens.refresh_token;
    await tokensDoc(uid).set(patch, { merge: true });
    await integrationDoc(uid).set(
      { connected: true, email, updatedAt: FieldValue.serverTimestamp() },
      { merge: true },
    );
    try {
      await ensureRoot(uid);
    } catch (err) {
      logger.error("ensureRoot failed", err);
    }
    res.redirect(`${APP_HOST}/pictures?drive=connected`);
  } catch (err) {
    logger.error("oauth callback failed", err);
    res.redirect(`${APP_HOST}/pictures?drive=error`);
  }
});

export const disconnectGoogleDrive = onCall(CALL_OPTS, async (req) => {
  const uid = uidOf(req.auth);
  await tokensDoc(uid).delete().catch(() => undefined);
  await integrationDoc(uid).set(
    {
      connected: false,
      email: null,
      rootFolderId: null,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { ok: true };
});

export const createPictureAlbum = onCall(CALL_OPTS, async (req) => {
  const uid = uidOf(req.auth);
  const name = String(req.data?.name || "New album").trim() || "New album";
  const visibility = req.data?.visibility === "shared" ? "shared" : "private";
  const ref = firestore().collection("pictureAlbums").doc();
  await ref.set({
    ownerId: uid,
    name,
    description: "",
    visibility,
    shares: [],
    shareUids: [],
    driveFolderId: null,
    coverPhotoId: null,
    coverUrl: null,
    photoCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  try {
    const integ = await integrationDoc(uid).get();
    if (integ.data()?.connected) await ensureAlbumFolder(uid, ref.id, name);
  } catch (err) {
    logger.warn("album folder deferred", err);
  }
  return { albumId: ref.id };
});

export const updatePictureAlbum = onCall(async (req) => {
  const uid = uidOf(req.auth);
  const albumId = String(req.data?.albumId || "");
  if (!albumId) throw new HttpsError("invalid-argument", "albumId required");
  const album = await assertAlbumAccess(uid, albumId, true);
  if (album.ownerId !== uid && req.data?.shares) {
    throw new HttpsError("permission-denied", "Only the owner can change sharing.");
  }
  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (typeof req.data?.name === "string") patch.name = req.data.name.trim() || "Album";
  if (typeof req.data?.description === "string") patch.description = req.data.description;
  if (req.data?.visibility === "private" || req.data?.visibility === "shared") {
    patch.visibility = req.data.visibility;
  }
  if (Array.isArray(req.data?.shares)) {
    const shares = req.data.shares
      .map((s: { uid?: string; permission?: string }) => ({
        uid: String(s.uid || ""),
        permission: s.permission === "edit" ? "edit" : "view",
      }))
      .filter((s: { uid: string }) => !!s.uid && s.uid !== uid);
    patch.shares = shares;
    patch.shareUids = shares.map((s: { uid: string }) => s.uid);
    patch.visibility = shares.length ? "shared" : "private";
  }
  await firestore().doc(`pictureAlbums/${albumId}`).set(patch, { merge: true });
  return { ok: true };
});

export const deletePictureAlbum = onCall(CALL_OPTS, async (req) => {
  const uid = uidOf(req.auth);
  const albumId = String(req.data?.albumId || "");
  const album = await assertAlbumAccess(uid, albumId, true);
  if (album.ownerId !== uid) {
    throw new HttpsError("permission-denied", "Only the owner can delete an album.");
  }
  const photos = await firestore().collection(`pictureAlbums/${albumId}/photos`).get();
  for (let i = 0; i < photos.docs.length; i += 400) {
    const batch = firestore().batch();
    photos.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
  if (album.driveFolderId) {
    try {
      await driveApi(uid, `files/${album.driveFolderId}`, { method: "DELETE" });
    } catch (err) {
      logger.warn("folder delete failed", err);
    }
  }
  await firestore().doc(`pictureAlbums/${albumId}`).delete();
  return { ok: true };
});

export const uploadPicturePhotos = onCall(CALL_OPTS, async (req) => {
  const uid = uidOf(req.auth);
  const albumId = String(req.data?.albumId || "");
  const name = String(req.data?.name || "Photo");
  const mimeType = String(req.data?.mimeType || "image/jpeg");
  const sizeBytes = Number(req.data?.sizeBytes) || 0;
  const storagePath = String(req.data?.storagePath || "");
  const url = String(req.data?.url || "");
  if (!albumId || !storagePath || !url) {
    throw new HttpsError("invalid-argument", "Missing photo fields");
  }
  await assertAlbumAccess(uid, albumId, true);

  let driveFileId: string | null = null;
  try {
    const integ = await integrationDoc(uid).get();
    if (integ.data()?.connected) {
      const albumSnap = await firestore().doc(`pictureAlbums/${albumId}`).get();
      const folderId = await ensureAlbumFolder(uid, albumId, String(albumSnap.data()?.name || "Album"));
      const [buf] = await admin.storage().bucket().file(storagePath).download();
      const boundary = `hh_${createHash("sha1").update(String(Date.now())).digest("hex").slice(0, 10)}`;
      const meta = JSON.stringify({ name, parents: [folderId] });
      const body = Buffer.concat([
        Buffer.from(
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
            `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
        ),
        buf,
        Buffer.from(`\r\n--${boundary}--`),
      ]);
      const access = await getAccessToken(uid);
      const up = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${access}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        },
      );
      if (up.ok) driveFileId = ((await up.json()) as { id?: string }).id || null;
      else logger.warn("drive upload failed", await up.text());
    }
  } catch (err) {
    logger.warn("drive upload skipped", err);
  }

  const photoRef = firestore().collection(`pictureAlbums/${albumId}/photos`).doc();
  await photoRef.set({
    albumId,
    ownerId: uid,
    name,
    mimeType,
    sizeBytes,
    storagePath,
    url,
    driveFileId,
    thumbnailUrl: url,
    uploadedBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  await firestore().doc(`pictureAlbums/${albumId}`).set(
    {
      photoCount: FieldValue.increment(1),
      coverPhotoId: photoRef.id,
      coverUrl: url,
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return { photoId: photoRef.id, driveFileId };
});

export const deletePicturePhoto = onCall(CALL_OPTS, async (req) => {
  const uid = uidOf(req.auth);
  const albumId = String(req.data?.albumId || "");
  const photoId = String(req.data?.photoId || "");
  await assertAlbumAccess(uid, albumId, true);
  const photoRef = firestore().doc(`pictureAlbums/${albumId}/photos/${photoId}`);
  const snap = await photoRef.get();
  if (!snap.exists) return { ok: true };
  const data = snap.data() || {};
  if (data.driveFileId) {
    try {
      await driveApi(uid, `files/${data.driveFileId}`, { method: "DELETE" });
    } catch (err) {
      logger.warn("drive file delete failed", err);
    }
  }
  if (data.storagePath) {
    try {
      await admin.storage().bucket().file(String(data.storagePath)).delete({ ignoreNotFound: true });
    } catch {
      /* ignore */
    }
  }
  await photoRef.delete();
  await firestore().doc(`pictureAlbums/${albumId}`).set(
    { photoCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  return { ok: true };
});

async function syncAlbum(uid: string, albumId: string) {
  const albumRef = firestore().doc(`pictureAlbums/${albumId}`);
  const albumSnap = await albumRef.get();
  if (!albumSnap.exists || albumSnap.data()?.ownerId !== uid) return;
  const album = albumSnap.data() || {};
  const folderId =
    album.driveFolderId || (await ensureAlbumFolder(uid, albumId, String(album.name || "Album")));
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  const list = await driveApi(
    uid,
    `files?q=${q}&fields=files(id,name,mimeType,size,thumbnailLink,webContentLink)&pageSize=200`,
  );
  if (!list.ok) {
    logger.warn("list failed", await list.text());
    return;
  }
  const files = ((await list.json()) as { files?: Array<Record<string, string>> }).files || [];
  const images = files.filter((f) => String(f.mimeType || "").startsWith("image/"));
  const existing = await firestore().collection(`pictureAlbums/${albumId}/photos`).get();
  const byDrive = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  existing.docs.forEach((d) => {
    const id = d.data().driveFileId;
    if (id) byDrive.set(String(id), d);
  });
  const seen = new Set<string>();
  for (const f of images) {
    seen.add(f.id);
    if (byDrive.has(f.id)) continue;
    await firestore().collection(`pictureAlbums/${albumId}/photos`).add({
      albumId,
      ownerId: uid,
      name: f.name || "Photo",
      mimeType: f.mimeType || "image/jpeg",
      sizeBytes: Number(f.size) || 0,
      driveFileId: f.id,
      storagePath: null,
      url: f.thumbnailLink || f.webContentLink || "",
      thumbnailUrl: f.thumbnailLink || null,
      uploadedBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      source: "drive",
    });
  }
  for (const [driveId, docSnap] of byDrive) {
    if (seen.has(driveId)) continue;
    const storagePath = docSnap.data().storagePath;
    if (storagePath) {
      try {
        await admin.storage().bucket().file(String(storagePath)).delete({ ignoreNotFound: true });
      } catch {
        /* ignore */
      }
    }
    await docSnap.ref.delete();
  }
  const countSnap = await firestore().collection(`pictureAlbums/${albumId}/photos`).get();
  await albumRef.set(
    { photoCount: countSnap.size, updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  );
  await integrationDoc(uid).set({ lastSyncAt: FieldValue.serverTimestamp() }, { merge: true });
}

export const syncGoogleDrivePictures = onCall(CALL_OPTS, async (req) => {
  const uid = uidOf(req.auth);
  const integ = await integrationDoc(uid).get();
  if (!integ.data()?.connected) {
    throw new HttpsError("failed-precondition", "Connect Google Drive first.");
  }
  const albumId = req.data?.albumId ? String(req.data.albumId) : null;
  if (albumId) {
    await assertAlbumAccess(uid, albumId, true);
    await syncAlbum(uid, albumId);
  } else {
    const albums = await firestore().collection("pictureAlbums").where("ownerId", "==", uid).get();
    for (const a of albums.docs) await syncAlbum(uid, a.id);
  }
  return { ok: true };
});

export const scheduledGoogleDrivePictureSync = onSchedule(
  {
    schedule: "every 60 minutes",
    secrets: [clientIdSecret, clientSecretSecret],
    timeoutSeconds: 540,
  },
  async () => {
    const users = await firestore().collectionGroup("integrations").where("connected", "==", true).get();
    for (const integ of users.docs) {
      if (integ.id !== "googleDrive") continue;
      const uid = integ.ref.parent.parent?.id;
      if (!uid) continue;
      try {
        const albums = await firestore().collection("pictureAlbums").where("ownerId", "==", uid).get();
        for (const a of albums.docs) await syncAlbum(uid, a.id);
      } catch (err) {
        logger.warn("scheduled sync failed", uid, err);
      }
    }
  },
);

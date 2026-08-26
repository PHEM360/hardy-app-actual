import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { postmarkKey, twilioSid, twilioToken, twilioFrom } from "./notifications/scheduler";
import { sendNotification } from "./notifications/sender";
import {
  buildScanNotifyTargets,
  parseNotifyEmails,
  parseNotifyUids,
  petAccessUids,
} from "./dogTagNotify";

function requireAuth(request: { auth?: { uid: string } }) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  return uid;
}

function userDisplayName(data: FirebaseFirestore.DocumentData | undefined, fallback = "Family member") {
  if (!data) return fallback;
  return String(data.displayName || [data.firstName, data.surname].filter(Boolean).join(" ") || data.email || fallback);
}

async function pageShareUidsForPets(ownerId: string) {
  if (!ownerId) return [];
  const snap = await admin.firestore().collection("pageShares")
    .where("ownerId", "==", ownerId)
    .where("page", "==", "pets")
    .get();
  return snap.docs.map((doc) => String(doc.data().targetUid || "")).filter(Boolean);
}

async function userDirectory(uids: string[]) {
  const unique = [...new Set(uids.filter(Boolean))];
  const users: Record<string, { email?: string; name?: string }> = {};
  if (unique.length === 0) return users;
  const snaps = await admin.firestore().getAll(...unique.map((id) => admin.firestore().doc(`users/${id}`)));
  snaps.forEach((snap) => {
    const data = snap.exists ? snap.data() : undefined;
    users[snap.id] = {
      email: data?.email ? String(data.email) : "",
      name: userDisplayName(data),
    };
  });
  return users;
}

async function scanNotifyTargets(petId: string, tag: FirebaseFirestore.DocumentData) {
  const petSnap = await admin.firestore().doc(`pets/${petId}`).get();
  const pet = petSnap.exists ? petSnap.data() || {} : {};
  const ownerId = String(pet.ownerId || tag.ownerId || "");
  const accessUids = petAccessUids(pet, await pageShareUidsForPets(ownerId));
  const extraUids = parseNotifyUids(tag.notifyUids);
  const extraEmails = parseNotifyEmails(tag.notifyEmails);
  const users = await userDirectory([...accessUids, ...extraUids]);
  const petName = String(pet.name || "Your pet");
  return { petName, ownerId, accessUids, targets: buildScanNotifyTargets({ accessUids, extraUids, extraEmails, users }) };
}

/**
 * Best-effort reverse geocode via OpenStreetMap's free, keyless Nominatim API
 * — used only to make the scan-location summary readable ("near Guildford")
 * instead of raw coordinates. Never blocks the notification if it fails.
 */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`,
      { headers: { "User-Agent": "HardyHub/1.0 (family organiser app)" } }
    );
    if (!res.ok) return "";
    const data = (await res.json()) as { address?: Record<string, string> };
    const a = data.address || {};
    return [a.village || a.suburb || a.town || a.city, a.county || a.state].filter(Boolean).join(", ");
  } catch {
    return "";
  }
}

// Dog Tags — printable QR collar stickers. A stranger who finds the pet
// scans a code encoding /tag/{petId}/{tagId}?c={code} (or visits a friendly
// /p/{slug} URL) and lands on a public page (no account, no Firestore access
// — see firestore.rules) rendered entirely from these Cloud Functions, so
// the raw tag/pet/owner documents are never exposed to that stranger's
// browser.

const SCAN_NOTIFY_DEBOUNCE_MS = 2 * 60 * 1000;

interface DogTagPhone {
  id?: string;
  label?: string;
  number?: string;
}

interface DogTagCustomField {
  id?: string;
  label?: string;
  value?: string;
}

interface DogTagProfile {
  message?: string;
  phones?: DogTagPhone[];
  address?: string;
  vetName?: string;
  vetPhone?: string;
  vetAddress?: string;
  customFields?: DogTagCustomField[];
  externalUrl?: string;
  sendLocation?: boolean;
}

async function loadTag(petId: string, tagId: string) {
  if (!petId || !tagId) return null;
  const ref = admin.firestore().doc(`pets/${petId}/tags/${tagId}`);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ref, data: snap.data()! };
}

function toPublicInfo(petName: string, tag: FirebaseFirestore.DocumentData) {
  const profile: DogTagProfile = tag.profile || {};
  return {
    valid: true,
    petName,
    shape: tag.shape || "rounded",
    bgColor: tag.bgColor || "#ffffff",
    fgColor: tag.fgColor || "#000000",
    stickerText: tag.stickerText || "",
    profile: {
      message: profile.message || "",
      phones: (profile.phones || [])
        .filter((p) => p?.number)
        .map((p) => ({ id: p.id || "", label: p.label || "", number: p.number || "" })),
      address: profile.address || "",
      vetName: profile.vetName || "",
      vetPhone: profile.vetPhone || "",
      vetAddress: profile.vetAddress || "",
      customFields: (profile.customFields || [])
        .filter((f) => f?.label && f?.value)
        .map((f) => ({ id: f.id || "", label: f.label || "", value: f.value || "" })),
      externalUrl: profile.externalUrl || "",
      sendLocation: !!profile.sendLocation,
    },
  };
}

export const getDogTagPublicInfo = onCall(async (request) => {
  const petId = String(request.data?.petId || "");
  const tagId = String(request.data?.tagId || "");
  const code = String(request.data?.code || "");

  const tag = await loadTag(petId, tagId);
  if (!tag || tag.data.code !== code) return { valid: false };

  const petSnap = await admin.firestore().doc(`pets/${petId}`).get();
  const petName = petSnap.exists ? petSnap.data()?.name || "This pet" : "This pet";
  return toPublicInfo(petName, tag.data);
});

export const getDogTagProfileBySlug = onCall(async (request) => {
  const slug = String(request.data?.slug || "").toLowerCase().trim();
  if (!slug) return { valid: false };

  const slugSnap = await admin.firestore().doc(`dogTagSlugs/${slug}`).get();
  if (!slugSnap.exists) return { valid: false };

  const { petId, tagId } = slugSnap.data()!;
  const tag = await loadTag(String(petId || ""), String(tagId || ""));
  if (!tag) return { valid: false };

  const petSnap = await admin.firestore().doc(`pets/${petId}`).get();
  const petName = petSnap.exists ? petSnap.data()?.name || "This pet" : "This pet";
  return { ...toPublicInfo(petName, tag.data), petId, tagId };
});

// Lets the Designer show "Notifies: Chris, Sarah, ..." — the caller must be
// signed in, but doesn't need to already have access to the pet: household
// membership isn't sensitive the way the tag's contact details are.
export const getDogTagNotifyRecipients = onCall(async (request) => {
  const uid = requireAuth(request);
  const petId = String(request.data?.petId || "");
  if (!petId) throw new HttpsError("invalid-argument", "petId is required.");

  const petSnap = await admin.firestore().doc(`pets/${petId}`).get();
  if (!petSnap.exists) return { recipients: [] };
  const pet = petSnap.data() || {};
  const ownerId = String(pet.ownerId || "");
  const accessUids = petAccessUids(pet, await pageShareUidsForPets(ownerId));
  if (!accessUids.includes(uid)) {
    throw new HttpsError("permission-denied", "You do not have access to this pet.");
  }
  const users = await userDirectory(accessUids);
  return {
    recipients: accessUids.map((id) => ({
      uid: id,
      name: users[id]?.name || "Family member",
      email: users[id]?.email || "",
    })),
  };
});

export const reportDogTagScan = onCall(
  { secrets: [postmarkKey, twilioSid, twilioToken, twilioFrom] },
  async (request) => {
    const petId = String(request.data?.petId || "");
    const tagId = String(request.data?.tagId || "");
    const code = request.data?.code ? String(request.data.code) : null;
    const lat = Number(request.data?.lat);
    const lng = Number(request.data?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new HttpsError("invalid-argument", "lat and lng are required.");
    }

    const tag = await loadTag(petId, tagId);
    // A code is only checked when supplied (the /tag/:petId/:tagId?c= flow) —
    // the /p/:slug flow already proved provenance by knowing the slug, which
    // resolves server-side to this exact petId/tagId.
    if (!tag || (code !== null && tag.data.code !== code)) {
      throw new HttpsError("not-found", "This tag is no longer active.");
    }

    const lastNotified: FirebaseFirestore.Timestamp | undefined = tag.data.lastScanNotifiedAt;
    const debounced = !!lastNotified && Date.now() - lastNotified.toMillis() < SCAN_NOTIFY_DEBOUNCE_MS;

    if (debounced) {
      logger.info("reportDogTagScan: debounced, skipping notification", {
        petId,
        tagId,
        msSinceLastNotify: lastNotified ? Date.now() - lastNotified.toMillis() : null,
      });
    } else {
      const placeName = await reverseGeocode(lat, lng);
      const { petName, ownerId: petOwnerId, targets } = await scanNotifyTargets(petId, tag.data);

      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const when = new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
      const locationLine = placeName ? ` near ${placeName}` : "";

      if (targets.length === 0) {
        logger.warn("reportDogTagScan: no notify targets", { petId, tagId, petOwnerId });
      } else {
        const results = await Promise.allSettled(
          targets.map((target) => sendNotification({
            uid: target.uid,
            channels: target.uid ? ["email", "push"] : ["email"],
            emailEnabled: !!target.email,
            emailTo: target.email,
            smsEnabled: false,
            smsTo: "",
            pushEnabled: !!target.uid,
            subject: `📍 ${petName}'s tag was scanned`,
            textBody: `${petName}'s dog tag was just scanned${locationLine} at ${when}.`,
            htmlBody: `<p><strong>${petName}'s</strong> dog tag was just scanned${locationLine}.</p><p>Time: ${when}</p>`,
            actionUrl: mapsUrl,
            actionLabel: "View location on map",
            footerNote: "This is an automatic alert from Hardy Hub — no action is needed from whoever scanned the tag. Tap to open Hardy Hub.",
            pushClickPath: "/pets",
            postmarkKey: postmarkKey.value(),
            twilioSid: twilioSid.value(),
            twilioToken: twilioToken.value(),
            twilioFrom: twilioFrom.value(),
          }))
        );

        const failures = results.filter((r) => r.status === "rejected").length;
        logger.info("reportDogTagScan: notifications sent", {
          petId,
          tagId,
          ownerId: petOwnerId,
          recipientCount: targets.length,
          failures,
        });
      }

      await tag.ref.update({
        lastScanNotifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastScanLocation: { lat, lng, placeName, at: admin.firestore.FieldValue.serverTimestamp() },
      });
    }

    return { success: true };
  }
);

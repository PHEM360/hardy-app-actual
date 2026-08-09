import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { postmarkKey, twilioSid, twilioToken, twilioFrom } from "./notifications/scheduler";
import { sendNotification } from "./notifications/sender";

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

    const ownerId = String(tag.data.ownerId || "");
    const lastNotified: FirebaseFirestore.Timestamp | undefined = tag.data.lastScanNotifiedAt;
    const debounced = !!lastNotified && Date.now() - lastNotified.toMillis() < SCAN_NOTIFY_DEBOUNCE_MS;

    if (!debounced && ownerId) {
      const [petSnap, ownerSnap] = await Promise.all([
        admin.firestore().doc(`pets/${petId}`).get(),
        admin.firestore().doc(`users/${ownerId}`).get(),
      ]);
      const petName = petSnap.exists ? petSnap.data()?.name || "Your pet" : "Your pet";
      const ownerEmail: string | undefined = ownerSnap.exists ? ownerSnap.data()?.email : undefined;

      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      const when = new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
      try {
        await sendNotification({
          uid: ownerId,
          // Push fires even if the owner has no email on file — it doesn't
          // depend on it — and is more real-time/visible than email, so it
          // goes out alongside it rather than as a fallback.
          channels: ["email", "push"],
          emailEnabled: !!ownerEmail,
          emailTo: ownerEmail || "",
          smsEnabled: false,
          smsTo: "",
          pushEnabled: true,
          subject: `📍 ${petName}'s tag was scanned`,
          textBody: `${petName}'s dog tag was just scanned at ${when}.`,
          htmlBody: `<p><strong>${petName}'s</strong> dog tag was just scanned.</p><p>Time: ${when}</p>`,
          actionUrl: mapsUrl,
          actionLabel: "View location on map",
          footerNote: "This is an automatic alert from Hardy Hub — no action is needed from whoever scanned the tag.",
          postmarkKey: postmarkKey.value(),
          twilioSid: twilioSid.value(),
          twilioToken: twilioToken.value(),
          twilioFrom: twilioFrom.value(),
        });
      } catch (err) {
        logger.error("reportDogTagScan: notification failed", { petId, tagId, error: (err as Error).message });
      }

      await tag.ref.update({ lastScanNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    return { success: true };
  }
);

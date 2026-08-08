import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { postmarkKey, twilioSid, twilioToken, twilioFrom } from "./notifications/scheduler";
import { sendNotification } from "./notifications/sender";

// Dog Tags — printable QR collar stickers. A stranger who finds the pet
// scans a code encoding /tag/{petId}/{tagId}?c={code} and lands on a public
// page (no account, no Firestore access — see firestore.rules) rendered
// entirely from these two Cloud Functions, so the raw tag/pet/owner
// documents are never exposed to that stranger's browser.

const SCAN_NOTIFY_DEBOUNCE_MS = 2 * 60 * 1000;

interface DogTagActions {
  showPhone?: boolean;
  phoneNumber?: string;
  contactName?: string;
  showMessage?: boolean;
  message?: string;
  showWebpage?: boolean;
  webpageUrl?: string;
  sendLocation?: boolean;
}

async function loadValidTag(petId: string, tagId: string, code: string) {
  if (!petId || !tagId || !code) return null;
  const ref = admin.firestore().doc(`pets/${petId}/tags/${tagId}`);
  const snap = await ref.get();
  if (!snap.exists || snap.data()?.code !== code) return null;
  return { ref, data: snap.data()! };
}

export const getDogTagPublicInfo = onCall(async (request) => {
  const petId = String(request.data?.petId || "");
  const tagId = String(request.data?.tagId || "");
  const code = String(request.data?.code || "");

  const tag = await loadValidTag(petId, tagId, code);
  if (!tag) return { valid: false };

  const petSnap = await admin.firestore().doc(`pets/${petId}`).get();
  const petName = petSnap.exists ? petSnap.data()?.name || "This pet" : "This pet";
  const actions: DogTagActions = tag.data.actions || {};

  return {
    valid: true,
    petName,
    shape: tag.data.shape || "rounded",
    bgColor: tag.data.bgColor || "#ffffff",
    fgColor: tag.data.fgColor || "#000000",
    stickerText: tag.data.stickerText || "",
    actions: {
      showPhone: !!actions.showPhone,
      phoneNumber: actions.showPhone ? actions.phoneNumber || "" : "",
      contactName: actions.showPhone ? actions.contactName || "" : "",
      showMessage: !!actions.showMessage,
      message: actions.showMessage ? actions.message || "" : "",
      showWebpage: !!actions.showWebpage,
      webpageUrl: actions.showWebpage ? actions.webpageUrl || "" : "",
      sendLocation: !!actions.sendLocation,
    },
  };
});

export const reportDogTagScan = onCall(
  { secrets: [postmarkKey, twilioSid, twilioToken, twilioFrom] },
  async (request) => {
    const petId = String(request.data?.petId || "");
    const tagId = String(request.data?.tagId || "");
    const code = String(request.data?.code || "");
    const lat = Number(request.data?.lat);
    const lng = Number(request.data?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new HttpsError("invalid-argument", "lat and lng are required.");
    }

    const tag = await loadValidTag(petId, tagId, code);
    if (!tag) throw new HttpsError("not-found", "This tag is no longer active.");

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

      if (ownerEmail) {
        const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        const when = new Date().toLocaleString("en-GB", { dateStyle: "full", timeStyle: "short" });
        try {
          await sendNotification({
            uid: ownerId,
            channels: ["email"],
            emailEnabled: true,
            emailTo: ownerEmail,
            smsEnabled: false,
            smsTo: "",
            pushEnabled: false,
            subject: `📍 ${petName}'s tag was scanned`,
            textBody: `${petName}'s dog tag was just scanned.\n\nTime: ${when}\n\nApproximate location:\n${mapsUrl}\n\nThis is an automatic alert from Hardy Hub — no action is needed from whoever scanned the tag.`,
            htmlBody: `<p><strong>${petName}'s</strong> dog tag was just scanned.</p><p>Time: ${when}</p><p><a href="${mapsUrl}">View approximate location on Google Maps</a></p><p style="color:#888;font-size:12px">This is an automatic alert from Hardy Hub.</p>`,
            postmarkKey: postmarkKey.value(),
            twilioSid: twilioSid.value(),
            twilioToken: twilioToken.value(),
            twilioFrom: twilioFrom.value(),
          });
        } catch (err) {
          logger.error("reportDogTagScan: notification failed", { petId, tagId, error: (err as Error).message });
        }
      }

      await tag.ref.update({ lastScanNotifiedAt: admin.firestore.FieldValue.serverTimestamp() });
    }

    return { success: true };
  }
);

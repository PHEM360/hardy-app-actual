import * as admin from "firebase-admin";
import * as postmark from "postmark";
import Twilio from "twilio";
import { logger } from "firebase-functions";
import { NotifChannel } from "./types";

export const FROM_EMAIL = "chris@hardyapp.co.uk";

export interface NotifPayload {
  uid: string;
  channels: NotifChannel[];
  emailEnabled: boolean;
  emailTo: string;
  smsEnabled: boolean;
  smsTo: string;
  pushEnabled: boolean;
  subject: string;
  textBody: string;
  htmlBody: string;
  postmarkKey: string;
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;
}

export async function sendNotification(p: NotifPayload): Promise<void> {
  const sends: Promise<unknown>[] = [];

  if (p.channels.includes("email") && p.emailEnabled && p.emailTo) {
    const client = new postmark.ServerClient(p.postmarkKey);
    sends.push(
      client.sendEmail({
        From: FROM_EMAIL,
        To: p.emailTo,
        Subject: p.subject,
        TextBody: p.textBody,
        HtmlBody: p.htmlBody,
        MessageStream: "outbound",
      })
    );
  }

  if (p.channels.includes("sms") && p.smsEnabled && p.smsTo) {
    const twilio = Twilio(p.twilioSid, p.twilioToken);
    sends.push(
      twilio.messages.create({
        body: p.textBody,
        from: p.twilioFrom,
        to: formatE164(p.smsTo),
      })
    );
  }

  if (p.channels.includes("push") && p.pushEnabled) {
    sends.push(sendFcmToUser(p.uid, p.subject, p.textBody));
  }

  await Promise.all(sends);
}

/**
 * Send an FCM push notification to every registered device token for a user.
 * Automatically cleans up expired/invalid tokens from Firestore.
 */
async function sendFcmToUser(uid: string, title: string, body: string): Promise<void> {
  const userDoc = await admin.firestore().doc(`users/${uid}`).get();
  const tokens: string[] = userDoc.data()?.fcmTokens ?? [];
  if (tokens.length === 0) return;

  const response = await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: { title, body, icon: "/favicon.ico" },
    },
  });

  // Remove any tokens that have become invalid
  const stale = tokens.filter((_, i) => {
    const r = response.responses[i];
    return (
      !r.success &&
      (r.error?.code === "messaging/invalid-registration-token" ||
        r.error?.code === "messaging/registration-token-not-registered")
    );
  });

  if (stale.length > 0) {
    logger.info("Removing stale FCM tokens", { uid, count: stale.length });
    await admin.firestore().doc(`users/${uid}`).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(...stale),
    });
  }
}

/** Convert a UK number to E.164, e.g. "07911123456" → "+447911123456" */
function formatE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("44")) return `+${digits}`;
  if (digits.startsWith("0")) return `+44${digits.slice(1)}`;
  return `+${digits}`;
}

import * as admin from "firebase-admin";
import * as postmark from "postmark";
import Twilio from "twilio";
import { logger } from "firebase-functions";
import { NotifChannel } from "./types";

export const FROM_EMAIL = "hardyhub@bgmhealth.co.uk";

// One shared transactional template ("hardy-hub-transactional", server 19722594 —
// "Hardy Hub") covers every email this app sends, rather than each call site
// hand-rolling its own HTML. See TemplateModel below for the variables it expects.
export const TRANSACTIONAL_TEMPLATE_ALIAS = "hardy-hub-transactional";

export interface TransactionalTemplateModel {
  subject: string;
  heading: string;
  body_html: string;
  body_text: string;
  preheader?: string;
  // Grouped (not flat action_url/action_label) because Postmark's Mustache-style
  // {{#action}} section only exposes a nested object's own fields as unqualified
  // {{url}}/{{label}} inside the block — sibling top-level variables resolve to
  // nothing there (confirmed via the /templates/validate API).
  action?: { url: string; label: string };
  footer_note?: string;
}

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
  actionUrl?: string;
  actionLabel?: string;
  footerNote?: string;
  postmarkKey: string;
  twilioSid: string;
  twilioToken: string;
  twilioFrom: string;
}

export async function sendNotification(p: NotifPayload): Promise<void> {
  const sends: Promise<unknown>[] = [];

  if (p.channels.includes("email") && p.emailEnabled && p.emailTo) {
    sends.push(
      sendTransactionalEmail(p.postmarkKey, p.emailTo, {
        subject: p.subject,
        heading: p.subject,
        body_html: p.htmlBody,
        body_text: p.textBody,
        action: p.actionUrl && p.actionLabel ? { url: p.actionUrl, label: p.actionLabel } : undefined,
        footer_note: p.footerNote,
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

/** Sends the one shared transactional template — the single place every Postmark send in this app goes through. */
export async function sendTransactionalEmail(
  postmarkKey: string,
  to: string,
  model: TransactionalTemplateModel
): Promise<void> {
  const client = new postmark.ServerClient(postmarkKey);
  await client.sendEmailWithTemplate({
    From: FROM_EMAIL,
    To: to,
    TemplateAlias: TRANSACTIONAL_TEMPLATE_ALIAS,
    TemplateModel: model,
    MessageStream: "outbound",
  });
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

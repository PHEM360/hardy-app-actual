/**
 * Family Twilio softphone — voice tokens, SMS, click-to-call, and webhooks.
 */
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import Twilio from "twilio";

const twilioSid = defineSecret("TWILIO_ACCOUNT_SID");
const twilioToken = defineSecret("TWILIO_AUTH_TOKEN");
const twilioFrom = defineSecret("TWILIO_FROM");
const twilioApiKeySid = defineSecret("TWILIO_API_KEY_SID");
const twilioApiKeySecret = defineSecret("TWILIO_API_KEY_SECRET");
const twilioTwimlAppSid = defineSecret("TWILIO_TWIML_APP_SID");

const APP_URL = "https://hardyapp.co.uk";
const VOICE_SECRETS = [twilioSid, twilioToken, twilioFrom, twilioApiKeySid, twilioApiKeySecret, twilioTwimlAppSid];
const SMS_SECRETS = [twilioSid, twilioToken, twilioFrom];

function requireUid(request: { auth?: { uid: string; token?: Record<string, unknown> } }) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (request.auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot use the phone.");
  }
  return request.auth.uid;
}

function secretValue(secret: { value: () => string }) {
  try {
    return String(secret.value() || "").trim();
  } catch {
    return "";
  }
}

function e164(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return `+${raw.slice(1).replace(/\D/g, "")}`;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("0")) return `+44${digits.slice(1)}`;
  if (digits.length === 10) return `+44${digits}`;
  if (digits.startsWith("44") && digits.length >= 11) return `+${digits}`;
  if (digits.length >= 8) return `+${digits}`;
  return "";
}

function displayNumber(fromSecret: string) {
  return fromSecret || "";
}

function voiceReady() {
  return Boolean(
    secretValue(twilioSid) &&
    secretValue(twilioApiKeySid) &&
    secretValue(twilioApiKeySecret) &&
    secretValue(twilioTwimlAppSid),
  );
}

function smsReady() {
  return Boolean(secretValue(twilioSid) && secretValue(twilioToken) && secretValue(twilioFrom));
}

function identityFor(uid: string) {
  return uid.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 120);
}

async function phoneOwnerUids(): Promise<string[]> {
  const snap = await admin.firestore().collection("phoneSettings").limit(50).get();
  const uids = snap.docs.map((doc) => doc.id);
  if (uids.length) return uids;
  const users = await admin.firestore().collection("users").where("role", "in", ["admin", "superadmin"]).limit(10).get();
  return users.docs.map((doc) => doc.id);
}

export const getSoftphoneConfig = onCall({ secrets: VOICE_SECRETS }, async (request) => {
  const uid = requireUid(request);
  const settings = (await admin.firestore().doc(`phoneSettings/${uid}`).get()).data() || {};
  return {
    smsReady: smsReady(),
    voiceReady: voiceReady(),
    fromNumber: displayNumber(secretValue(twilioFrom)),
    identity: identityFor(uid),
    notifyCalls: settings.notifyCalls !== false,
    notifySms: settings.notifySms !== false,
    myMobile: String(settings.myMobile || ""),
    displayName: String(settings.displayName || ""),
  };
});

export const getSoftphoneVoiceToken = onCall({ secrets: VOICE_SECRETS }, async (request) => {
  const uid = requireUid(request);
  if (!voiceReady()) {
    throw new HttpsError(
      "failed-precondition",
      "Browser calling needs Twilio Voice set up (API key + TwiML app). You can still send texts.",
    );
  }
  const AccessToken = Twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;
  const identity = identityFor(uid);
  const token = new AccessToken(
    secretValue(twilioSid),
    secretValue(twilioApiKeySid),
    secretValue(twilioApiKeySecret),
    { identity, ttl: 3600 },
  );
  token.addGrant(new VoiceGrant({
    outgoingApplicationSid: secretValue(twilioTwimlAppSid),
    incomingAllow: true,
  }));
  await admin.firestore().doc(`phone/${uid}/presence/self`).set({
    identity,
    updatedAt: FieldValue.serverTimestamp(),
    userAgent: String(request.rawRequest?.headers?.["user-agent"] || "").slice(0, 200),
  }, { merge: true });
  return { token: token.toJwt(), identity, fromNumber: displayNumber(secretValue(twilioFrom)) };
});

export const sendSoftphoneSms = onCall({ secrets: SMS_SECRETS }, async (request) => {
  const uid = requireUid(request);
  if (!smsReady()) throw new HttpsError("failed-precondition", "Twilio SMS is not configured yet.");
  const to = e164(String(request.data?.to || ""));
  const body = String(request.data?.body || "").trim().slice(0, 1600);
  if (!to) throw new HttpsError("invalid-argument", "Enter a phone number.");
  if (!body) throw new HttpsError("invalid-argument", "Type a message first.");
  const from = secretValue(twilioFrom);
  const twilio = Twilio(secretValue(twilioSid), secretValue(twilioToken));
  const message = await twilio.messages.create({ to, from, body });
  const record = {
    sid: message.sid,
    direction: "outbound",
    from,
    to,
    body,
    status: message.status || "queued",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
    ownerUid: uid,
  };
  await admin.firestore().collection(`phone/${uid}/messages`).add(record);
  return { sid: message.sid, status: message.status };
});

export const startSoftphoneCall = onCall({ secrets: SMS_SECRETS }, async (request) => {
  const uid = requireUid(request);
  if (!smsReady()) throw new HttpsError("failed-precondition", "Twilio calling is not configured yet.");
  const to = e164(String(request.data?.to || ""));
  if (!to) throw new HttpsError("invalid-argument", "Enter a phone number.");
  const settings = (await admin.firestore().doc(`phoneSettings/${uid}`).get()).data() || {};
  const myMobile = e164(String(request.data?.fromMobile || settings.myMobile || ""));
  const from = secretValue(twilioFrom);
  const twilio = Twilio(secretValue(twilioSid), secretValue(twilioToken));

  let call;
  if (voiceReady() && request.data?.viaClient === true) {
    throw new HttpsError("failed-precondition", "Place this call from the keypad so your browser can connect.");
  }
  if (myMobile) {
    call = await twilio.calls.create({
      to: myMobile,
      from,
      twiml: `<Response><Say voice="alice">Connecting you now.</Say><Dial callerId="${from}">${to}</Dial></Response>`,
      statusCallback: `${APP_URL}/api/twilio/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
  } else {
    call = await twilio.calls.create({
      to,
      from,
      twiml: "<Response><Say voice=\"alice\">Hardy Hub calling. There is no one on this line yet — add your mobile in Phone settings, or finish Twilio Voice setup for in-app calls.</Say></Response>",
      statusCallback: `${APP_URL}/api/twilio/status`,
      statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
    });
  }

  await admin.firestore().collection(`phone/${uid}/calls`).add({
    sid: call.sid,
    direction: "outbound",
    from,
    to,
    status: call.status || "queued",
    via: myMobile ? "callback" : "notice",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
    ownerUid: uid,
  });
  return { sid: call.sid, status: call.status, via: myMobile ? "callback" : "notice" };
});

function validTwilioSignature(request: { header: (name: string) => string; body: Record<string, string> }, url: string) {
  const token = secretValue(twilioToken);
  const signature = request.header("x-twilio-signature") || "";
  if (!token || !signature) return false;
  try {
    return Twilio.validateRequest(token, signature, url, request.body || {});
  } catch {
    return false;
  }
}

function xml(body: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

export const twilioVoiceWebhook = onRequest({ secrets: VOICE_SECRETS, cors: false }, async (req, res) => {
  const url = `${APP_URL}/api/twilio/voice`;
  if (req.method !== "POST" || !validTwilioSignature(req as never, url)) {
    res.status(403).send("Forbidden");
    return;
  }
  const to = String(req.body?.To || "");
  const from = String(req.body?.From || "");
  const called = e164(to) || to;
  const caller = e164(from) || from;

  if (from.startsWith("client:")) {
    const destination = called.startsWith("+") ? called : e164(to);
    if (!destination) {
      res.type("text/xml").send(xml("<Say>Please dial a valid number.</Say>"));
      return;
    }
    res.type("text/xml").send(xml(`<Dial callerId="${secretValue(twilioFrom)}"><Number>${destination}</Number></Dial>`));
    return;
  }

  const identities = (await phoneOwnerUids()).map(identityFor);
  if (identities.length === 0) {
    res.type("text/xml").send(xml("<Say>Hardy Hub is not ready to take this call.</Say>"));
    return;
  }
  const clients = identities.map((id) => `<Client>${id}</Client>`).join("");
  logger.info("twilioVoiceWebhook incoming", { from: caller, to: called, clients: identities.length });
  res.type("text/xml").send(xml(`<Dial callerId="${caller}" timeout="25">${clients}</Dial>`));
});

export const twilioSmsWebhook = onRequest({ secrets: SMS_SECRETS, cors: false }, async (req, res) => {
  const url = `${APP_URL}/api/twilio/sms`;
  if (req.method !== "POST" || !validTwilioSignature(req as never, url)) {
    res.status(403).send("Forbidden");
    return;
  }
  const from = e164(String(req.body?.From || "")) || String(req.body?.From || "");
  const to = e164(String(req.body?.To || "")) || String(req.body?.To || "");
  const body = String(req.body?.Body || "").slice(0, 1600);
  const sid = String(req.body?.MessageSid || "");
  const owners = await phoneOwnerUids();
  const record = {
    sid,
    direction: "inbound",
    from,
    to,
    body,
    status: "received",
    createdAt: FieldValue.serverTimestamp(),
    createdAtIso: new Date().toISOString(),
  };
  await Promise.all(owners.map((uid) => admin.firestore().collection(`phone/${uid}/messages`).add({
    ...record,
    ownerUid: uid,
  })));
  logger.info("twilioSmsWebhook", { from, to, owners: owners.length });
  res.type("text/xml").send(xml(""));
});

export const twilioStatusWebhook = onRequest({ secrets: SMS_SECRETS, cors: false }, async (req, res) => {
  const url = `${APP_URL}/api/twilio/status`;
  if (req.method !== "POST" || !validTwilioSignature(req as never, url)) {
    res.status(403).send("Forbidden");
    return;
  }
  const sid = String(req.body?.CallSid || req.body?.MessageSid || "");
  const status = String(req.body?.CallStatus || req.body?.MessageStatus || "");
  if (sid) {
    const calls = await admin.firestore().collectionGroup("calls").where("sid", "==", sid).limit(5).get();
    await Promise.all(calls.docs.map((doc) => doc.ref.set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true })));
  }
  res.status(204).send("");
});

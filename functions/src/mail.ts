import {randomUUID} from "node:crypto";
import {onCall, onRequest, HttpsError} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {FieldValue} from "firebase-admin/firestore";
import {ImapFlow} from "imapflow";
import nodemailer from "nodemailer";
import {
  APP_HOST,
  GOOGLE_SECRET_OPTS,
  googleAuthUrl,
  loadGoogleCredentials,
} from "./googleOAuth";
import {
  buildRfc822,
  decodeBase64Url,
  encodeBase64Url,
  extractDisplayName,
  extractEmailAddress,
  extractTextFromRfc822,
  folderFromLabels,
  guessMailHosts,
  headerValue,
  isMailingListMessage,
  parseListUnsubscribe,
  parseMailtoAction,
  safeDocId,
  sanitizeMailText,
  splitAddressList,
} from "./mailParse";

const CALLBACK = `${APP_HOST}/api/mail/callback`;
const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const GOOGLE_OPTS = GOOGLE_SECRET_OPTS;
const AI_OPTS = {secrets: [openaiApiKey], timeoutSeconds: 120, memory: "512MiB" as const};

type MailFolder = "inbox" | "sent" | "drafts" | "trash";

interface StoredMessage {
  accountId: string;
  providerMessageId: string;
  threadId: string;
  folder: MailFolder;
  from: string;
  fromName: string;
  to: string[];
  cc: string[];
  subject: string;
  snippet: string;
  bodyText: string;
  date: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
  isMailingList: boolean;
  listUnsubscribe: string;
  listUnsubscribePost: string;
  aiCategory?: string;
  aiSummary?: string;
}

function db() {
  return admin.firestore();
}

function requireUid(auth?: {uid: string; token?: Record<string, unknown>}) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote displays cannot open mail.");
  }
  return auth.uid;
}

function ownerFrom(uid: string, value: unknown) {
  const owner = String(value || uid).trim();
  return owner || uid;
}

async function isAdminUser(uid: string) {
  const snap = await db().doc(`users/${uid}`).get();
  const data = snap.data() || {};
  const role = String(data.role || "").toLowerCase().replace(/[\s_-]+/g, "");
  return role === "admin" || role === "superadmin" || data.isAdmin === true || data.isSuperAdmin === true;
}

async function requireMailAccess(uid: string, ownerUid: string, mode: "view" | "edit" | "owner") {
  if (uid === ownerUid) return;
  if (await isAdminUser(uid)) {
    if (mode === "owner") throw new HttpsError("permission-denied", "Only the mailbox owner can connect accounts.");
    return;
  }
  if (mode === "owner") throw new HttpsError("permission-denied", "Only the mailbox owner can connect accounts.");
  const share = await db().doc(`pageShares/${ownerUid}_email_${uid}`).get();
  if (!share.exists) throw new HttpsError("permission-denied", "This mailbox has not been shared with you.");
  if (mode === "edit" && share.data()?.permission !== "edit") {
    throw new HttpsError("permission-denied", "You can look, but you cannot send from this mailbox.");
  }
}

async function googleCredentials() {
  return loadGoogleCredentials();
}

async function formPost(url: string, body: Record<string, string>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/x-www-form-urlencoded"},
    body: new URLSearchParams(body),
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    logger.error("OAuth token request failed", {status: response.status, data});
    throw new HttpsError("internal", "Google did not accept that login.");
  }
  return data;
}

function secretId(ownerUid: string, accountId: string) {
  return `${ownerUid}_${accountId}`;
}

async function getSecret(ownerUid: string, accountId: string) {
  const snap = await db().doc(`mailSecrets/${secretId(ownerUid, accountId)}`).get();
  if (!snap.exists) throw new HttpsError("failed-precondition", "That mailbox is not connected.");
  return snap.data() || {};
}

async function gmailAccessToken(ownerUid: string, accountId: string) {
  const secret = await getSecret(ownerUid, accountId);
  const expiresAt = Number(secret.accessExpiresAt || 0);
  if (secret.accessToken && expiresAt > Date.now() + 60_000) return String(secret.accessToken);
  if (!secret.refreshToken) throw new HttpsError("failed-precondition", "Link Gmail again.");
  const {clientId, clientSecret} = await googleCredentials();
  const token = await formPost("https://oauth2.googleapis.com/token", {
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: String(secret.refreshToken),
    grant_type: "refresh_token",
  });
  const accessToken = String(token.access_token || "");
  await snapMerge(`mailSecrets/${secretId(ownerUid, accountId)}`, {
    accessToken,
    accessExpiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
  });
  return accessToken;
}

async function snapMerge(path: string, data: Record<string, unknown>) {
  await db().doc(path).set({
    ...data,
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});
}

async function gmailApi(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = await response.json() as Record<string, unknown>;
  if (!response.ok) {
    logger.error("Gmail API failed", {path, status: response.status, data});
    throw new HttpsError("internal", "Gmail did not accept that request.");
  }
  return data;
}

interface GmailPart {
  mimeType?: string;
  body?: {data?: string};
  parts?: GmailPart[];
  headers?: Array<{name?: string; value?: string}>;
}

function walkGmailParts(part: GmailPart | undefined, out: {text: string; html: string}) {
  if (!part) return;
  if (part.mimeType === "text/plain" && part.body?.data) out.text += decodeBase64Url(part.body.data);
  if (part.mimeType === "text/html" && part.body?.data) out.html += decodeBase64Url(part.body.data);
  for (const child of part.parts || []) walkGmailParts(child, out);
}

function storedFromParsed(accountId: string, parsed: {
  providerMessageId: string;
  threadId: string;
  folder: MailFolder;
  from: string;
  to: string[];
  cc: string[];
  subject: string;
  bodyText: string;
  date: string;
  unread: boolean;
  starred: boolean;
  labels: string[];
  listUnsubscribe: string;
  listUnsubscribePost: string;
  listId?: string;
  precedence?: string;
}): StoredMessage {
  const from = parsed.from;
  const bodyText = sanitizeMailText(parsed.bodyText);
  return {
    accountId,
    providerMessageId: parsed.providerMessageId,
    threadId: parsed.threadId || parsed.providerMessageId,
    folder: parsed.folder,
    from,
    fromName: extractDisplayName(from),
    to: parsed.to,
    cc: parsed.cc,
    subject: parsed.subject || "(no subject)",
    snippet: bodyText.slice(0, 180),
    bodyText,
    date: parsed.date || new Date().toISOString(),
    unread: parsed.unread,
    starred: parsed.starred,
    labels: parsed.labels,
    isMailingList: isMailingListMessage({
      listUnsubscribe: parsed.listUnsubscribe,
      listId: parsed.listId,
      precedence: parsed.precedence,
      from,
    }),
    listUnsubscribe: parsed.listUnsubscribe,
    listUnsubscribePost: parsed.listUnsubscribePost,
  };
}

async function writeMessage(ownerUid: string, accountId: string, message: StoredMessage) {
  const id = `${accountId}_${safeDocId(message.providerMessageId)}`;
  await db().doc(`mail/${ownerUid}/messages/${id}`).set({
    ...message,
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});
}

async function setAccountStatus(ownerUid: string, accountId: string, patch: Record<string, unknown>) {
  await snapMerge(`mail/${ownerUid}/accounts/${accountId}`, patch);
}

export const startGmailConnect = onCall(GOOGLE_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const ownerUid = ownerFrom(uid, request.data?.ownerUid);
  await requireMailAccess(uid, ownerUid, "owner");
  const {clientId} = await googleCredentials();
  const state = randomUUID();
  await db().doc(`mailOAuth/${state}`).set({
    uid: ownerUid,
    createdAt: FieldValue.serverTimestamp(),
    expiresAt: Date.now() + 15 * 60 * 1000,
  });
  return {authUrl: googleAuthUrl(clientId, CALLBACK, GMAIL_SCOPES, state)};
});

export const mailOAuthCallback = onRequest(GOOGLE_OPTS, async (req, res) => {
  const code = String(req.query.code || "");
  const state = String(req.query.state || "");
  const fail = (reason: string) => res.redirect(`${APP_HOST}/email?mail=error&reason=${encodeURIComponent(reason)}`);
  if (!code || !state) {
    fail("missing");
    return;
  }
  const stateSnap = await db().doc(`mailOAuth/${state}`).get();
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
    const {clientId, clientSecret} = await googleCredentials();
    const token = await formPost("https://oauth2.googleapis.com/token", {
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: CALLBACK,
      grant_type: "authorization_code",
    });
    const accessToken = String(token.access_token || "");
    const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {Authorization: `Bearer ${accessToken}`},
    });
    const profile = await profileRes.json() as {email?: string};
    const email = String(profile.email || "").toLowerCase();
    if (!email) throw new Error("no-email");
    const accountId = safeDocId(`gmail_${email}`);
    const ownerUid = String(stateData.uid);
    await db().doc(`mailSecrets/${secretId(ownerUid, accountId)}`).set({
      provider: "gmail",
      email,
      accessToken,
      refreshToken: token.refresh_token || null,
      accessExpiresAt: Date.now() + Number(token.expires_in || 3600) * 1000,
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    await db().doc(`mail/${ownerUid}/accounts/${accountId}`).set({
      email,
      displayName: email,
      provider: "gmail",
      status: "ok",
      lastError: null,
      host: "gmail.googleapis.com",
      updatedAt: FieldValue.serverTimestamp(),
    }, {merge: true});
    await stateSnap.ref.delete();
    res.redirect(`${APP_HOST}/email?mail=connected`);
  } catch (err) {
    logger.error("mailOAuthCallback failed", err);
    fail("token");
  }
});

export const connectImapAccount = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const ownerUid = ownerFrom(uid, request.data?.ownerUid);
  await requireMailAccess(uid, ownerUid, "owner");
  const email = extractEmailAddress(String(request.data?.email || ""));
  const password = String(request.data?.password || "");
  if (!email || password.length < 6) {
    throw new HttpsError("invalid-argument", "Need the email address and an app password.");
  }
  const guessed = guessMailHosts(email);
  const imapHost = String(request.data?.imapHost || guessed?.imap || "").trim();
  const smtpHost = String(request.data?.smtpHost || guessed?.smtp || imapHost).trim();
  if (!imapHost) {
    throw new HttpsError("invalid-argument", "Add the incoming mail server for this address.");
  }
  const client = new ImapFlow({
    host: imapHost,
    port: 993,
    secure: true,
    auth: {user: email, pass: password},
    logger: false,
  });
  try {
    await client.connect();
    await client.logout();
  } catch (err) {
    logger.error("IMAP login failed", err);
    throw new HttpsError("invalid-argument", "Could not sign in to that mailbox. Use an app password, not the normal login password.");
  }
  const accountId = safeDocId(`imap_${email}`);
  await db().doc(`mailSecrets/${secretId(ownerUid, accountId)}`).set({
    provider: "imap",
    email,
    password,
    imapHost,
    smtpHost,
    updatedAt: FieldValue.serverTimestamp(),
  });
  await db().doc(`mail/${ownerUid}/accounts/${accountId}`).set({
    email,
    displayName: String(request.data?.displayName || email).trim() || email,
    provider: "imap",
    status: "ok",
    lastError: null,
    host: imapHost,
    updatedAt: FieldValue.serverTimestamp(),
  }, {merge: true});
  return {accountId};
});

async function syncGmailAccount(ownerUid: string, accountId: string) {
  const accessToken = await gmailAccessToken(ownerUid, accountId);
  let synced = 0;
  for (const label of ["INBOX", "SENT"]) {
    const listed = await gmailApi(accessToken, `messages?maxResults=${label === "SENT" ? 15 : 40}&labelIds=${label}`);
    const ids = Array.isArray(listed.messages) ? listed.messages as Array<{id?: string; threadId?: string}> : [];
    for (const item of ids) {
      if (!item.id) continue;
      const full = await gmailApi(accessToken, `messages/${item.id}?format=full`);
      const payload = (full.payload || {}) as GmailPart;
      const headers = payload.headers || [];
      const bodies = {text: "", html: ""};
      walkGmailParts(payload, bodies);
      const labels = Array.isArray(full.labelIds) ? full.labelIds.map(String) : [label];
      const listUnsubscribe = headerValue(headers, "List-Unsubscribe");
      const stored = storedFromParsed(accountId, {
        providerMessageId: String(full.id || item.id),
        threadId: String(full.threadId || item.threadId || item.id),
        folder: folderFromLabels(labels),
        from: headerValue(headers, "From"),
        to: splitAddressList(headerValue(headers, "To")),
        cc: splitAddressList(headerValue(headers, "Cc")),
        subject: headerValue(headers, "Subject"),
        bodyText: bodies.text || bodies.html,
        date: headerValue(headers, "Date") ? new Date(headerValue(headers, "Date")).toISOString() : new Date().toISOString(),
        unread: labels.includes("UNREAD"),
        starred: labels.includes("STARRED"),
        labels,
        listUnsubscribe,
        listUnsubscribePost: headerValue(headers, "List-Unsubscribe-Post"),
        listId: headerValue(headers, "List-Id"),
        precedence: headerValue(headers, "Precedence"),
      });
      await writeMessage(ownerUid, accountId, stored);
      synced += 1;
    }
  }
  return synced;
}

async function openImap(secret: Record<string, unknown>) {
  const client = new ImapFlow({
    host: String(secret.imapHost),
    port: 993,
    secure: true,
    auth: {user: String(secret.email), pass: String(secret.password)},
    logger: false,
  });
  await client.connect();
  return client;
}

async function syncImapMailbox(client: ImapFlow, ownerUid: string, accountId: string, box: string, folder: MailFolder, limit: number) {
  const lock = await client.getMailboxLock(box);
  try {
    const box = client.mailbox;
    const exists = typeof box === "object" && box ? Number(box.exists || 0) : 0;
    if (!exists) return 0;
    const start = Math.max(1, exists - limit + 1);
    let synced = 0;
    for await (const msg of client.fetch(`${start}:${exists}`, {uid: true, flags: true, envelope: true, source: true})) {
      const envelope = msg.envelope;
      const from = envelope?.from?.[0] ? `${envelope.from[0].name || ""} <${envelope.from[0].address || ""}>` : "";
      const to = (envelope?.to || []).map((item) => item.address || "").filter(Boolean);
      const cc = (envelope?.cc || []).map((item) => item.address || "").filter(Boolean);
      const raw = msg.source ? msg.source.toString("utf8") : "";
      const flags = [...(msg.flags || [])];
      const stored = storedFromParsed(accountId, {
        providerMessageId: String(msg.uid),
        threadId: String(envelope?.messageId || msg.uid),
        folder,
        from,
        to,
        cc,
        subject: envelope?.subject || "",
        bodyText: extractTextFromRfc822(raw),
        date: envelope?.date ? envelope.date.toISOString() : new Date().toISOString(),
        unread: !flags.includes("\\Seen"),
        starred: flags.includes("\\Flagged"),
        labels: flags,
        listUnsubscribe: "",
        listUnsubscribePost: "",
      });
      if (/List-Unsubscribe:/i.test(raw)) {
        const match = raw.match(/List-Unsubscribe:\s*([^\r\n]+)/i);
        stored.listUnsubscribe = match?.[1] || "";
        stored.isMailingList = true;
      }
      await writeMessage(ownerUid, accountId, stored);
      synced += 1;
    }
    return synced;
  } finally {
    lock.release();
  }
}

async function syncImapAccount(ownerUid: string, accountId: string) {
  const secret = await getSecret(ownerUid, accountId);
  const client = await openImap(secret);
  try {
    let synced = await syncImapMailbox(client, ownerUid, accountId, "INBOX", "inbox", 40);
    for (const name of ["Sent", "Sent Items", "[Gmail]/Sent Mail", "INBOX.Sent"]) {
      try {
        synced += await syncImapMailbox(client, ownerUid, accountId, name, "sent", 15);
        break;
      } catch {
        // try the next common Sent folder name
      }
    }
    return synced;
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

export const syncMailbox = onCall({...GOOGLE_OPTS, timeoutSeconds: 180, memory: "512MiB"}, async (request) => {
  const uid = requireUid(request.auth);
  const ownerUid = ownerFrom(uid, request.data?.ownerUid);
  await requireMailAccess(uid, ownerUid, "edit");
  const wanted = String(request.data?.accountId || "").trim();
  const snap = await db().collection(`mail/${ownerUid}/accounts`).get();
  const accounts = snap.docs.filter((item) => !wanted || item.id === wanted);
  if (!accounts.length) throw new HttpsError("failed-precondition", "Connect an email account first.");
  let synced = 0;
  for (const account of accounts) {
    await setAccountStatus(ownerUid, account.id, {status: "syncing", lastError: null});
    try {
      const extra = account.data().provider === "gmail" ?
        await syncGmailAccount(ownerUid, account.id) :
        await syncImapAccount(ownerUid, account.id);
      synced += extra;
      await setAccountStatus(ownerUid, account.id, {
        status: "ok",
        lastSyncAt: new Date().toISOString(),
        lastError: null,
      });
    } catch (err) {
      logger.error("Mailbox sync failed", {accountId: account.id, err});
      await setAccountStatus(ownerUid, account.id, {
        status: account.data().provider === "gmail" ? "needs_reauth" : "error",
        lastError: err instanceof Error ? err.message : "Sync failed",
      });
    }
  }
  return {synced};
});

async function sendThroughAccount(ownerUid: string, accountId: string, input: {
  to: string[];
  cc: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}) {
  const account = (await db().doc(`mail/${ownerUid}/accounts/${accountId}`).get()).data();
  if (!account) throw new HttpsError("not-found", "That mailbox is gone.");
  const from = String(account.email);
  if (account.provider === "gmail") {
    const accessToken = await gmailAccessToken(ownerUid, accountId);
    const raw = encodeBase64Url(buildRfc822({
      from,
      to: input.to,
      cc: input.cc,
      subject: input.subject,
      body: input.body,
      inReplyTo: input.inReplyTo,
      references: input.references,
    }));
    await gmailApi(accessToken, "messages/send", {method: "POST", body: JSON.stringify({raw})});
    return;
  }
  const secret = await getSecret(ownerUid, accountId);
  const transporter = nodemailer.createTransport({
    host: String(secret.smtpHost || secret.imapHost),
    port: 587,
    secure: false,
    auth: {user: String(secret.email), pass: String(secret.password)},
  });
  await transporter.sendMail({
    from,
    to: input.to.join(", "),
    cc: input.cc.join(", ") || undefined,
    subject: input.subject,
    text: input.body,
    inReplyTo: input.inReplyTo,
    references: input.references,
  });
}

export const sendMail = onCall(GOOGLE_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const ownerUid = ownerFrom(uid, request.data?.ownerUid);
  await requireMailAccess(uid, ownerUid, "edit");
  const accountId = String(request.data?.accountId || "").trim();
  const to = splitAddressList(String(request.data?.to || ""));
  const cc = splitAddressList(String(request.data?.cc || ""));
  const subject = String(request.data?.subject || "").trim();
  const body = String(request.data?.body || "");
  if (!accountId || !to.length || !subject) {
    throw new HttpsError("invalid-argument", "Need a from account, a To address, and a subject.");
  }
  await sendThroughAccount(ownerUid, accountId, {
    to,
    cc,
    subject,
    body,
    inReplyTo: String(request.data?.inReplyTo || "") || undefined,
    references: String(request.data?.references || "") || undefined,
  });
  const stored = storedFromParsed(accountId, {
    providerMessageId: `sent_${Date.now()}`,
    threadId: String(request.data?.inReplyTo || `sent_${Date.now()}`),
    folder: "sent",
    from: "",
    to,
    cc,
    subject,
    bodyText: body,
    date: new Date().toISOString(),
    unread: false,
    starred: false,
    labels: ["SENT"],
    listUnsubscribe: "",
    listUnsubscribePost: "",
  });
  const account = (await db().doc(`mail/${ownerUid}/accounts/${accountId}`).get()).data();
  stored.from = String(account?.email || "");
  stored.fromName = stored.from;
  await writeMessage(ownerUid, accountId, stored);
  return {sent: true};
});

export const updateMailFlags = onCall(GOOGLE_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const ownerUid = ownerFrom(uid, request.data?.ownerUid);
  await requireMailAccess(uid, ownerUid, "edit");
  const messageId = String(request.data?.messageId || "").trim();
  const snap = await db().doc(`mail/${ownerUid}/messages/${messageId}`).get();
  if (!snap.exists) throw new HttpsError("not-found", "Message not found.");
  const message = snap.data() || {};
  const patch: Record<string, unknown> = {};
  if (typeof request.data?.unread === "boolean") patch.unread = request.data.unread;
  if (typeof request.data?.starred === "boolean") patch.starred = request.data.starred;
  if (request.data?.folder === "trash" || request.data?.folder === "inbox") patch.folder = request.data.folder;
  if (!Object.keys(patch).length) return {ok: true};
  await snap.ref.set({...patch, updatedAt: FieldValue.serverTimestamp()}, {merge: true});
  const account = (await db().doc(`mail/${ownerUid}/accounts/${message.accountId}`).get()).data();
  if (account?.provider === "gmail" && message.providerMessageId) {
    try {
      const accessToken = await gmailAccessToken(ownerUid, String(message.accountId));
      const add: string[] = [];
      const remove: string[] = [];
      if (typeof request.data?.unread === "boolean") {
        (request.data.unread ? add : remove).push("UNREAD");
      }
      if (typeof request.data?.starred === "boolean") {
        (request.data.starred ? add : remove).push("STARRED");
      }
      if (request.data?.folder === "trash") add.push("TRASH");
      if (request.data?.folder === "inbox") remove.push("TRASH");
      await gmailApi(accessToken, `messages/${message.providerMessageId}/modify`, {
        method: "POST",
        body: JSON.stringify({addLabelIds: add, removeLabelIds: remove}),
      });
    } catch (err) {
      logger.warn("Could not mirror Gmail flags", err);
    }
  }
  return {ok: true};
});

export const disconnectMailAccount = onCall(async (request) => {
  const uid = requireUid(request.auth);
  const ownerUid = ownerFrom(uid, request.data?.ownerUid);
  await requireMailAccess(uid, ownerUid, "owner");
  const accountId = String(request.data?.accountId || "").trim();
  if (!accountId) throw new HttpsError("invalid-argument", "Missing account.");
  const messages = await db().collection(`mail/${ownerUid}/messages`).where("accountId", "==", accountId).get();
  const batch = db().batch();
  messages.docs.forEach((item) => batch.delete(item.ref));
  batch.delete(db().doc(`mail/${ownerUid}/accounts/${accountId}`));
  batch.delete(db().doc(`mailSecrets/${secretId(ownerUid, accountId)}`));
  await batch.commit();
  return {ok: true};
});

function parseAiJson(text: string) {
  const fenced = text.match(/\{[\s\S]*\}/);
  if (!fenced) throw new Error("no-json");
  return JSON.parse(fenced[0]) as {
    summary?: string;
    classifications?: Array<{id?: string; category?: string; isMailingList?: boolean; summary?: string}>;
    actions?: Array<{
      type?: string;
      messageIds?: string[];
      to?: string;
      subject?: string;
      body?: string;
      label?: string;
      reason?: string;
    }>;
  };
}

export const runMailAi = onCall(AI_OPTS, async (request) => {
  const uid = requireUid(request.auth);
  const ownerUid = ownerFrom(uid, request.data?.ownerUid);
  await requireMailAccess(uid, ownerUid, "edit");
  const settings = (await db().doc(`mail/${ownerUid}/settings/ai`).get()).data() || {};
  const instruction = String(request.data?.instruction || settings.instructions || "").trim();
  if (!instruction) throw new HttpsError("invalid-argument", "Tell the AI what you want it to do.");
  const snap = await db().collection(`mail/${ownerUid}/messages`).limit(80).get();
  const messages = snap.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    return {
      id: item.id,
      from: data.from,
      subject: data.subject,
      snippet: data.snippet,
      folder: data.folder,
      isMailingList: data.isMailingList,
      listUnsubscribe: data.listUnsubscribe,
    };
  });
  if (!messages.length) throw new HttpsError("failed-precondition", "Refresh the mailbox first.");
  const compact = messages.slice(0, 60).map((item) => ({
    id: item.id,
    from: item.from,
    subject: item.subject,
    snippet: String(item.snippet || "").slice(0, 160),
    folder: item.folder,
    isMailingList: Boolean(item.isMailingList),
    listUnsubscribe: item.listUnsubscribe || "",
  }));
  const system = "You help a family manage their mailbox. Follow the user's instructions. " +
    "Never claim you have already sent mail. Propose actions only. Prefer List-Unsubscribe mailto addresses " +
    "for leaving lists. Categories must be one of: personal, list, receipt, promo, social, work, other. " +
    "Return JSON only: {summary, classifications:[{id,category,isMailingList,summary}], " +
    "actions:[{type:unsubscribe|label|draft,messageIds,to,subject,body,label,reason}]}.";
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey.value()}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 1800,
        messages: [
          {role: "system", content: system},
          {role: "user", content: `Instructions:\n${instruction}\n\nMail:\n${JSON.stringify(compact)}`},
        ],
      }),
    });
  } catch (err) {
    logger.error("Mail AI fetch failed", err);
    throw new HttpsError("internal", "Could not reach the AI service.");
  }
  if (!response.ok) {
    logger.error("Mail AI failed", {status: response.status, text: await response.text()});
    throw new HttpsError("internal", "The AI service could not process this mailbox.");
  }
  const data = await response.json() as {choices?: Array<{message?: {content?: string}}>};
  const parsed = parseAiJson(data.choices?.[0]?.message?.content || "");
  let classified = 0;
  for (const row of parsed.classifications || []) {
    if (!row.id) continue;
    await snapMerge(`mail/${ownerUid}/messages/${row.id}`, {
      aiCategory: String(row.category || ""),
      aiSummary: String(row.summary || "").slice(0, 280),
      isMailingList: Boolean(row.isMailingList) || undefined,
    });
    classified += 1;
  }
  const actions = (parsed.actions || []).slice(0, 25).map((action, index) => ({
    id: `act_${index}`,
    type: action.type === "label" || action.type === "draft" ? action.type : "unsubscribe",
    messageIds: Array.isArray(action.messageIds) ? action.messageIds.map(String).slice(0, 40) : [],
    to: String(action.to || ""),
    subject: String(action.subject || ""),
    body: String(action.body || ""),
    label: String(action.label || ""),
    reason: String(action.reason || "").slice(0, 240),
  }));
  const result = {
    summary: String(parsed.summary || "Here is what I found."),
    classified,
    actions,
    ranAt: new Date().toISOString(),
  };
  await db().doc(`mail/${ownerUid}/settings/aiLast`).set({
    ...result,
    updatedAt: FieldValue.serverTimestamp(),
  });
  if (instruction && instruction !== settings.instructions) {
    await snapMerge(`mail/${ownerUid}/settings/ai`, {instructions: instruction});
  }
  return result;
});

export const applyMailAiActions = onCall({...GOOGLE_OPTS, timeoutSeconds: 180}, async (request) => {
  const uid = requireUid(request.auth);
  const ownerUid = ownerFrom(uid, request.data?.ownerUid);
  await requireMailAccess(uid, ownerUid, "edit");
  const wanted = new Set((Array.isArray(request.data?.actionIds) ? request.data.actionIds : []).map(String));
  if (!wanted.size) throw new HttpsError("invalid-argument", "Pick the actions to apply.");
  const last = (await db().doc(`mail/${ownerUid}/settings/aiLast`).get()).data();
  const actions = Array.isArray(last?.actions) ? last.actions as Array<Record<string, unknown>> : [];
  let applied = 0;
  for (const action of actions) {
    if (!wanted.has(String(action.id))) continue;
    if (applied >= 20) break;
    if (action.type === "unsubscribe" || action.type === "draft") {
      const messageId = String((action.messageIds as string[] | undefined)?.[0] || "");
      const message = messageId ? (await db().doc(`mail/${ownerUid}/messages/${messageId}`).get()).data() : null;
      const parsed = parseListUnsubscribe(String(message?.listUnsubscribe || ""));
      const mailto = parsed.mailto || String(action.to || "");
      const oneClick = /one-click/i.test(String(message?.listUnsubscribePost || ""));
      if (oneClick && parsed.http) {
        await fetch(parsed.http, {
          method: "POST",
          headers: {"Content-Type": "application/x-www-form-urlencoded"},
          body: "List-Unsubscribe=One-Click",
        });
      } else if (mailto) {
        const drafted = parseMailtoAction(mailto.includes("@") ? (mailto.startsWith("mailto:") ? mailto.slice(7) : mailto) : "");
        const to = drafted.to || extractEmailAddress(String(action.to || "")) || String(action.to || "");
        const accountId = String(message?.accountId || "");
        if (!to || !accountId) continue;
        await sendThroughAccount(ownerUid, accountId, {
          to: [to],
          cc: [],
          subject: String(action.subject || drafted.subject || "Unsubscribe"),
          body: String(action.body || drafted.body),
        });
      } else {
        continue;
      }
      if (messageId) {
        await snapMerge(`mail/${ownerUid}/messages/${messageId}`, {labels: ["unsubscribed"]});
      }
      applied += 1;
    }
  }
  return {applied};
});

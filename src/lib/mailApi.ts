import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { MailAiResult, MailCompose } from "@/types/mail";

function friendly(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)$/, "") || fallback;
}

async function call<Req extends object, Res>(name: string, payload: Req, fallback: string): Promise<Res> {
  try {
    const fn = httpsCallable<Req, Res>(functions, name);
    return (await fn(payload)).data;
  } catch (err) {
    throw new Error(friendly(err, fallback));
  }
}

export function startGmailConnect(ownerUid?: string) {
  return call<{ ownerUid?: string }, { authUrl: string }>(
    "startGmailConnect",
    { ownerUid },
    "Could not start Gmail. Add the family Google key and the Email callback URL in Google Cloud.",
  ).then((data) => {
    if (!data.authUrl) throw new Error("Could not start Gmail.");
    return data.authUrl;
  });
}

export function connectImapAccount(input: {
  ownerUid?: string;
  email: string;
  password: string;
  displayName?: string;
  imapHost?: string;
  smtpHost?: string;
}) {
  return call<typeof input, { accountId: string }>("connectImapAccount", input, "Could not save that mailbox.");
}

export function syncMailbox(ownerUid?: string, accountId?: string) {
  return call<{ ownerUid?: string; accountId?: string }, { synced: number }>(
    "syncMailbox",
    { ownerUid, accountId },
    "Could not refresh mail.",
  );
}

export function sendMail(input: MailCompose & { ownerUid?: string }) {
  return call<typeof input, { sent: boolean }>("sendMail", input, "Could not send that email.");
}

export function updateMailFlags(input: {
  ownerUid?: string;
  messageId: string;
  unread?: boolean;
  starred?: boolean;
  folder?: "inbox" | "trash";
}) {
  return call<typeof input, { ok: boolean }>("updateMailFlags", input, "Could not update that message.");
}

export function runMailAi(ownerUid?: string, instruction?: string) {
  return call<{ ownerUid?: string; instruction?: string }, MailAiResult>(
    "runMailAi",
    { ownerUid, instruction },
    "Could not run AI on this mailbox.",
  );
}

export function applyMailAiActions(ownerUid: string | undefined, actionIds: string[]) {
  return call<{ ownerUid?: string; actionIds: string[] }, { applied: number }>(
    "applyMailAiActions",
    { ownerUid, actionIds },
    "Could not apply those AI actions.",
  );
}

export function disconnectMailAccount(ownerUid: string | undefined, accountId: string) {
  return call<{ ownerUid?: string; accountId: string }, { ok: boolean }>(
    "disconnectMailAccount",
    { ownerUid, accountId },
    "Could not disconnect that account.",
  );
}

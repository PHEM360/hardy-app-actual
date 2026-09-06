import type { MailAiCategory, MailFolder, MailMessage, MailRail } from "@/types/mail";

export const DEFAULT_MAIL_INSTRUCTIONS =
  "Keep personal and work mail easy to find. Flag newsletters and mailing lists. Spot receipts and login alerts. When I ask, draft polite unsubscribe emails — never send them until I confirm.";

const HOSTS: Record<string, { imap: string; smtp: string }> = {
  "gmail.com": { imap: "imap.gmail.com", smtp: "smtp.gmail.com" },
  "googlemail.com": { imap: "imap.gmail.com", smtp: "smtp.gmail.com" },
  "outlook.com": { imap: "outlook.office365.com", smtp: "smtp.office365.com" },
  "hotmail.com": { imap: "outlook.office365.com", smtp: "smtp.office365.com" },
  "live.com": { imap: "outlook.office365.com", smtp: "smtp.office365.com" },
  "msn.com": { imap: "outlook.office365.com", smtp: "smtp.office365.com" },
  "icloud.com": { imap: "imap.mail.me.com", smtp: "smtp.mail.me.com" },
  "me.com": { imap: "imap.mail.me.com", smtp: "smtp.mail.me.com" },
  "mac.com": { imap: "imap.mail.me.com", smtp: "smtp.mail.me.com" },
  "yahoo.com": { imap: "imap.mail.yahoo.com", smtp: "smtp.mail.yahoo.com" },
  "ymail.com": { imap: "imap.mail.yahoo.com", smtp: "smtp.mail.yahoo.com" },
  "btinternet.com": { imap: "mail.btinternet.com", smtp: "mail.btinternet.com" },
  "virginmedia.com": { imap: "imap.virginmedia.com", smtp: "smtp.virginmedia.com" },
};

export function extractEmailAddress(value: string): string {
  const angle = value.match(/<([^>]+)>/);
  const raw = (angle?.[1] || value).trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw) ? raw : "";
}

export function extractDisplayName(value: string): string {
  const trimmed = value.trim();
  const angle = trimmed.match(/^(.*)<([^>]+)>\s*$/);
  if (angle) {
    const name = angle[1].replace(/^["']|["']$/g, "").trim();
    return name || extractEmailAddress(trimmed);
  }
  return extractEmailAddress(trimmed) || trimmed;
}

export function guessMailHosts(email: string): { imap: string; smtp: string } | null {
  const domain = extractEmailAddress(email).split("@")[1] || "";
  return HOSTS[domain] || null;
}

export function parseListUnsubscribe(header: string): { mailto: string; http: string } {
  const mailto = header.match(/<mailto:([^>]+)>/i)?.[1] || "";
  const http = header.match(/<(https?:\/\/[^>]+)>/i)?.[1] || "";
  const bareMailto = !mailto && header.toLowerCase().startsWith("mailto:") ? header.slice(7) : "";
  const bareHttp = !http && /^https?:\/\//i.test(header.trim()) ? header.trim() : "";
  return { mailto: decodeURIComponent((mailto || bareMailto).trim()), http: http || bareHttp };
}

export function isMailingListMessage(input: {
  listUnsubscribe?: string;
  listId?: string;
  precedence?: string;
  from?: string;
}): boolean {
  if (String(input.listUnsubscribe || "").trim()) return true;
  if (String(input.listId || "").trim()) return true;
  const precedence = String(input.precedence || "").toLowerCase();
  if (precedence.includes("list") || precedence.includes("bulk")) return true;
  const from = extractEmailAddress(input.from || "");
  return /no-?reply|newsletter|news@|updates@|mailer-daemon/i.test(from);
}

export function looksLikeReceipt(subject: string, from: string): boolean {
  return /receipt|invoice|order confirmation|payment|your order/i.test(`${subject} ${from}`);
}

export function inferMailCategory(message: Pick<MailMessage, "subject" | "from" | "isMailingList" | "listUnsubscribe">): MailAiCategory {
  if (message.isMailingList || message.listUnsubscribe) return "list";
  if (looksLikeReceipt(message.subject, message.from)) return "receipt";
  if (/verify|security code|one-time|login|sign-in|password/i.test(message.subject)) return "work";
  if (/facebook|instagram|linkedin|twitter|tiktok|youtube/i.test(message.from)) return "social";
  if (/sale|offer|% off|discount|deal/i.test(message.subject)) return "promo";
  return "personal";
}

export function filterMailMessages(
  messages: MailMessage[],
  rail: MailRail,
  accountId: string,
  query: string,
): MailMessage[] {
  const needle = query.trim().toLowerCase();
  return messages
    .filter((message) => {
      if (accountId !== "all" && message.accountId !== accountId) return false;
      if (rail === "inbox") return message.folder === "inbox";
      if (rail === "unread") return message.unread && message.folder !== "trash";
      if (rail === "starred") return message.starred && message.folder !== "trash";
      if (rail === "sent") return message.folder === "sent";
      if (rail === "lists") return message.isMailingList && message.folder !== "trash";
      return message.folder !== "trash";
    })
    .filter((message) => {
      if (!needle) return true;
      return [message.from, message.fromName, message.subject, message.snippet, message.bodyText]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .sort((a, b) => Date.parse(b.date || "") - Date.parse(a.date || "") || a.subject.localeCompare(b.subject));
}

export function sanitizeMailText(value: string, max = 20000): string {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, max);
}

export function quoteReplyBody(from: string, date: string, body: string): string {
  const stamped = date ? `On ${date}, ${from} wrote:` : `${from} wrote:`;
  const quoted = sanitizeMailText(body, 8000)
    .split("\n")
    .map((line) => `> ${line}`.trimEnd())
    .join("\n");
  return `\n\n${stamped}\n${quoted}`;
}

export function replySubject(subject: string): string {
  const clean = subject.replace(/^\s*(re|fw|fwd)\s*:\s*/i, "").trim();
  return clean ? `Re: ${clean}` : "Re:";
}

export function forwardSubject(subject: string): string {
  const clean = subject.replace(/^\s*(re|fw|fwd)\s*:\s*/i, "").trim();
  return clean ? `Fwd: ${clean}` : "Fwd:";
}

export function folderFromLabels(labels: string[]): MailFolder {
  const set = new Set(labels.map((label) => label.toUpperCase()));
  if (set.has("TRASH") || set.has("BIN")) return "trash";
  if (set.has("DRAFT") || set.has("DRAFTS")) return "drafts";
  if (set.has("SENT") || set.has("SENTMAIL")) return "sent";
  return "inbox";
}

export function splitAddressList(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((item) => extractEmailAddress(item) || item.trim())
    .filter(Boolean);
}

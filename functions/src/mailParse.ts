export interface MailHosts {
  imap: string;
  smtp: string;
}

const HOSTS: Record<string, MailHosts> = {
  "gmail.com": {imap: "imap.gmail.com", smtp: "smtp.gmail.com"},
  "googlemail.com": {imap: "imap.gmail.com", smtp: "smtp.gmail.com"},
  "outlook.com": {imap: "outlook.office365.com", smtp: "smtp.office365.com"},
  "hotmail.com": {imap: "outlook.office365.com", smtp: "smtp.office365.com"},
  "live.com": {imap: "outlook.office365.com", smtp: "smtp.office365.com"},
  "msn.com": {imap: "outlook.office365.com", smtp: "smtp.office365.com"},
  "icloud.com": {imap: "imap.mail.me.com", smtp: "smtp.mail.me.com"},
  "me.com": {imap: "imap.mail.me.com", smtp: "smtp.mail.me.com"},
  "mac.com": {imap: "imap.mail.me.com", smtp: "smtp.mail.me.com"},
  "yahoo.com": {imap: "imap.mail.yahoo.com", smtp: "smtp.mail.yahoo.com"},
  "ymail.com": {imap: "imap.mail.yahoo.com", smtp: "smtp.mail.yahoo.com"},
  "btinternet.com": {imap: "mail.btinternet.com", smtp: "mail.btinternet.com"},
  "virginmedia.com": {imap: "imap.virginmedia.com", smtp: "smtp.virginmedia.com"},
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

export function guessMailHosts(email: string): MailHosts | null {
  const domain = extractEmailAddress(email).split("@")[1] || "";
  return HOSTS[domain] || null;
}

export function parseListUnsubscribe(header: string): {mailto: string; http: string} {
  const mailto = header.match(/<mailto:([^>]+)>/i)?.[1] || "";
  const http = header.match(/<(https?:\/\/[^>]+)>/i)?.[1] || "";
  const bareMailto = !mailto && header.toLowerCase().startsWith("mailto:") ? header.slice(7) : "";
  const bareHttp = !http && /^https?:\/\//i.test(header.trim()) ? header.trim() : "";
  return {mailto: decodeURIComponent((mailto || bareMailto).trim()), http: http || bareHttp};
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

export function decodeBase64Url(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function sanitizeMailText(value: string, max = 20000): string {
  return String(value || "")
    .split("").filter((ch) => ch !== String.fromCharCode(0)).join("")
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

export function splitAddressList(value: string): string[] {
  return value
    .split(/[,;]+/)
    .map((item) => extractEmailAddress(item) || item.trim())
    .filter(Boolean);
}

export function headerValue(headers: Array<{name?: string; value?: string}> | undefined, name: string): string {
  const wanted = name.toLowerCase();
  return String(headers?.find((header) => String(header.name || "").toLowerCase() === wanted)?.value || "");
}

export function folderFromLabels(labels: string[]): "inbox" | "sent" | "drafts" | "trash" {
  const set = new Set(labels.map((label) => label.toUpperCase()));
  if (set.has("TRASH") || set.has("BIN")) return "trash";
  if (set.has("DRAFT") || set.has("DRAFTS")) return "drafts";
  if (set.has("SENT") || set.has("SENTMAIL")) return "sent";
  return "inbox";
}

export function safeDocId(value: string): string {
  return value.replace(/[^\w.-]+/g, "_").slice(0, 700);
}

export function buildRfc822(input: {
  from: string;
  to: string[];
  cc?: string[];
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `From: ${input.from}`,
    `To: ${input.to.join(", ")}`,
  ];
  if (input.cc?.length) lines.push(`Cc: ${input.cc.join(", ")}`);
  lines.push(`Subject: ${input.subject.replace(/[\r\n]+/g, " ")}`);
  if (input.inReplyTo) lines.push(`In-Reply-To: ${input.inReplyTo}`);
  if (input.references) lines.push(`References: ${input.references}`);
  lines.push("MIME-Version: 1.0");
  lines.push("Content-Type: text/plain; charset=utf-8");
  lines.push("");
  lines.push(input.body);
  return lines.join("\r\n");
}

function decodeQuotedPrintable(value: string): string {
  return value
    .replace(/=\r?\n/g, "")
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

export function extractTextFromRfc822(raw: string): string {
  const parts = raw.split(/\r\n--/);
  const plain = parts.find((part) => /Content-Type:\s*text\/plain/i.test(part));
  const html = parts.find((part) => /Content-Type:\s*text\/html/i.test(part));
  const chosen = plain || html;
  if (chosen) {
    const idx = chosen.search(/\r\n\r\n/);
    let body = idx >= 0 ? chosen.slice(idx + 4) : chosen;
    if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(chosen)) body = decodeQuotedPrintable(body);
    if (/Content-Transfer-Encoding:\s*base64/i.test(chosen)) {
      body = Buffer.from(body.replace(/\s+/g, ""), "base64").toString("utf8");
    }
    return sanitizeMailText(body);
  }
  const headerEnd = raw.search(/\r\n\r\n/);
  return sanitizeMailText(headerEnd >= 0 ? raw.slice(headerEnd + 4) : raw);
}

export function parseMailtoAction(value: string): {to: string; subject: string; body: string} {
  const [toPart, query = ""] = value.split("?");
  const params = new URLSearchParams(query);
  return {
    to: extractEmailAddress(toPart) || toPart.trim(),
    subject: params.get("subject") || "Unsubscribe",
    body: params.get("body") || "Please unsubscribe me from this mailing list.",
  };
}

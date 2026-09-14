import { parseListUnsubscribe } from "@/lib/mailLogic";
import type { CalendarEvent } from "@/types/app";

export type MailEventDraft = {
  id: string;
  subject: string;
  from: string;
  suggestedTitle: string;
  suggestedDate: string;
  suggestedTime: string;
  suggestedEndTime: string;
  notes: string;
  unsubscribeUrl?: string;
};

type MailLike = {
  id?: string;
  from?: string;
  subject?: string;
  date?: string;
  body?: string;
  bodyText?: string;
  snippet?: string;
  isMailingList?: boolean;
  listUnsubscribe?: string;
};

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3,
  apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const SKIP_SUBJECT = /\b(unsubscribe|newsletter|webinar|sale|% off|mailing list)\b/i;

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function parseDateNear(text: string, now: Date): string | null {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const uk = text.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](20\d{2})\b/);
  if (uk) return `${uk[3]}-${pad(Number(uk[2]))}-${pad(Number(uk[1]))}`;

  const named = text.match(
    /\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)(?:\s+(20\d{2}))?\b/i,
  );
  if (named) {
    const month = MONTHS[named[2].toLowerCase()];
    const year = named[3] ? Number(named[3]) : now.getFullYear();
    if (month) return `${year}-${pad(month)}-${pad(Number(named[1]))}`;
  }

  const named2 = text.match(
    /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t|tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d{2}))?\b/i,
  );
  if (named2) {
    const month = MONTHS[named2[1].toLowerCase()];
    const year = named2[3] ? Number(named2[3]) : now.getFullYear();
    if (month) return `${year}-${pad(month)}-${pad(Number(named2[2]))}`;
  }

  return null;
}

function to24(hour: number, minute: number, mer?: string | null): string | null {
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour > 23 || minute > 59) return null;
  let h = hour;
  const merLower = (mer || "").toLowerCase();
  if (merLower === "pm" && h < 12) h += 12;
  if (merLower === "am" && h === 12) h = 0;
  return `${pad(h)}:${pad(minute)}`;
}

function parseTime(text: string): { start: string; end: string } | null {
  const range = text.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|\s+to\s+)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i,
  );
  if (range) {
    const start = to24(Number(range[1]), Number(range[2] || 0), range[3] || range[6]);
    const end = to24(Number(range[4]), Number(range[5] || 0), range[6] || range[3]);
    if (start && end) return { start, end };
  }
  const one = text.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (one) {
    const start = to24(Number(one[1]), Number(one[2] || 0), one[3]);
    if (!start) return null;
    const [h, m] = start.split(":").map(Number);
    const endH = Math.min(23, h + 1);
    return { start, end: `${pad(endH)}:${pad(m)}` };
  }
  return null;
}

export function unsubscribeActionFromText(text: string): { http?: string; mailto?: string } | null {
  const parsed = parseListUnsubscribe(text);
  if (parsed.http || parsed.mailto) {
    return { http: parsed.http || undefined, mailto: parsed.mailto || undefined };
  }
  const url = text.match(/https?:\/\/[^\s<>"]+/i)?.[0];
  if (url && /unsub|opt-?out|list-manage|manage[- ]preferences/i.test(url)) {
    return { http: url };
  }
  return null;
}

/** Cheap regex drafts. Never auto-creates calendar events. */
export function draftEventsFromMail(messages: MailLike[], now = new Date()): MailEventDraft[] {
  const drafts: MailEventDraft[] = [];
  for (const msg of messages) {
    if (msg.isMailingList) continue;
    const subject = (msg.subject || "").trim();
    if (!subject || SKIP_SUBJECT.test(subject)) continue;
    const body = `${msg.bodyText || msg.body || ""}\n${msg.snippet || ""}`;
    const hay = `${subject}\n${body}`;
    const date = parseDateNear(hay, now);
    if (!date) continue;
    const times = parseTime(hay);
    const unsub = unsubscribeActionFromText(msg.listUnsubscribe || hay);
    drafts.push({
      id: msg.id || `${subject}-${date}`,
      subject,
      from: msg.from || "",
      suggestedTitle: subject.replace(/^(re|fwd):\s*/i, "").slice(0, 80),
      suggestedDate: date,
      suggestedTime: times?.start || "09:00",
      suggestedEndTime: times?.end || "10:00",
      notes: `From mail${msg.from ? ` (${msg.from})` : ""}`,
      unsubscribeUrl: unsub?.http,
    });
    if (drafts.length >= 8) break;
  }
  return drafts;
}

export function draftFromPastedText(text: string, now = new Date()): MailEventDraft | null {
  const date = parseDateNear(text, now);
  if (!date) return null;
  const times = parseTime(text);
  const firstLine = text.split("\n").map((line) => line.trim()).find(Boolean) || "Pasted event";
  return {
    id: "paste",
    subject: firstLine.slice(0, 80),
    from: "",
    suggestedTitle: firstLine.slice(0, 80),
    suggestedDate: date,
    suggestedTime: times?.start || "09:00",
    suggestedEndTime: times?.end || "10:00",
    notes: "From pasted text",
    unsubscribeUrl: unsubscribeActionFromText(text)?.http,
  };
}

export function draftToEventInput(draft: MailEventDraft): Omit<CalendarEvent, "id"> {
  const startDate = new Date(`${draft.suggestedDate}T${draft.suggestedTime}:00`).toISOString();
  const endDate = new Date(`${draft.suggestedDate}T${draft.suggestedEndTime}:00`).toISOString();
  return {
    title: draft.suggestedTitle,
    category: "other",
    startDate,
    endDate,
    allDay: false,
    description: draft.notes,
    source: "local",
  };
}

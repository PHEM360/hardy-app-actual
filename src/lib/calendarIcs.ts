import type { CalendarEvent } from "@/types/app";

function unfoldIcs(raw: string): string {
  return raw.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
}

function unescapeIcs(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function escapeIcs(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function parseIcsDate(value: string): { iso: string; allDay: boolean } {
  const cleaned = value.replace(/^.*?:/, "").trim();
  if (/^\d{8}$/.test(cleaned)) {
    return { iso: `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6, 8)}T00:00:00`, allDay: true };
  }
  const match = cleaned.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/);
  if (!match) {
    const parsed = new Date(cleaned);
    return { iso: Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString(), allDay: false };
  }
  const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${match[7] ? "Z" : ""}`;
  return { iso: new Date(iso).toISOString(), allDay: false };
}

export function parseIcsEvents(ics: string, feedId: string): CalendarEvent[] {
  const text = unfoldIcs(ics);
  const blocks = text.split("BEGIN:VEVENT").slice(1);
  return blocks.map((block, index) => {
    const body = block.split("END:VEVENT")[0] || "";
    const field = (name: string) => {
      const line = body.split("\n").find((row) => row.startsWith(`${name}`) || row.startsWith(`${name};`) || row.startsWith(`${name}:`));
      if (!line) return "";
      return unescapeIcs(line.slice(line.indexOf(":") + 1).trim());
    };
    const startRaw = body.split("\n").find((row) => row.startsWith("DTSTART")) || "";
    const endRaw = body.split("\n").find((row) => row.startsWith("DTEND")) || startRaw;
    const start = parseIcsDate(startRaw);
    const end = parseIcsDate(endRaw);
    return {
      title: field("SUMMARY") || "Untitled",
      description: field("DESCRIPTION") || "",
      location: field("LOCATION") || "",
      category: "other",
      startDate: start.iso,
      endDate: end.iso,
      allDay: start.allDay,
      source: "import",
      feedId,
      googleEventId: field("UID") || `${feedId}_${index}`,
    } as CalendarEvent;
  }).filter((event) => event.title);
}

function stamp(iso: string, allDay?: boolean): string {
  const date = new Date(iso);
  if (allDay) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, "0");
    const d = String(date.getUTCDate()).padStart(2, "0");
    return `;VALUE=DATE:${y}${m}${d}`;
  }
  return `:${date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`;
}

export function eventsToIcs(events: CalendarEvent[], calendarName = "Hardy Hub"): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hardy Hub//Merged Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calendarName)}`,
  ];
  for (const event of events) {
    const uid = event.id || event.googleEventId || `${event.startDate}-${event.title}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}@hardyhub`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")}`,
      `DTSTART${stamp(event.startDate, event.allDay)}`,
      `DTEND${stamp(event.endDate || event.startDate, event.allDay)}`,
      `SUMMARY:${escapeIcs(event.title || "Untitled")}`,
    );
    if (event.description) lines.push(`DESCRIPTION:${escapeIcs(event.description)}`);
    if (event.location) lines.push(`LOCATION:${escapeIcs(event.location)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

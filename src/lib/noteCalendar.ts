import { format, parseISO } from "date-fns";

function icsEscape(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function googleCalendarUrl(title: string, date: string, details?: string): string {
  const day = date.replace(/-/g, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${day}/${day}`,
  });
  if (details) params.set("details", details);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcsCalendar(
  events: { title: string; date: string; description?: string; id?: string }[],
  calendarName = "Hardy Hub Notes"
): string {
  const stamp = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hardy Hub//Notes//EN",
    `X-WR-CALNAME:${icsEscape(calendarName)}`,
    "CALSCALE:GREGORIAN",
  ];
  for (const ev of events) {
    if (!ev.date) continue;
    let day = ev.date.replace(/-/g, "");
    try {
      day = format(parseISO(ev.date.length === 10 ? `${ev.date}T12:00:00` : ev.date), "yyyyMMdd");
    } catch {
      /* keep stripped date */
    }
    const uid = `${ev.id || day}-${ev.title.replace(/\s+/g, "").slice(0, 24)}@hardyhub`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${day}`,
      `DTEND;VALUE=DATE:${day}`,
      `SUMMARY:${icsEscape(ev.title)}`,
    );
    if (ev.description) lines.push(`DESCRIPTION:${icsEscape(ev.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function downloadIcs(filename: string, ics: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

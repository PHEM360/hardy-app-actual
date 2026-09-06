export interface GoogleCalendarEventInput {
  id?: string;
  summary?: string;
  description?: string;
  location?: string;
  status?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

export interface LocalGoogleEvent {
  title: string;
  description: string;
  location: string;
  category: "other";
  startDate: string;
  endDate: string;
  allDay: boolean;
  source: "google";
  googleEventId: string;
  googleCalendarId: string;
}

export function googleCalendarDocId(calendarId: string, eventId: string) {
  return `g_${calendarId}_${eventId}`.replace(/[^\w.-]+/g, "_").slice(0, 700);
}

function asIso(value?: string, endOfDay = false) {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T${endOfDay ? "23:59:00" : "00:00:00"}`).toISOString();
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export function mapGoogleCalendarEvent(
  item: GoogleCalendarEventInput,
  calendarId: string,
): LocalGoogleEvent | null {
  const eventId = String(item.id || "");
  if (!eventId || item.status === "cancelled") return null;
  const startDate = asIso(item.start?.dateTime || item.start?.date);
  const endDate = asIso(item.end?.dateTime || item.end?.date, Boolean(item.end?.date));
  if (!startDate || !endDate) return null;
  return {
    title: String(item.summary || "(No title)"),
    description: String(item.description || ""),
    location: String(item.location || ""),
    category: "other",
    startDate,
    endDate,
    allDay: Boolean(item.start?.date && !item.start?.dateTime),
    source: "google",
    googleEventId: eventId,
    googleCalendarId: calendarId,
  };
}

export function toGoogleCalendarBody(event: {
  title: string;
  description?: string;
  location?: string;
  startDate: string;
  endDate: string;
  allDay?: boolean;
}) {
  if (event.allDay) {
    const start = event.startDate.slice(0, 10);
    const end = event.endDate.slice(0, 10);
    return {
      summary: event.title,
      description: event.description || "",
      location: event.location || "",
      start: { date: start },
      end: { date: end || start },
    };
  }
  return {
    summary: event.title,
    description: event.description || "",
    location: event.location || "",
    start: { dateTime: event.startDate },
    end: { dateTime: event.endDate },
  };
}

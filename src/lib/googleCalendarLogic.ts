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

export function selectedGoogleCalendarIds(
  items: Array<{ id?: string; primary?: boolean; selected?: boolean }>,
): string[] {
  const picked = items
    .filter((item) => item.id && (item.primary || item.selected))
    .map((item) => String(item.id));
  return picked.length ? [...new Set(picked)] : ["primary"];
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
  const allDay = Boolean(item.start?.date && !item.start?.dateTime);
  // #region agent log
  if (allDay) fetch('http://127.0.0.1:7273/ingest/12c3017c-bccf-4cf4-8368-d19daf135fd3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0e345a'},body:JSON.stringify({sessionId:'0e345a',runId:'audit',hypothesisId:'H1',location:'googleCalendarLogic.ts:mapGoogleCalendarEvent',message:'mapped Google all-day event',data:{googleStart:item.start?.date||null,googleEnd:item.end?.date||null,storedStart:startDate,storedEnd:endDate},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return {
    title: String(item.summary || "(No title)"),
    description: String(item.description || ""),
    location: String(item.location || ""),
    category: "other",
    startDate,
    endDate,
    allDay,
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
    // #region agent log
    fetch('http://127.0.0.1:7273/ingest/12c3017c-bccf-4cf4-8368-d19daf135fd3',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'0e345a'},body:JSON.stringify({sessionId:'0e345a',runId:'audit',hypothesisId:'H2',location:'googleCalendarLogic.ts:toGoogleCalendarBody',message:'pushing all-day event to Google',data:{start,end,sameDay:start===end},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

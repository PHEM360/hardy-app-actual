import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

function friendly(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : fallback;
  return message.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)$/, "") || fallback;
}

export async function startGoogleCalendarConnect(): Promise<string> {
  const call = httpsCallable<Record<string, never>, { authUrl: string }>(functions, "startGoogleCalendarConnect");
  try {
    const result = await call({});
    if (!result.data.authUrl) throw new Error("Could not start Google Calendar.");
    return result.data.authUrl;
  } catch (err) {
    throw new Error(friendly(err, "Could not start Google Calendar. An admin may still need to add the family Google login in Settings."));
  }
}

export async function listGoogleCalendars(ownerUid?: string) {
  const call = httpsCallable<{ ownerUid?: string }, { calendars: Array<{ id: string; name: string; primary: boolean }> }>(
    functions,
    "listGoogleCalendars",
  );
  try {
    return (await call({ ownerUid })).data.calendars;
  } catch (err) {
    throw new Error(friendly(err, "Could not list Google calendars."));
  }
}

export async function saveGoogleCalendarSelection(calendarIds: string[], writeCalendarId?: string, ownerUid?: string) {
  const call = httpsCallable(functions, "saveGoogleCalendarSelection");
  try {
    await call({ calendarIds, writeCalendarId, ownerUid });
  } catch (err) {
    throw new Error(friendly(err, "Could not save that calendar selection."));
  }
}

export async function syncGoogleCalendar(ownerUid?: string) {
  const call = httpsCallable<{ ownerUid?: string }, { upserted: number; removed: number }>(functions, "syncGoogleCalendar");
  try {
    return (await call({ ownerUid })).data;
  } catch (err) {
    throw new Error(friendly(err, "Could not sync Google Calendar."));
  }
}

export async function pushCalendarEvent(eventId: string, ownerUid?: string) {
  const call = httpsCallable(functions, "pushCalendarEvent");
  try {
    await call({ eventId, ownerUid });
  } catch (err) {
    throw new Error(friendly(err, "Could not update Google Calendar."));
  }
}

export async function disconnectGoogleCalendar() {
  const call = httpsCallable(functions, "disconnectGoogleCalendar");
  try {
    await call({});
  } catch (err) {
    throw new Error(friendly(err, "Could not disconnect Google Calendar."));
  }
}

export async function googleOAuthStatus() {
  const call = httpsCallable<Record<string, never>, { configured: boolean; clientHint: string; redirects: string[] }>(
    functions,
    "googleOAuthStatus",
  );
  try {
    return (await call({})).data;
  } catch {
    return { configured: false, clientHint: "", redirects: [] as string[] };
  }
}

export async function saveGoogleOAuthClient(clientId: string, clientSecret: string) {
  const call = httpsCallable(functions, "saveGoogleOAuthClient");
  try {
    await call({ clientId, clientSecret });
  } catch (err) {
    throw new Error(friendly(err, "Could not save the family Google login."));
  }
}

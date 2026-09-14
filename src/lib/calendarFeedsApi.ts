import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { CalendarFeed } from "@/types/app";

export async function syncCalendarFeed(feed: Pick<CalendarFeed, "id" | "name" | "url">) {
  const call = httpsCallable<typeof feed, { upserted: number }>(functions, "syncCalendarFeed");
  const result = await call(feed);
  return result.data;
}

export async function publishMergedCalendar() {
  const call = httpsCallable<Record<string, never>, { token: string; url: string }>(functions, "publishMergedCalendar");
  const result = await call({});
  return result.data;
}

export function mergedCalendarSubscribeUrl(token: string): string {
  const project = import.meta.env.VITE_FIREBASE_PROJECT_ID || "hardyhub-7b30d";
  return `https://us-central1-${project}.cloudfunctions.net/mergedCalendarIcs?token=${encodeURIComponent(token)}`;
}

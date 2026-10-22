/**
 * Assemble a real daily brief from tasks, calendar, birthdays and pets.
 */
import * as admin from "firebase-admin";
import { DailyDigestPrefs } from "./types";
import { londonTodayString } from "./calculations";

function asDateString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof admin.firestore.Timestamp) {
    return value.toDate().toISOString().slice(0, 10);
  }
  return "";
}

export async function buildDailyBrief(
  uid: string,
  digest: DailyDigestPrefs,
): Promise<{ title: string; text: string; html: string }> {
  const today = londonTodayString();
  const lines: string[] = [];
  const includeTasks = digest.includeTasks !== false;
  const includeCalendar = digest.includeCalendar !== false;
  const includeBirthdays = digest.includeBirthdays !== false;
  const includePets = digest.includePets === true;

  if (includeTasks) {
    const snap = await admin.firestore().collection(`tasks/${uid}/items`).limit(200).get();
    const dueToday = snap.docs
      .map((d) => d.data())
      .filter((t) => {
        const status = String(t.status || "").toLowerCase();
        if (status === "done" || status === "completed" || t.completed === true) return false;
        const due = asDateString(t.dueDate || t.due);
        return due === today || t.isToday === true;
      })
      .slice(0, 8);
    if (dueToday.length) {
      lines.push(`Tasks due today (${dueToday.length}):`);
      for (const t of dueToday) {
        lines.push(`• ${String(t.title || "Untitled task").trim()}`);
      }
    } else {
      lines.push("No open tasks due today.");
    }
  }

  if (includeCalendar) {
    const snap = await admin.firestore().collection(`calendar/${uid}/events`).limit(200).get();
    const todayEvents = snap.docs
      .map((d) => d.data())
      .filter((e) => {
        const start = asDateString(e.start || e.startDate || e.date);
        return start === today;
      })
      .slice(0, 6);
    if (todayEvents.length) {
      lines.push("");
      lines.push(`On the calendar (${todayEvents.length}):`);
      for (const e of todayEvents) {
        const title = String(e.title || e.summary || "Event").trim();
        const time = String(e.startTime || e.time || "").trim();
        lines.push(time ? `• ${time} ${title}` : `• ${title}`);
      }
    }
  }

  if (includeBirthdays) {
    const snap = await admin.firestore().collection("birthdays").where("ownerId", "==", uid).limit(100).get();
    const upcoming: string[] = [];
    const todayDate = new Date(`${today}T12:00:00Z`);
    for (const doc of snap.docs) {
      const b = doc.data();
      const md = String(b.monthDay || b.date || "").trim(); // MM-DD or YYYY-MM-DD
      const mmdd = md.length >= 5 ? md.slice(-5) : "";
      if (!/^\d{2}-\d{2}$/.test(mmdd)) continue;
      const candidate = `${today.slice(0, 4)}-${mmdd}`;
      const when = new Date(`${candidate}T12:00:00Z`);
      let diff = Math.round((when.getTime() - todayDate.getTime()) / 86400000);
      if (diff < 0) diff += 365;
      if (diff <= 7) {
        const name = String(b.name || b.displayName || "Someone").trim();
        upcoming.push(diff === 0 ? `${name} (today)` : `${name} (in ${diff}d)`);
      }
    }
    if (upcoming.length) {
      lines.push("");
      lines.push(`Birthdays: ${upcoming.slice(0, 5).join(", ")}`);
    }
  }

  if (includePets) {
    const snap = await admin.firestore().collection("pets").where("ownerId", "==", uid).limit(50).get();
    const due: string[] = [];
    for (const doc of snap.docs) {
      const p = doc.data();
      const name = String(p.name || "Pet").trim();
      const flea = asDateString(p.nextFlea || p.fleaDue);
      const worm = asDateString(p.nextWormer || p.wormerDue);
      if (flea && flea <= today) due.push(`${name}: flea due`);
      if (worm && worm <= today) due.push(`${name}: wormer due`);
    }
    if (due.length) {
      lines.push("");
      lines.push(`Pet care: ${due.slice(0, 5).join("; ")}`);
    }
  }

  if (lines.length === 0) {
    lines.push("Your day looks clear. Open Hardy Hub when you are ready.");
  }

  const text = lines.join("\n").trim();
  const html = `<p>${text
    .split("\n")
    .map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"))
    .join("<br/>")}</p>`;

  return {
    title: "Your daily brief",
    text,
    html,
  };
}

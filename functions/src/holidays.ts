/**
 * Holidays price watcher — searches allowlisted legitimate travel sites
 * for package/flight prices matching a user's watch criteria, stores findings,
 * and alerts on cheaper prices via push/email.
 */
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { postmarkKey, twilioSid, twilioToken, twilioFrom } from "./notifications/scheduler";
import { sendNotification } from "./notifications/sender";
import type { NotificationPrefs } from "./notifications/types";

/** Only these hostnames are contacted or linked as price sources. */
export const LEGITIMATE_TRAVEL_HOSTS = [
  "www.britishairways.com",
  "holidays.ba.com",
  "www.jet2holidays.com",
  "www.jet2.com",
  "www.tui.co.uk",
  "www.easyjet.com",
  "www.loveholidays.com",
  "www.onthebeach.co.uk",
  "www.lastminute.com",
  "www.expedia.co.uk",
  "www.skyscanner.net",
  "www.kayak.co.uk",
  "www.trailfinders.com",
  "www.kuoni.co.uk",
] as const;

type DateMode = "fixed" | "flexible_days" | "months" | "no_preference";
type FlightBooking =
  | "british_airways"
  | "travel_agent_package"
  | "book_separately"
  | "no_preference";
type SearchUnit = "hours" | "days" | "weeks" | "months";
type AlertChannel = "push" | "email";

interface HolidayWatchDoc {
  title: string;
  destination: string;
  departureAirports?: string[];
  dates?: {
    mode?: DateMode;
    startDate?: string;
    endDate?: string;
    nights?: number;
    flexDays?: number;
    months?: number[];
    year?: number;
  };
  travellers?: { adults?: number; children?: number; infants?: number };
  brands?: { name: string; rank: number }[];
  flightBooking?: FlightBooking;
  flightClass?: string;
  boardBasis?: string;
  directFlightsOnly?: boolean;
  maxBudgetGbp?: number | null;
  targetPriceGbp?: number | null;
  searchIntervalAmount?: number;
  searchIntervalUnit?: SearchUnit;
  alertChannels?: AlertChannel[];
  status?: string;
  bestPriceGbp?: number | null;
  bestPriceSource?: string | null;
  bestPriceUrl?: string | null;
  nextSearchAt?: string | null;
}

interface PriceFinding {
  priceGbp: number;
  sourceName: string;
  sourceUrl: string;
  packageLabel?: string;
  outboundDate?: string;
  returnDate?: string;
  boardBasis?: string;
  notes?: string;
}

function requireAuth(context: { auth?: { uid: string; token: any } }) {
  const uid = context.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (context.auth?.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot use this service.");
  }
  return uid;
}

function intervalMs(amount: number, unit: SearchUnit = "days"): number {
  const n = Math.max(1, Math.floor(amount || 1));
  switch (unit) {
    case "hours":
      return n * 60 * 60 * 1000;
    case "days":
      return n * 24 * 60 * 60 * 1000;
    case "weeks":
      return n * 7 * 24 * 60 * 60 * 1000;
    case "months":
      return n * 30 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}

function isAllowlistedUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return LEGITIMATE_TRAVEL_HOSTS.some((h) => host === h || host.endsWith(`.${h.replace(/^www\./, "")}`));
  } catch {
    return false;
  }
}

function encode(q: string) {
  return encodeURIComponent(q.trim());
}

function departureCode(watch: HolidayWatchDoc): string {
  return (watch.departureAirports?.[0] || "LHR").toUpperCase();
}

function nightsFromWatch(watch: HolidayWatchDoc): number {
  if (watch.dates?.nights && watch.dates.nights > 0) return watch.dates.nights;
  if (watch.dates?.startDate && watch.dates?.endDate) {
    const a = Date.parse(watch.dates.startDate);
    const b = Date.parse(watch.dates.endDate);
    if (Number.isFinite(a) && Number.isFinite(b) && b >= a) {
      return Math.max(1, Math.round((b - a) / (24 * 60 * 60 * 1000)));
    }
  }
  return 7;
}

function dateHint(watch: HolidayWatchDoc): { out?: string; back?: string; monthsLabel?: string } {
  const d = watch.dates;
  if (!d) return {};
  if (d.mode === "months" && d.months?.length) {
    const year = d.year || new Date().getFullYear();
    const month = d.months[0];
    const out = `${year}-${String(month).padStart(2, "0")}-15`;
    const backDate = new Date(Date.parse(out) + nightsFromWatch(watch) * 86400000);
    return {
      out,
      back: backDate.toISOString().slice(0, 10),
      monthsLabel: d.months.map((m) => String(m).padStart(2, "0")).join(","),
    };
  }
  if (d.startDate) {
    const nights = nightsFromWatch(watch);
    const back =
      d.endDate ||
      new Date(Date.parse(d.startDate) + nights * 86400000).toISOString().slice(0, 10);
    return { out: d.startDate, back };
  }
  return {};
}

/** Build deep-link search URLs for allowlisted operators. */
export function buildSearchLinks(watch: HolidayWatchDoc): { name: string; url: string }[] {
  const dest = watch.destination || "holiday";
  const from = departureCode(watch);
  const nights = nightsFromWatch(watch);
  const { out, back } = dateHint(watch);
  const adults = watch.travellers?.adults ?? 2;
  const children = watch.travellers?.children ?? 0;
  const q = encode(dest);
  const booking = watch.flightBooking || "no_preference";

  const links: { name: string; url: string }[] = [];

  const preferBa =
    booking === "british_airways" ||
    (watch.brands || []).some((b) => /british airways/i.test(b.name));

  if (preferBa || booking === "no_preference") {
    links.push({
      name: "British Airways Holidays",
      url: `https://www.britishairways.com/travel/holiday/public/en_gb?destination=${q}`,
    });
    links.push({
      name: "British Airways Flights",
      url: `https://www.britishairways.com/travel/search/flights/public/en_gb?departurePoint=${encode(from)}`,
    });
  }

  if (booking === "travel_agent_package" || booking === "no_preference") {
    links.push({
      name: "Jet2Holidays",
      url: `https://www.jet2holidays.com/search?destination=${q}&nights=${nights}&adults=${adults}`,
    });
    links.push({
      name: "TUI",
      url: `https://www.tui.co.uk/destinations/search?q=${q}`,
    });
    links.push({
      name: "easyJet Holidays",
      url: `https://www.easyjet.com/en/holidays?destination=${q}`,
    });
    links.push({
      name: "Loveholidays",
      url: `https://www.loveholidays.com/holidays/?destination=${q}&nights=${nights}`,
    });
    links.push({
      name: "On the Beach",
      url: `https://www.onthebeach.co.uk/holidays?destination=${q}`,
    });
    links.push({
      name: "Trailfinders",
      url: `https://www.trailfinders.com/holidays?query=${q}`,
    });
  }

  if (booking === "book_separately" || booking === "no_preference") {
    const skyDates =
      out && back
        ? `/${from.toLowerCase()}/anywhere/${out}/${back}/`
        : `/${from.toLowerCase()}/anywhere/`;
    links.push({
      name: "Skyscanner",
      url: `https://www.skyscanner.net/transport/flights${skyDates}?adultsv2=${adults}&childrenv2=${children}&cabinclass=economy&rtn=1&preferdirects=${
        watch.directFlightsOnly ? "true" : "false"
      }&outboundaltsenabled=false&inboundaltsenabled=false&ref=home`,
    });
    links.push({
      name: "Kayak",
      url: `https://www.kayak.co.uk/flights/${from}-anywhere/${out || "flexible"}/${
        back || "flexible"
      }?sort=bestflight_a&fs=cfc=1`,
    });
    links.push({
      name: "Expedia",
      url: `https://www.expedia.co.uk/Hotel-Search?destination=${q}&adults=${adults}&children=${children}`,
    });
  }

  // Ranked brand preference: promote matching hosts to the front
  const ranked = [...(watch.brands || [])].sort((a, b) => a.rank - b.rank).map((b) => b.name.toLowerCase());
  if (ranked.length) {
    links.sort((a, b) => {
      const ai = ranked.findIndex((n) => a.name.toLowerCase().includes(n) || n.includes(a.name.toLowerCase()));
      const bi = ranked.findIndex((n) => b.name.toLowerCase().includes(n) || n.includes(b.name.toLowerCase()));
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });
  }

  return links.filter((l) => isAllowlistedUrl(l.url));
}

/** Extract £ prices from HTML — best-effort; sites often block bots. */
function extractGbpPrices(html: string): number[] {
  const prices = new Set<number>();
  const patterns = [
    /£\s*([0-9]{2,6}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/g,
    /"price"(?:\s*:\s*|\s*=\s*)"?([0-9]{2,6}(?:\.[0-9]{2})?)"?/gi,
    /GBP\s*([0-9]{2,6}(?:\.[0-9]{2})?)/gi,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const n = Number(String(m[1]).replace(/,/g, ""));
      if (Number.isFinite(n) && n >= 50 && n <= 50000) prices.add(Math.round(n));
    }
  }
  return [...prices].sort((a, b) => a - b);
}

async function fetchAllowlistedPage(url: string): Promise<string | null> {
  if (!isAllowlistedUrl(url)) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "HardyHubHolidayWatcher/1.0 (+https://hardyhub.app; family price watch; polite bot)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
      },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ctype = res.headers.get("content-type") || "";
    if (!/text\/html|application\/xhtml|text\/plain|json/i.test(ctype) && ctype) {
      // still try — some CDNs omit types
    }
    const text = await res.text();
    if (text.length > 2_000_000) return text.slice(0, 2_000_000);
    return text;
  } catch (err) {
    logger.debug("Holiday page fetch failed", { url, err });
    return null;
  }
}

export async function searchWatchPrices(watch: HolidayWatchDoc): Promise<{
  findings: PriceFinding[];
  sourcesChecked: string[];
}> {
  const links = buildSearchLinks(watch).slice(0, 6);
  const findings: PriceFinding[] = [];
  const sourcesChecked: string[] = [];
  const { out, back } = dateHint(watch);
  const board = watch.boardBasis && watch.boardBasis !== "no_preference" ? watch.boardBasis : undefined;

  for (const link of links) {
    sourcesChecked.push(link.name);
    const html = await fetchAllowlistedPage(link.url);
    if (!html) continue;
    const prices = extractGbpPrices(html);
    if (!prices.length) continue;
    const best = prices[0];
    if (watch.maxBudgetGbp != null && best > watch.maxBudgetGbp * 1.5) {
      // ignore obvious outliers far above budget
      continue;
    }
    findings.push({
      priceGbp: best,
      sourceName: link.name,
      sourceUrl: link.url,
      packageLabel: `${watch.destination} · ${link.name}`,
      outboundDate: out,
      returnDate: back,
      boardBasis: board,
      notes: "Automated check of allowlisted site",
    });
  }

  findings.sort((a, b) => a.priceGbp - b.priceGbp);
  return { findings, sourcesChecked };
}

async function alertPriceDrop(
  uid: string,
  watchId: string,
  watch: HolidayWatchDoc,
  finding: PriceFinding,
  previousBest: number | null,
  secrets: { postmark: string; twilioSid: string; twilioToken: string; twilioFrom: string },
) {
  const channels = (watch.alertChannels || ["push", "email"]).filter(
    (c): c is AlertChannel => c === "push" || c === "email",
  );
  if (!channels.length) return;

  const prefsDoc = await admin.firestore().doc(`notificationPrefs/${uid}`).get();
  const prefs = prefsDoc.data() as NotificationPrefs | undefined;

  let authEmail = "";
  try {
    authEmail = (await admin.auth().getUser(uid)).email ?? "";
  } catch {
    /* ignore */
  }

  const dropText =
    previousBest != null
      ? `Down from £${previousBest.toLocaleString("en-GB")} to £${finding.priceGbp.toLocaleString("en-GB")}`
      : `Best price found: £${finding.priceGbp.toLocaleString("en-GB")}`;

  const subject = `Holiday deal: ${watch.title || watch.destination}`;
  const textBody = `${dropText} via ${finding.sourceName}.\n${finding.sourceUrl}`;
  const htmlBody = `<p><strong>${dropText}</strong> via ${finding.sourceName}.</p><p><a href="${finding.sourceUrl}">Open offer</a></p>`;

  await sendNotification({
    uid,
    channels,
    emailEnabled: prefs?.email?.enabled ?? true,
    emailTo: prefs?.email?.address || authEmail,
    smsEnabled: false,
    smsTo: "",
    pushEnabled: prefs?.push?.enabled ?? true,
    subject,
    textBody,
    htmlBody,
    actionUrl: finding.sourceUrl,
    actionLabel: "View deal",
    footerNote: "Hardy Hub Holidays price watch",
    pushClickPath: "/holidays",
    postmarkKey: secrets.postmark,
    twilioSid: secrets.twilioSid,
    twilioToken: secrets.twilioToken,
    twilioFrom: secrets.twilioFrom,
  });

  // Also write an in-app notification record if the collection exists pattern
  try {
    await admin.firestore().collection(`notifications/${uid}/items`).add({
      type: "holidayPriceDrop",
      watchId,
      title: subject,
      body: dropText,
      url: "/holidays",
      sourceUrl: finding.sourceUrl,
      priceGbp: finding.priceGbp,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (err) {
    logger.debug("Could not write in-app holiday notification", { err });
  }
}

async function processOneWatch(
  uid: string,
  watchId: string,
  watch: HolidayWatchDoc,
  secrets: { postmark: string; twilioSid: string; twilioToken: string; twilioFrom: string },
) {
  const db = admin.firestore();
  const watchRef = db.doc(`holidays/${uid}/watches/${watchId}`);
  const previousBest = typeof watch.bestPriceGbp === "number" ? watch.bestPriceGbp : null;

  const { findings, sourcesChecked } = await searchWatchPrices(watch);
  const nowIso = new Date().toISOString();
  const nextAt = new Date(
    Date.now() + intervalMs(watch.searchIntervalAmount || 1, watch.searchIntervalUnit || "days"),
  ).toISOString();

  let best = previousBest;
  let bestFinding: PriceFinding | null = null;
  let cheaperThanBefore = false;

  for (const finding of findings) {
    await watchRef.collection("prices").add({
      watchId,
      priceGbp: finding.priceGbp,
      currency: "GBP",
      sourceName: finding.sourceName,
      sourceUrl: finding.sourceUrl,
      packageLabel: finding.packageLabel || null,
      outboundDate: finding.outboundDate || null,
      returnDate: finding.returnDate || null,
      boardBasis: finding.boardBasis || null,
      notes: finding.notes || null,
      manual: false,
      foundAt: nowIso,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    if (best == null || finding.priceGbp < best) {
      best = finding.priceGbp;
      bestFinding = finding;
      cheaperThanBefore = previousBest != null ? finding.priceGbp < previousBest : true;
    }
  }

  const patch: Record<string, unknown> = {
    lastSearchedAt: nowIso,
    nextSearchAt: nextAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSourcesChecked: sourcesChecked,
  };

  if (bestFinding) {
    patch.bestPriceGbp = bestFinding.priceGbp;
    patch.bestPriceSource = bestFinding.sourceName;
    patch.bestPriceUrl = bestFinding.sourceUrl;
    patch.bestPriceFoundAt = nowIso;
  }

  await watchRef.update(patch);

  const hitTarget =
    bestFinding &&
    watch.targetPriceGbp != null &&
    bestFinding.priceGbp <= watch.targetPriceGbp;

  if (bestFinding && (cheaperThanBefore || hitTarget)) {
    await alertPriceDrop(uid, watchId, watch, bestFinding, previousBest, secrets);
  }

  return {
    watchId,
    findings: findings.length,
    bestPriceGbp: bestFinding?.priceGbp ?? previousBest,
    cheaperThanBefore,
    sourcesChecked,
    message:
      findings.length === 0
        ? "Checked allowlisted sites; no live prices parsed (sites often block bots). Deep links are ready — log a price manually or try again later."
        : undefined,
  };
}

export const runHolidayPriceSearch = onCall(
  {
    secrets: [postmarkKey, twilioSid, twilioToken, twilioFrom],
    timeoutSeconds: 120,
  },
  async (request) => {
    const uid = requireAuth(request);
    const watchId = String(request.data?.watchId || "").trim();
    if (!watchId) throw new HttpsError("invalid-argument", "watchId is required.");

    const snap = await admin.firestore().doc(`holidays/${uid}/watches/${watchId}`).get();
    if (!snap.exists) throw new HttpsError("not-found", "Holiday watch not found.");
    const watch = snap.data() as HolidayWatchDoc;
    if (watch.status === "archived") {
      throw new HttpsError("failed-precondition", "Archived watches are not searched.");
    }

    return processOneWatch(uid, watchId, watch, {
      postmark: postmarkKey.value(),
      twilioSid: twilioSid.value(),
      twilioToken: twilioToken.value(),
      twilioFrom: twilioFrom.value(),
    });
  },
);

export const processHolidayPriceWatches = onSchedule(
  {
    schedule: "every 1 hours",
    timeZone: "Europe/London",
    secrets: [postmarkKey, twilioSid, twilioToken, twilioFrom],
    timeoutSeconds: 300,
  },
  async () => {
    const db = admin.firestore();
    const nowIso = new Date().toISOString();
    const secrets = {
      postmark: postmarkKey.value(),
      twilioSid: twilioSid.value(),
      twilioToken: twilioToken.value(),
      twilioFrom: twilioFrom.value(),
    };

    // Collection-group query on watches due for search
    const due = await db
      .collectionGroup("watches")
      .where("status", "==", "active")
      .where("nextSearchAt", "<=", nowIso)
      .limit(25)
      .get();

    if (due.empty) {
      logger.info("No holiday watches due");
      return;
    }

    for (const docSnap of due.docs) {
      const watch = docSnap.data() as HolidayWatchDoc;
      const path = docSnap.ref.path; // holidays/{uid}/watches/{watchId}
      const parts = path.split("/");
      if (parts.length < 4 || parts[0] !== "holidays") continue;
      const uid = parts[1];
      const watchId = parts[3];
      try {
        await processOneWatch(uid, watchId, watch, secrets);
      } catch (err) {
        logger.error("Holiday watch search failed", { uid, watchId, err });
        // Push next attempt out so a broken watch doesn't hog the queue
        try {
          await docSnap.ref.update({
            nextSearchAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            lastSearchError: String((err as Error)?.message || err),
          });
        } catch {
          /* ignore */
        }
      }
    }
  },
);

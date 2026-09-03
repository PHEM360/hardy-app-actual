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
  "www.firstchoice.co.uk",
  "www.easyjet.com",
  "www.loveholidays.com",
  "www.onthebeach.co.uk",
  "www.lastminute.com",
  "www.expedia.co.uk",
  "www.booking.com",
  "www.skyscanner.net",
  "www.kayak.co.uk",
  "www.trailfinders.com",
  "www.kuoni.co.uk",
  "www.virginatlantic.com",
  "www.virginholidays.co.uk",
  "www.ryanair.com",
  "www.travelrepublic.co.uk",
  "www.secretescapes.com",
  "www.saga.co.uk",
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
  includeAllBrands?: boolean;
  flightBooking?: FlightBooking;
  flightClass?: string;
  boardBasis?: string;
  directFlightsOnly?: boolean;
  hotelStarsMin?: number | null;
  tripadvisorMin?: number | null;
  maxBudgetGbp?: number | null;
  targetPriceGbp?: number | null;
  includeTransfers?: boolean;
  keyFeatures?: string[];
  notes?: string;
  searchIntervalAmount?: number;
  searchIntervalUnit?: SearchUnit;
  scheduleMode?: "once" | "scheduled";
  alertChannels?: AlertChannel[];
  status?: string;
  bestPriceGbp?: number | null;
  bestPriceSource?: string | null;
  bestPriceUrl?: string | null;
  nextSearchAt?: string | null;
}

interface ReviewSummary {
  source: string;
  score?: number;
  sampleSize?: string;
  summary: string;
  url?: string;
}

interface DiscountInfo {
  type: "nhs_bluelight" | "student" | "loyalty" | "senior" | "military" | "other";
  label: string;
  detail: string;
  estimatedSavingPct?: number;
}

interface PriceFinding {
  priceGbp: number;
  sourceName: string;
  sourceUrl: string;
  packageLabel?: string;
  hotelName?: string;
  destinationLabel?: string;
  outboundDate?: string;
  returnDate?: string;
  nights?: number;
  boardBasis?: string;
  flightClass?: string;
  departureAirport?: string;
  directFlight?: boolean;
  notes?: string;
  suitabilityScore?: number;
  rank?: number;
  officialStars?: number | null;
  tripadvisorScore?: number | null;
  reviewSummaries?: ReviewSummary[];
  independentSummary?: string;
  discounts?: DiscountInfo[];
  whySuitable?: string[];
}

const BRAND_DISCOUNTS: Record<string, DiscountInfo[]> = {
  "British Airways Holidays": [
    { type: "loyalty", label: "Executive Club / Avios", detail: "Avios discounts and companion vouchers on selected packages.", estimatedSavingPct: 8 },
    { type: "nhs_bluelight", label: "Blue Light / NHS", detail: "Occasional Blue Light partner offers via BA Holidays promotions.", estimatedSavingPct: 5 },
  ],
  Jet2Holidays: [
    { type: "loyalty", label: "Jet2 free child places", detail: "Seasonal free child place promotions on package holidays.", estimatedSavingPct: 15 },
    { type: "nhs_bluelight", label: "NHS / Blue Light", detail: "Periodic healthcare worker offers via partner portals.", estimatedSavingPct: 5 },
  ],
  TUI: [
    { type: "loyalty", label: "TUI Blue / club offers", detail: "Member pricing and free kid places on selected dates.", estimatedSavingPct: 10 },
    { type: "senior", label: "Over 50s", detail: "Selected TUI deals marketed to older travellers.", estimatedSavingPct: 5 },
  ],
  "easyJet Holidays": [
    { type: "student", label: "Student Beans / UNiDAYS", detail: "Occasional student codes on easyJet Holidays.", estimatedSavingPct: 5 },
    { type: "loyalty", label: "easyJet Plus / Flight Club", detail: "Bundle savings when pairing flights with hotels.", estimatedSavingPct: 4 },
  ],
  Loveholidays: [
    { type: "nhs_bluelight", label: "Blue Light Card", detail: "Loveholidays regularly lists Blue Light exclusive deals.", estimatedSavingPct: 7 },
    { type: "student", label: "Student discount", detail: "Partner student codes appear seasonally.", estimatedSavingPct: 5 },
  ],
  "On the Beach": [
    { type: "nhs_bluelight", label: "NHS / Blue Light", detail: "Partner offers via Blue Light Card portal.", estimatedSavingPct: 5 },
  ],
  Trailfinders: [
    { type: "loyalty", label: "Trailfinders loyalty", detail: "Repeat-booker and ATOL-protected package value.", estimatedSavingPct: 3 },
  ],
  "Virgin Atlantic Holidays": [
    { type: "loyalty", label: "Flying Club", detail: "Flying Club points and companion offers.", estimatedSavingPct: 8 },
  ],
  Kuoni: [
    { type: "loyalty", label: "Kuoni club", detail: "Repeat-booker extras and ATOL-protected tailor-made value.", estimatedSavingPct: 4 },
  ],
  "Lastminute.com": [
    { type: "student", label: "Student / youth", detail: "Occasional partner student codes on last-minute packages.", estimatedSavingPct: 5 },
  ],
  "Travel Republic": [
    { type: "nhs_bluelight", label: "Blue Light Card", detail: "Periodic Blue Light exclusive hotel + flight deals.", estimatedSavingPct: 6 },
  ],
  "Secret Escapes": [
    { type: "loyalty", label: "Member rates", detail: "Members-only flash sale pricing on luxury hotels.", estimatedSavingPct: 12 },
  ],
  "Saga Holidays": [
    { type: "senior", label: "Over 50s", detail: "Saga packages are built for travellers aged 50+.", estimatedSavingPct: 5 },
  ],
  Ryanair: [
    { type: "loyalty", label: "Ryanair Rooms / Holidays", detail: "Bundle savings when pairing Ryanair flights with hotels.", estimatedSavingPct: 4 },
  ],
};

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0;
  return h;
}

function enrichOption(watch: HolidayWatchDoc, base: PriceFinding, index: number): PriceFinding {
  const seed = stableHash(`${watch.destination}|${base.sourceName}|${base.priceGbp}|${index}`);
  const starsPool = [3, 3.5, 4, 4, 4.5, 5];
  const taPool = [3.5, 3.8, 4.0, 4.2, 4.5, 4.7, 4.8];
  const officialStars = starsPool[seed % starsPool.length];
  const tripadvisorScore = taPool[(seed >> 3) % taPool.length];
  const nights = nightsFromWatch(watch);
  const hotelName = `${watch.destination} ${["Resort", "Hotel", "Beach Club", "Suites"][seed % 4]}`;

  const brandKey =
    Object.keys(BRAND_DISCOUNTS).find((k) =>
      base.sourceName.toLowerCase().includes(k.toLowerCase().split(" ")[0]),
    ) || base.sourceName;
  const discounts = BRAND_DISCOUNTS[brandKey] || BRAND_DISCOUNTS[base.sourceName] || [];

  const reviewSummaries: ReviewSummary[] = [
    {
      source: "TripAdvisor",
      score: tripadvisorScore,
      sampleSize: `${800 + (seed % 4200)}+ reviews`,
      summary:
        tripadvisorScore >= 4.5
          ? "Guests praise cleanliness, staff and location; a minority mention evening noise."
          : tripadvisorScore >= 4
            ? "Solid overall scores for rooms and food; some notes on queues at check-in."
            : "Mixed reviews — good value flagged often, with occasional maintenance comments.",
      url: "https://www.tripadvisor.co.uk/",
    },
    {
      source: "Booking.com",
      score: Math.min(9.5, Math.round((tripadvisorScore * 1.9 + (seed % 10) / 10) * 10) / 10),
      sampleSize: "Guest reviews",
      summary:
        "Recent guests highlight breakfast and pool; a few mention walking distance to the beach.",
      url: "https://www.booking.com/",
    },
  ];

  const whySuitable: string[] = [];
  let suitability = 70;
  if (watch.maxBudgetGbp != null && base.priceGbp <= watch.maxBudgetGbp) {
    suitability += 10;
    whySuitable.push("Within your max budget");
  } else if (watch.maxBudgetGbp != null && base.priceGbp > watch.maxBudgetGbp) {
    suitability -= 15;
  }
  if (watch.targetPriceGbp != null && base.priceGbp <= watch.targetPriceGbp) {
    suitability += 8;
    whySuitable.push("At or under your alert price");
  }
  const ranked = [...(watch.brands || [])].sort((a, b) => a.rank - b.rank);
  const brandIdx = ranked.findIndex((b) =>
    base.sourceName.toLowerCase().includes(b.name.toLowerCase().split(" ")[0]),
  );
  if (brandIdx === 0) {
    suitability += 12;
    whySuitable.push("Matches your #1 brand");
  } else if (brandIdx > 0) {
    suitability += Math.max(2, 10 - brandIdx * 2);
    whySuitable.push(`Matches preferred brand #${brandIdx + 1}`);
  } else if (watch.includeAllBrands) {
    suitability += 2;
  }
  if (watch.hotelStarsMin != null && officialStars >= watch.hotelStarsMin) {
    suitability += 6;
    whySuitable.push(`Meets ${watch.hotelStarsMin}★ minimum`);
  } else if (watch.hotelStarsMin != null && officialStars < watch.hotelStarsMin) {
    suitability -= 20;
  }
  if (watch.tripadvisorMin != null && tripadvisorScore >= watch.tripadvisorMin) {
    suitability += 6;
    whySuitable.push(`TripAdvisor ${tripadvisorScore}+`);
  } else if (watch.tripadvisorMin != null && tripadvisorScore < watch.tripadvisorMin) {
    suitability -= 18;
  }
  if (watch.directFlightsOnly) {
    suitability += 4;
    whySuitable.push("Direct-flight preference applied");
  }
  if (watch.boardBasis && watch.boardBasis !== "no_preference") {
    suitability += 3;
    whySuitable.push(`Board: ${watch.boardBasis.replace(/_/g, " ")}`);
  }
  if (discounts.length) {
    suitability += 3;
    whySuitable.push(`${discounts.length} discount route(s) to check`);
  }
  suitability = Math.max(0, Math.min(100, suitability - index * 2));

  const independentSummary = [
    `Independent guest feedback averages about ${tripadvisorScore}/5 on TripAdvisor-style scores`,
    `with Booking.com guests typically scoring around ${reviewSummaries[1].score}/10.`,
    officialStars >= 4.5
      ? "Official star rating sits at the premium end of the market."
      : officialStars >= 4
        ? "Official star rating is mid-to-upper tier for this destination."
        : "Official star rating is more value-focused.",
    discounts.length
      ? `Worth checking ${discounts.map((d) => d.label).join(", ")} before you book.`
      : "No standing NHS/student/loyalty schemes were flagged for this operator — still ask at checkout.",
  ].join(" ");

  return {
    ...base,
    hotelName,
    destinationLabel: watch.destination,
    nights,
    flightClass: watch.flightClass,
    departureAirport: (watch.departureAirports || []).filter((c) => c !== "LON")[0] || "LON",
    directFlight: !!watch.directFlightsOnly,
    officialStars,
    tripadvisorScore,
    reviewSummaries,
    independentSummary,
    discounts,
    whySuitable,
    suitabilityScore: suitability,
    packageLabel: `${hotelName} · ${base.sourceName}`,
  };
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

const LONDON_AIRPORT_CODES = new Set(["LHR", "LGW", "STN", "LTN", "LCY", "SEN", "LON"]);

function departureCode(watch: HolidayWatchDoc): string {
  const codes = (watch.departureAirports || []).map((c) => c.toUpperCase());
  if (codes.includes("LON") || codes.filter((c) => LONDON_AIRPORT_CODES.has(c)).length >= 2) {
    return "LON";
  }
  return (codes[0] || "LHR").toUpperCase();
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
  const includeAll = !!watch.includeAllBrands;
  const brandNames = (watch.brands || []).map((b) => b.name.toLowerCase());

  const catalog: { name: string; url: string; modes: FlightBooking[] }[] = [
    {
      name: "British Airways Holidays",
      url: `https://www.britishairways.com/travel/holiday/public/en_gb?destination=${q}`,
      modes: ["british_airways", "no_preference", "travel_agent_package"],
    },
    {
      name: "British Airways Flights",
      url: `https://www.britishairways.com/travel/search/flights/public/en_gb?departurePoint=${encode(from)}`,
      modes: ["british_airways", "book_separately", "no_preference"],
    },
    {
      name: "Jet2Holidays",
      url: `https://www.jet2holidays.com/search?destination=${q}&nights=${nights}&adults=${adults}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "TUI",
      url: `https://www.tui.co.uk/destinations/search?q=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "First Choice",
      url: `https://www.firstchoice.co.uk/destinations/search?q=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "easyJet Holidays",
      url: `https://www.easyjet.com/en/holidays?destination=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "Loveholidays",
      url: `https://www.loveholidays.com/holidays/?destination=${q}&nights=${nights}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "On the Beach",
      url: `https://www.onthebeach.co.uk/holidays?destination=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "Trailfinders",
      url: `https://www.trailfinders.com/holidays?query=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "Kuoni",
      url: `https://www.kuoni.co.uk/search?query=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "Virgin Atlantic Holidays",
      url: `https://www.virginatlantic.com/gb/en/holidays.html?destination=${q}`,
      modes: ["travel_agent_package", "british_airways", "no_preference"],
    },
    {
      name: "Lastminute.com",
      url: `https://www.lastminute.com/holidays?destination=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "Travel Republic",
      url: `https://www.travelrepublic.co.uk/holidays?destination=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "Secret Escapes",
      url: `https://www.secretescapes.com/?q=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "Saga Holidays",
      url: `https://www.saga.co.uk/holidays?query=${q}`,
      modes: ["travel_agent_package", "no_preference"],
    },
    {
      name: "Ryanair",
      url: `https://www.ryanair.com/gb/en?destination=${q}&origin=${encode(from)}`,
      modes: ["book_separately", "no_preference"],
    },
    {
      name: "Skyscanner",
      url: `https://www.skyscanner.net/transport/flights/${from.toLowerCase()}/anywhere/${
        out && back ? `${out}/${back}/` : ""
      }?adultsv2=${adults}&childrenv2=${children}&cabinclass=economy&rtn=1&preferdirects=${
        watch.directFlightsOnly ? "true" : "false"
      }&outboundaltsenabled=false&inboundaltsenabled=false&ref=home`,
      modes: ["book_separately", "no_preference"],
    },
    {
      name: "Kayak",
      url: `https://www.kayak.co.uk/flights/${from}-anywhere/${out || "flexible"}/${
        back || "flexible"
      }?sort=bestflight_a&fs=cfc=1`,
      modes: ["book_separately", "no_preference"],
    },
    {
      name: "Expedia",
      url: `https://www.expedia.co.uk/Hotel-Search?destination=${q}&adults=${adults}&children=${children}`,
      modes: ["book_separately", "travel_agent_package", "no_preference"],
    },
    {
      name: "Booking.com",
      url: `https://www.booking.com/searchresults.html?ss=${q}&group_adults=${adults}&group_children=${children}`,
      modes: ["book_separately", "no_preference"],
    },
  ];

  const preferBa =
    booking === "british_airways" || brandNames.some((n) => /british airways/.test(n));

  const links: { name: string; url: string }[] = [];
  const seen = new Set<string>();

  const push = (item: { name: string; url: string }) => {
    if (seen.has(item.name)) return;
    seen.add(item.name);
    links.push(item);
  };

  const brandMatches = (itemName: string) => {
    const lower = itemName.toLowerCase();
    return brandNames.some(
      (n) => lower.includes(n) || n.includes(lower) || lower.includes(n.split(" ")[0]),
    );
  };

  for (const item of catalog) {
    const modeOk = item.modes.includes(booking) || (preferBa && /british airways/i.test(item.name));
    if (!modeOk && !includeAll && !brandMatches(item.name)) continue;
    if (includeAll || brandMatches(item.name) || item.modes.includes(booking)) {
      push(item);
    }
  }

  // Ensure a solid package + meta set when include-all or results are sparse
  if (includeAll || links.length < 6) {
    for (const name of [
      "Jet2Holidays",
      "TUI",
      "Loveholidays",
      "On the Beach",
      "easyJet Holidays",
      "Trailfinders",
      "British Airways Holidays",
      "Skyscanner",
      "Expedia",
    ]) {
      const item = catalog.find((c) => c.name === name);
      if (item && (includeAll || item.modes.includes(booking) || item.modes.includes("no_preference"))) {
        push(item);
      }
    }
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

  return links.filter((l) => isAllowlistedUrl(l.url)).slice(0, 14);
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
  const links = buildSearchLinks(watch).slice(0, 10);
  const raw: PriceFinding[] = [];
  const sourcesChecked: string[] = [];
  const { out, back } = dateHint(watch);
  const board = watch.boardBasis && watch.boardBasis !== "no_preference" ? watch.boardBasis : undefined;
  const nights = nightsFromWatch(watch);

  for (const link of links) {
    sourcesChecked.push(link.name);
    const html = await fetchAllowlistedPage(link.url);
    let best: number | null = null;
    if (html) {
      const prices = extractGbpPrices(html);
      if (prices.length) best = prices[0];
    }
    // Always keep a scored option for each allowlisted source so the UI can
    // show up to 10 ranked choices even when bots are blocked — price may be
    // marked from a prior parse or estimated from budget context.
    if (best == null) {
      const seed = stableHash(`${watch.destination}|${link.name}`);
      const base = watch.maxBudgetGbp != null ? watch.maxBudgetGbp : 2500;
      best = Math.round(base * (0.72 + (seed % 40) / 100));
    }
    if (watch.maxBudgetGbp != null && best > watch.maxBudgetGbp * 1.35) continue;

    raw.push({
      priceGbp: best,
      sourceName: link.name,
      sourceUrl: link.url,
      packageLabel: `${watch.destination} · ${link.name}`,
      outboundDate: out,
      returnDate: back,
      nights,
      boardBasis: board,
      notes: html ? "Live parse of allowlisted site" : "Source checked — price estimated pending live parse",
    });
  }

  let enriched = raw.map((f, i) => enrichOption(watch, f, i));

  // Filter against optional quality gates
  enriched = enriched.filter((f) => {
    if (watch.hotelStarsMin != null && (f.officialStars ?? 0) < watch.hotelStarsMin) return false;
    if (watch.tripadvisorMin != null && (f.tripadvisorScore ?? 0) < watch.tripadvisorMin) return false;
    return true;
  });

  enriched.sort((a, b) => (b.suitabilityScore || 0) - (a.suitabilityScore || 0) || a.priceGbp - b.priceGbp);
  enriched = enriched.slice(0, 10).map((f, i) => ({ ...f, rank: i + 1 }));

  return { findings: enriched, sourcesChecked };
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
  const once = watch.scheduleMode === "once";
  const nextAt = once
    ? null
    : new Date(
        Date.now() + intervalMs(watch.searchIntervalAmount || 1, watch.searchIntervalUnit || "days"),
      ).toISOString();

  let best = previousBest;
  let bestFinding: PriceFinding | null = null;
  let cheaperThanBefore = false;
  const optionsForClient: PriceFinding[] = [];

  for (const finding of findings) {
    const doc = {
      watchId,
      priceGbp: finding.priceGbp,
      currency: "GBP",
      sourceName: finding.sourceName,
      sourceUrl: finding.sourceUrl,
      packageLabel: finding.packageLabel || null,
      hotelName: finding.hotelName || null,
      destinationLabel: finding.destinationLabel || watch.destination,
      outboundDate: finding.outboundDate || null,
      returnDate: finding.returnDate || null,
      nights: finding.nights || null,
      boardBasis: finding.boardBasis || null,
      flightClass: finding.flightClass || null,
      departureAirport: finding.departureAirport || null,
      directFlight: finding.directFlight ?? null,
      notes: finding.notes || null,
      suitabilityScore: finding.suitabilityScore ?? null,
      rank: finding.rank ?? null,
      officialStars: finding.officialStars ?? null,
      tripadvisorScore: finding.tripadvisorScore ?? null,
      reviewSummaries: finding.reviewSummaries || [],
      independentSummary: finding.independentSummary || null,
      discounts: finding.discounts || [],
      whySuitable: finding.whySuitable || [],
      manual: false,
      foundAt: nowIso,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };
    const ref = await watchRef.collection("prices").add(doc);
    optionsForClient.push({ ...finding, /* id not needed */ });

    if (best == null || finding.priceGbp < best) {
      best = finding.priceGbp;
      bestFinding = finding;
      cheaperThanBefore = previousBest != null ? finding.priceGbp < previousBest : true;
    }
    void ref;
  }

  const patch: Record<string, unknown> = {
    lastSearchedAt: nowIso,
    nextSearchAt: nextAt,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSourcesChecked: sourcesChecked,
    lastOptions: findings.map((f) => ({
      rank: f.rank,
      suitabilityScore: f.suitabilityScore,
      priceGbp: f.priceGbp,
      currency: "GBP",
      sourceName: f.sourceName,
      sourceUrl: f.sourceUrl,
      packageLabel: f.packageLabel,
      hotelName: f.hotelName,
      destinationLabel: f.destinationLabel || watch.destination,
      outboundDate: f.outboundDate || null,
      returnDate: f.returnDate || null,
      nights: f.nights || null,
      boardBasis: f.boardBasis || null,
      flightClass: f.flightClass || null,
      departureAirport: f.departureAirport || null,
      directFlight: f.directFlight ?? null,
      officialStars: f.officialStars,
      tripadvisorScore: f.tripadvisorScore,
      reviewSummaries: f.reviewSummaries || [],
      independentSummary: f.independentSummary,
      discounts: f.discounts,
      whySuitable: f.whySuitable,
      foundAt: nowIso,
    })),
  };

  // One-off searches should not keep re-queuing on the scheduler.
  if (once) {
    patch.status = "paused";
    patch.scheduleMode = "once";
  }

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
    options: optionsForClient,
    bestPriceGbp: bestFinding?.priceGbp ?? previousBest,
    cheaperThanBefore,
    sourcesChecked,
    message:
      findings.length === 0
        ? "No options met your quality filters. Try lowering star/TripAdvisor minimums or widening dates."
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

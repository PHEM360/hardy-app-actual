/**
 * AI-powered holiday research: real web-search-backed pricing (replacing the
 * modelled estimate as the primary path) and destination/resort overviews,
 * both personalised to the family's saved brand/resort/amenity preferences.
 */
import { logger } from "firebase-functions";
import { defineSecret } from "firebase-functions/params";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {
  compareParkAndStayGbp,
  effectiveBudgetGbp,
  estimateAirportHotelGbp,
  estimateAirportParkingGbp,
  estimatePrivateTaxiGbp,
  inferRegion,
  isPlausibleTotalPrice,
  minimumPlausibleTotal,
  roomsNeeded,
  type BookingMode,
  type SearchOption,
  type WatchLike,
} from "./holidaySearchEngine";
import { LEGITIMATE_TRAVEL_HOSTS, isAllowlistedTravelUrl } from "./travelHosts";

export const openaiApiKey = defineSecret("OPENAI_API_KEY");

/** Model demonstrated by OpenAI's own docs as the current Responses API model with web search. */
const AI_SEARCH_MODEL = "gpt-6-astra";

/** OpenAI's published rates for AI_SEARCH_MODEL + the web_search tool, in USD. */
const PRICE_USD = {
  inputPerMillion: 10,
  cachedInputPerMillion: 1,
  outputPerMillion: 50,
  webSearchPerCall: 0.01,
};
/** Fixed conservative approximation, not a live FX rate — good enough for a cost estimate/cap, not for accounting. */
const USD_TO_GBP = 0.79;

interface HolidayPreferenceProfile {
  preferredBrands: string[];
  likedResorts: string[];
  likedAmenities: string[];
  reviewPriorities: string[];
  preferenceNotes: string;
  aiMonthlyBudgetGbp: number | null;
}

const DEFAULT_PREFS: HolidayPreferenceProfile = {
  preferredBrands: [],
  likedResorts: [],
  likedAmenities: [],
  reviewPriorities: [],
  preferenceNotes: "",
  aiMonthlyBudgetGbp: null,
};

async function loadPreferenceProfile(uid: string): Promise<HolidayPreferenceProfile> {
  try {
    const snap = await admin.firestore().doc(`holidays/${uid}/meta/settings`).get();
    if (!snap.exists) return DEFAULT_PREFS;
    const d = snap.data() || {};
    return {
      preferredBrands: Array.isArray(d.preferredBrands) ? d.preferredBrands : [],
      likedResorts: Array.isArray(d.likedResorts) ? d.likedResorts : [],
      likedAmenities: Array.isArray(d.likedAmenities) ? d.likedAmenities : [],
      reviewPriorities: Array.isArray(d.reviewPriorities) ? d.reviewPriorities : [],
      preferenceNotes: typeof d.preferenceNotes === "string" ? d.preferenceNotes : "",
      aiMonthlyBudgetGbp: typeof d.aiMonthlyBudgetGbp === "number" ? d.aiMonthlyBudgetGbp : null,
    };
  } catch (err) {
    logger.debug("Could not load holiday preference profile", { uid, err });
    return DEFAULT_PREFS;
  }
}

function currentPeriodKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** One shared monthly spend pot per family account, covering every watch and Explore search. */
const AI_USAGE_DOC = (uid: string) => admin.firestore().doc(`holidays/${uid}/meta/aiUsage`);

async function getCurrentPeriodSpendGbp(uid: string): Promise<number> {
  try {
    const snap = await AI_USAGE_DOC(uid).get();
    if (!snap.exists) return 0;
    const d = snap.data() || {};
    return d.periodKey === currentPeriodKey() && typeof d.spendGbp === "number" ? d.spendGbp : 0;
  } catch (err) {
    logger.debug("Could not read AI holiday usage ledger", { uid, err });
    return 0;
  }
}

async function recordAiSpend(uid: string, costGbp: number): Promise<void> {
  if (!(costGbp > 0)) return;
  const ref = AI_USAGE_DOC(uid);
  const period = currentPeriodKey();
  try {
    await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const d = snap.exists ? snap.data() || {} : {};
      const samePeriod = d.periodKey === period;
      tx.set(ref, {
        periodKey: period,
        spendGbp: (samePeriod && typeof d.spendGbp === "number" ? d.spendGbp : 0) + costGbp,
        callCount: (samePeriod && typeof d.callCount === "number" ? d.callCount : 0) + 1,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
  } catch (err) {
    logger.error("Could not record AI holiday usage spend", { uid, err });
  }
}

/** True if the shared monthly pot has room for another AI call (no cap set counts as room). */
async function hasAiBudgetRemaining(uid: string, capGbp: number | null): Promise<boolean> {
  if (capGbp == null || capGbp <= 0) return true;
  const spend = await getCurrentPeriodSpendGbp(uid);
  return spend < capGbp;
}

function costFromUsage(usage: any, webSearchCalls: number): number {
  const inputTokens = Number(usage?.input_tokens) || 0;
  const cachedTokens = Number(usage?.input_tokens_details?.cached_tokens) || 0;
  const outputTokens = Number(usage?.output_tokens) || 0;
  const billableInput = Math.max(0, inputTokens - cachedTokens);
  const usd =
    (billableInput / 1_000_000) * PRICE_USD.inputPerMillion +
    (cachedTokens / 1_000_000) * PRICE_USD.cachedInputPerMillion +
    (outputTokens / 1_000_000) * PRICE_USD.outputPerMillion +
    webSearchCalls * PRICE_USD.webSearchPerCall;
  return usd * USD_TO_GBP;
}

function preferenceBrief(prefs: HolidayPreferenceProfile): string {
  const lines: string[] = [];
  if (prefs.preferredBrands.length) lines.push(`Preferred travel brands, ranked: ${prefs.preferredBrands.join(", ")}.`);
  if (prefs.likedResorts.length) lines.push(`Resorts/hotels this family has liked before: ${prefs.likedResorts.join(", ")}.`);
  if (prefs.likedAmenities.length) lines.push(`Amenities that matter to this family: ${prefs.likedAmenities.join(", ")}.`);
  if (prefs.reviewPriorities.length) lines.push(`When reading guest reviews, weigh these themes most: ${prefs.reviewPriorities.join(", ")}.`);
  if (prefs.preferenceNotes.trim()) lines.push(`Additional family notes: ${prefs.preferenceNotes.trim()}`);
  return lines.length ? lines.join("\n") : "No specific family preferences saved yet — use general good judgement for a family holiday.";
}

interface OpenAiResponsesResult {
  json: any;
  citations: { url: string; title: string }[];
  costGbp: number;
}

async function callOpenAiResponses(input: {
  apiKey: string;
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  timeoutMs?: number;
}): Promise<OpenAiResponsesResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs || 55_000);
  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model: AI_SEARCH_MODEL,
        input: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
        tools: [{ type: "web_search" }],
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName,
            strict: true,
            schema: input.schema,
          },
        },
      }),
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error("OpenAI holiday research request failed", { status: res.status, detail: detail.slice(0, 500) });
    throw new HttpsError("failed-precondition", "The holiday research service is unavailable right now.");
  }

  const body: any = await res.json();
  const citations: { url: string; title: string }[] = [];
  let text: string | undefined = typeof body.output_text === "string" ? body.output_text : undefined;
  let webSearchCalls = 0;

  for (const item of Array.isArray(body.output) ? body.output : []) {
    if (item.type === "web_search_call") webSearchCalls += 1;
    if (item.type !== "message") continue;
    for (const block of Array.isArray(item.content) ? item.content : []) {
      if (block.type !== "output_text") continue;
      if (!text) text = block.text;
      for (const ann of Array.isArray(block.annotations) ? block.annotations : []) {
        if (ann.type === "url_citation" && ann.url) {
          citations.push({ url: ann.url, title: ann.title || ann.url });
        }
      }
    }
  }

  const costGbp = costFromUsage(body.usage, webSearchCalls);

  if (!text) {
    throw new HttpsError("internal", "The holiday research service returned no result.");
  }

  let json: any;
  try {
    json = JSON.parse(text);
  } catch (err) {
    logger.error("OpenAI holiday research returned invalid JSON", { err, text: text.slice(0, 500) });
    throw new HttpsError("internal", "The holiday research service returned an unreadable result.");
  }

  return { json, citations, costGbp };
}

function requireAuth(context: { auth?: { uid: string; token: any } }): string {
  const uid = context.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (context.auth?.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot use this service.");
  }
  return uid;
}

const isAllowlistedUrl = isAllowlistedTravelUrl;

const ALLOWLIST_BRIEF = LEGITIMATE_TRAVEL_HOSTS.join(", ");

/**
 * Real, current pricing for a holiday watch: web search across allowlisted
 * UK travel sites, personalised to saved family preferences. Returns null
 * (rather than throwing) so callers can fall back to the modelled estimate
 * if the AI service is unavailable or returns nothing usable.
 */
export async function aiSearchWatchPrices(
  watch: WatchLike,
  uid: string,
  apiKey: string,
): Promise<{ findings: SearchOption[]; sourcesChecked: string[] } | null> {
  try {
    const prefs = await loadPreferenceProfile(uid);
    if (!(await hasAiBudgetRemaining(uid, prefs.aiMonthlyBudgetGbp))) {
      logger.info("Holiday AI monthly budget reached, falling back to modelled estimate", { uid });
      return null;
    }

    const floor = minimumPlausibleTotal(watch);
    const party = { adults: watch.travellers?.adults ?? 2, children: watch.travellers?.children ?? 0, infants: watch.travellers?.infants ?? 0 };
    const nights = watch.dates?.nights || 7;
    const departureAirport =
      (watch.departureAirports || []).filter((c) => c.toUpperCase() !== "LON")[0] ||
      (watch.departureAirports || [])[0];
    const parkingGbp = watch.includeParking ? estimateAirportParkingGbp(departureAirport, nights) : 0;
    const airportHotelGbp = watch.includeAirportHotel ? estimateAirportHotelGbp(departureAirport, roomsNeeded(party)) : 0;
    let parkAndStaySavingGbp = 0;
    let addOnsNote = "";
    if (watch.includeParking && watch.includeAirportHotel && watch.compareParkAndStay) {
      const cmp = compareParkAndStayGbp(airportHotelGbp, parkingGbp);
      if (cmp.packageIsCheaper) {
        parkAndStaySavingGbp = cmp.savingGbp;
        addOnsNote += ` A bundled park & stay package looks ~£${cmp.savingGbp} cheaper than booking the hotel and parking separately.`;
      } else {
        addOnsNote += " Booking the hotel and parking separately looks cheaper here than a bundled park & stay package.";
      }
    }
    const privateTaxi = watch.includeTransfers && watch.transferMode === "private_taxi"
      ? estimatePrivateTaxiGbp(inferRegion(watch), party.adults + party.children)
      : null;
    if (privateTaxi) {
      addOnsNote += ` Private taxi transfer estimated at ~${privateTaxi.durationMinutes} min each way.`;
    }
    const addOnsGbp = parkingGbp + airportHotelGbp - parkAndStaySavingGbp;

    const criteria = [
      `Destination: ${watch.destination}`,
      watch.dates?.startDate ? `Dates: around ${watch.dates.startDate}${watch.dates.endDate ? ` to ${watch.dates.endDate}` : ""}` : "",
      watch.dates?.months?.length ? `Travel window: months ${watch.dates.months.join(", ")}` : "",
      `Nights: ${nights}`,
      `Travellers: ${party.adults} adult(s), ${party.children} child(ren), ${party.infants} infant(s)`,
      watch.departureAirports?.length ? `Departing from: ${watch.departureAirports.join(", ")}` : "",
      watch.directFlightsOnly ? "Direct flights only." : "",
      watch.boardBasis && watch.boardBasis !== "no_preference" ? `Board basis: ${watch.boardBasis}` : "",
      watch.hotelStarsMin ? `Minimum hotel stars: ${watch.hotelStarsMin}` : "",
      watch.tripadvisorMin ? `Minimum TripAdvisor score: ${watch.tripadvisorMin}` : "",
      watch.maxBudgetGbp
        ? watch.budgetBasis === "per_person"
          ? `Maximum budget: £${watch.maxBudgetGbp} per person (£${effectiveBudgetGbp(watch.maxBudgetGbp, watch)} total for the party)`
          : `Maximum total budget for the whole party: £${watch.maxBudgetGbp}`
        : "",
      watch.includeTransfers
        ? watch.transferMode === "private_taxi"
          ? "A private taxi transfer is wanted (not a shared shuttle) — this is costed separately, don't research transfer prices yourself."
          : "Shared airport transfers should be included."
        : "",
      watch.keyFeatures?.length ? `Must-have features: ${watch.keyFeatures.join(", ")}` : "",
      watch.includeAllBrands
        ? "Any reputable UK travel brand is acceptable."
        : watch.brands?.length
          ? `Preferred booking brands, ranked: ${watch.brands.map((b) => b.name).join(", ")}`
          : "",
    ].filter(Boolean).join("\n");

    const system = [
      "You are a meticulous UK family holiday researcher. You use web search to find REAL, CURRENT holiday prices — you never invent a hotel name, review, or price.",
      `Only use sources from these travel websites: ${ALLOWLIST_BRIEF}.`,
      "Every price you report must be the TOTAL cost in GBP for the whole party for the whole stay described — never a per-person, per-night, or deposit figure. If a page only shows a per-person or per-night price, multiply it out yourself and say so in the notes.",
      `As a sanity check, a genuine trip like this should cost at least roughly £${floor.toLocaleString("en-GB")} for the whole party — if everything you can find is far below that, the page is showing a fragment price, not a real total; convert it correctly or skip it.`,
      "Return up to 6 real options, each with the exact source URL you found it on. If you cannot find any real current price, return an empty options array rather than guessing.",
      preferenceBrief(prefs),
    ].join("\n\n");

    const user = `Find current holiday prices matching this family's search:\n${criteria}`;

    const schema = {
      type: "object",
      properties: {
        options: {
          type: "array",
          items: {
            type: "object",
            properties: {
              priceGbp: { type: "number" },
              sourceName: { type: "string" },
              sourceUrl: { type: "string" },
              hotelName: { type: "string" },
              boardBasis: { type: "string" },
              officialStars: { type: ["number", "null"] },
              tripadvisorScore: { type: ["number", "null"] },
              bookingMode: {
                type: "string",
                enum: ["package", "flights_hotel_separate", "airline_holiday", "hotel_only"],
              },
              independentSummary: { type: "string" },
              whySuitable: { type: "array", items: { type: "string" } },
              priceNote: { type: "string" },
            },
            required: [
              "priceGbp", "sourceName", "sourceUrl", "hotelName", "boardBasis",
              "officialStars", "tripadvisorScore", "bookingMode", "independentSummary",
              "whySuitable", "priceNote",
            ],
            additionalProperties: false,
          },
        },
        sourcesChecked: { type: "array", items: { type: "string" } },
      },
      required: ["options", "sourcesChecked"],
      additionalProperties: false,
    };

    const { json, costGbp } = await callOpenAiResponses({
      apiKey, system, user, schemaName: "holiday_price_options", schema, timeoutMs: 60_000,
    });
    await recordAiSpend(uid, costGbp);

    const rawOptions: any[] = Array.isArray(json?.options) ? json.options : [];
    const sourcesChecked: string[] = Array.isArray(json?.sourcesChecked) ? json.sourcesChecked : [];

    const findings: SearchOption[] = rawOptions
      .filter((o) => isAllowlistedUrl(String(o.sourceUrl || "")))
      .filter((o) => isPlausibleTotalPrice(Number(o.priceGbp), watch))
      .map((o, i): SearchOption => {
        const basePrice = Math.round(Number(o.priceGbp));
        const amountNotes = [
          parkingGbp > 0 ? `~£${parkingGbp} for parking at ${departureAirport || "your departure airport"}` : "",
          airportHotelGbp > 0 && parkAndStaySavingGbp === 0 ? `~£${airportHotelGbp} for an airport hotel the night before` : "",
          parkAndStaySavingGbp > 0 ? `~£${airportHotelGbp + parkingGbp - parkAndStaySavingGbp} for a bundled park & stay package` : "",
        ].filter(Boolean).join(" and ");
        const addOnsSummary = amountNotes ? ` Includes ${amountNotes} for the trip.${addOnsNote}` : addOnsNote;
        return {
          priceGbp: basePrice + addOnsGbp,
          sourceName: String(o.sourceName || "Travel site"),
          sourceUrl: String(o.sourceUrl),
          packageLabel: `${o.hotelName || watch.destination} · AI-researched`,
          hotelName: o.hotelName ? String(o.hotelName) : undefined,
          destinationLabel: watch.destination,
          nights,
          boardBasis: o.boardBasis ? String(o.boardBasis) : undefined,
          officialStars: o.officialStars == null ? null : Number(o.officialStars),
          tripadvisorScore: o.tripadvisorScore == null ? null : Number(o.tripadvisorScore),
          independentSummary: o.independentSummary ? String(o.independentSummary) : undefined,
          whySuitable: Array.isArray(o.whySuitable) ? o.whySuitable.map(String) : undefined,
          bookingMode: (["package", "flights_hotel_separate", "airline_holiday", "hotel_only"] as BookingMode[]).includes(o.bookingMode)
            ? (o.bookingMode as BookingMode)
            : undefined,
          notes: `${o.priceNote ? String(o.priceNote) : "Live price found via AI web research across allowlisted travel sites"}${addOnsSummary}`,
          priceConfidence: "ai_researched",
          rank: i + 1,
          suitabilityScore: Math.max(0, 90 - i * 4),
        };
      })
      .slice(0, 10);

    return { findings, sourcesChecked: sourcesChecked.length ? sourcesChecked : findings.map((f) => f.sourceName) };
  } catch (err) {
    logger.warn("AI holiday price research failed, caller should fall back", { destination: watch.destination, err });
    return null;
  }
}

/**
 * "What resorts/islands fit us?" — an AI-researched overview of a destination
 * or region, tailored to the family's saved preferences, with real sources.
 */
export const researchHolidayDestination = onCall(
  { secrets: [openaiApiKey], timeoutSeconds: 120 },
  async (request) => {
    const uid = requireAuth(request);
    const query = String(request.data?.query || "").trim();
    if (!query) throw new HttpsError("invalid-argument", "A destination or region is required.");

    const criteria = request.data?.criteria || {};
    const prefs = await loadPreferenceProfile(uid);
    if (!(await hasAiBudgetRemaining(uid, prefs.aiMonthlyBudgetGbp))) {
      throw new HttpsError(
        "resource-exhausted",
        `This household's AI holiday research budget (£${prefs.aiMonthlyBudgetGbp}/month) has been reached — it resets on the 1st. Destination overviews have no free fallback, but price watches will keep running on the modelled estimate.`,
      );
    }

    const criteriaBrief = [
      criteria.nights ? `Trip length: ${criteria.nights} nights` : "",
      criteria.travellers?.adults
        ? `Travellers: ${criteria.travellers.adults} adults, ${criteria.travellers.children || 0} children, ${criteria.travellers.infants || 0} infants`
        : "",
      criteria.maxBudgetGbp ? `Budget ceiling: £${criteria.maxBudgetGbp} total` : "",
      criteria.boardBasis && criteria.boardBasis !== "no_preference" ? `Board basis: ${criteria.boardBasis}` : "",
      criteria.hotelStarsMin ? `Minimum hotel stars: ${criteria.hotelStarsMin}` : "",
      Array.isArray(criteria.keyFeatures) && criteria.keyFeatures.length ? `Must-haves: ${criteria.keyFeatures.join(", ")}` : "",
    ].filter(Boolean).join("\n");

    const system = [
      "You are a meticulous UK family holiday researcher producing a genuine, current overview of a destination or region — not a generic travel-brochure summary.",
      `Only cite and rely on these travel websites for prices, availability, and reviews: ${ALLOWLIST_BRIEF}. Use web search to check them.`,
      "Break the query into its real constituent areas (e.g. for a region, the actual islands/cities within it), and for each surface real, currently-bookable resorts/hotels — never invented names.",
      "Compare the resorts you find against each other and explain, in your own analysis, why one might suit this specific family better than another, given their saved preferences below.",
      preferenceBrief(prefs),
      criteriaBrief ? `This specific trip's criteria:\n${criteriaBrief}` : "",
    ].filter(Boolean).join("\n\n");

    const user = `Give a family holiday overview of: ${query}`;

    const schema = {
      type: "object",
      properties: {
        overview: { type: "string" },
        areas: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              summary: { type: "string" },
              bestFor: { type: "array", items: { type: "string" } },
            },
            required: ["name", "summary", "bestFor"],
            additionalProperties: false,
          },
        },
        resorts: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              area: { type: "string" },
              whyItFits: { type: "array", items: { type: "string" } },
              approxPriceGbpPerPerson: { type: ["number", "null"] },
              boardBasis: { type: "string" },
              starRating: { type: ["number", "null"] },
              reviewHighlights: { type: "array", items: { type: "string" } },
              sourceUrls: { type: "array", items: { type: "string" } },
            },
            required: [
              "name", "area", "whyItFits", "approxPriceGbpPerPerson", "boardBasis",
              "starRating", "reviewHighlights", "sourceUrls",
            ],
            additionalProperties: false,
          },
        },
        topPick: {
          type: ["object", "null"],
          properties: {
            name: { type: "string" },
            reason: { type: "string" },
          },
          required: ["name", "reason"],
          additionalProperties: false,
        },
        caveats: { type: "array", items: { type: "string" } },
      },
      required: ["overview", "areas", "resorts", "topPick", "caveats"],
      additionalProperties: false,
    };

    const { json, citations, costGbp } = await callOpenAiResponses({
      apiKey: openaiApiKey.value(), system, user, schemaName: "holiday_destination_overview", schema, timeoutMs: 110_000,
    });
    await recordAiSpend(uid, costGbp);

    const sourceUrls = new Set<string>();
    for (const r of Array.isArray(json.resorts) ? json.resorts : []) {
      for (const u of Array.isArray(r.sourceUrls) ? r.sourceUrls : []) {
        if (isAllowlistedUrl(String(u))) sourceUrls.add(String(u));
      }
    }
    const sources = citations.filter((c) => isAllowlistedUrl(c.url) || sourceUrls.has(c.url));
    for (const url of sourceUrls) {
      if (!sources.some((s) => s.url === url)) sources.push({ url, title: url });
    }

    const overview = {
      query,
      overview: String(json.overview || ""),
      areas: Array.isArray(json.areas) ? json.areas : [],
      resorts: Array.isArray(json.resorts)
        ? json.resorts.filter((r: any) => Array.isArray(r.sourceUrls) && r.sourceUrls.some((u: string) => isAllowlistedUrl(u)))
        : [],
      topPick: json.topPick || null,
      caveats: Array.isArray(json.caveats) ? json.caveats : [],
      sources,
    };

    try {
      await admin.firestore().collection(`holidays/${uid}/overviews`).add({
        ...overview,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (err) {
      logger.debug("Could not persist holiday overview", { err });
    }

    return overview;
  },
);

/** Holidays price-watch feature types. */

import { UK_REPUTABLE_BRANDS } from "@/lib/holidayCatalog";
import type { DestinationFilterMode, HolidayKeyFeatureId } from "@/lib/holidayCatalog";

export type HolidayDateMode =
  | "fixed"
  | "flexible_days"
  | "months"
  | "no_preference";

export type HolidayFlightBooking =
  | "british_airways"
  | "travel_agent_package"
  | "book_separately"
  | "no_preference";

export type HolidayFlightClass =
  | "economy"
  | "premium_economy"
  | "business"
  | "first"
  | "no_preference";

export type HolidayBoardBasis =
  | "room_only"
  | "self_catering"
  | "bed_breakfast"
  | "half_board"
  | "full_board"
  | "all_inclusive"
  | "no_preference";

export type HolidaySearchUnit = "hours" | "days" | "weeks" | "months";

export type HolidayWatchScheduleMode = "once" | "scheduled";

export type HolidayWatchStatus = "active" | "paused" | "archived";

export type HolidayAlertChannel = "push" | "email" | "sms";

/** What this watch is tracking */
export type HolidayWatchKind = "search" | "flight" | "hotel";

export interface HolidaySpecificFlight {
  airline?: string;
  /** e.g. BA123 */
  outboundFlightNumber?: string;
  returnFlightNumber?: string;
  origin: string;
  destination: string;
  outboundDate?: string;
  returnDate?: string;
  cabin?: HolidayFlightClass;
}

export interface HolidaySpecificHotel {
  name: string;
  location: string;
  checkIn?: string;
  checkOut?: string;
  nights?: number;
  boardBasis?: HolidayBoardBasis;
  bookingUrl?: string;
}

export interface HolidayTravellers {
  adults: number;
  children: number;
  infants: number;
}

export interface HolidayDatePrefs {
  mode: HolidayDateMode;
  startDate?: string;
  endDate?: string;
  nights?: number;
  flexDays?: number;
  months?: number[];
  year?: number;
}

export interface HolidayBrandPref {
  name: string;
  rank: number;
}

export interface HolidayDestinationPrefs {
  filterMode: DestinationFilterMode;
  /** Selected catalogue id or country / region label */
  destinationId?: string;
  destination: string;
  region?: string;
  country?: string;
}

export interface HolidayWatch {
  id?: string;
  title: string;
  /** search = criteria-based holiday hunt; flight/hotel = watch a specific booking */
  watchKind?: HolidayWatchKind;
  destination: string;
  destinationPrefs?: HolidayDestinationPrefs;
  departureAirports: string[];
  dates: HolidayDatePrefs;
  travellers: HolidayTravellers;
  brands: HolidayBrandPref[];
  includeAllBrands?: boolean;
  flightBooking: HolidayFlightBooking;
  flightClass: HolidayFlightClass;
  boardBasis: HolidayBoardBasis;
  directFlightsOnly: boolean;
  maxStops?: number;
  /** Optional minimum hotel star rating 1–5 */
  hotelStarsMin?: number | null;
  /** Optional minimum TripAdvisor score 1–5 */
  tripadvisorMin?: number | null;
  maxBudgetGbp?: number | null;
  targetPriceGbp?: number | null;
  /** Whether maxBudgetGbp/targetPriceGbp are per traveller or for the whole party. Defaults to total. */
  budgetBasis?: "total" | "per_person";
  includeTransfers: boolean;
  /** Add an estimate for parking the car at the departure airport for the trip length. */
  includeParking?: boolean;
  kidsClub: boolean;
  poolRequired: boolean;
  keyFeatures?: HolidayKeyFeatureId[];
  notes?: string;
  specificFlight?: HolidaySpecificFlight | null;
  specificHotel?: HolidaySpecificHotel | null;
  /** once = run a single search; scheduled = keep checking on an interval */
  scheduleMode?: HolidayWatchScheduleMode;
  searchIntervalAmount: number;
  searchIntervalUnit: HolidaySearchUnit;
  alertChannels: HolidayAlertChannel[];
  status: HolidayWatchStatus;
  bestPriceGbp?: number | null;
  bestPriceSource?: string | null;
  bestPriceUrl?: string | null;
  bestPriceFoundAt?: string | null;
  lastSearchedAt?: string | null;
  nextSearchAt?: string | null;
  lastOptions?: HolidaySearchOption[];
  createdAt?: any;
  updatedAt?: any;
}

export interface HolidayReviewSummary {
  source: string;
  score?: number;
  sampleSize?: string;
  summary: string;
  url?: string;
  pros?: string[];
  cons?: string[];
  themes?: string[];
}

export interface HolidayDiscountInfo {
  type: "nhs_bluelight" | "student" | "loyalty" | "senior" | "military" | "other";
  label: string;
  detail: string;
  estimatedSavingPct?: number;
}

export type HolidayBookingMode =
  | "package"
  | "flights_hotel_separate"
  | "airline_holiday"
  | "hotel_only";

export interface HolidayCostLine {
  kind: "flights" | "hotel" | "package" | "transfers" | "parking" | "taxes_fees" | "discount" | "other";
  label: string;
  amountGbp: number;
  estimated?: boolean;
  perPerson?: boolean;
}

export interface HolidayCostBreakdown {
  currency: "GBP";
  totalGbp: number;
  lines: HolidayCostLine[];
  partySize?: number;
  rooms?: number;
  priceBasis?: "total_party" | "per_person";
  confidence?: "ai_researched" | "live" | "partial" | "estimated";
}

export interface HolidaySearchOption {
  id?: string;
  watchId: string;
  rank: number;
  suitabilityScore: number;
  priceGbp: number;
  currency: "GBP";
  sourceName: string;
  sourceUrl: string;
  packageLabel: string;
  hotelName?: string;
  destinationLabel?: string;
  outboundDate?: string;
  returnDate?: string;
  nights?: number;
  boardBasis?: string;
  flightClass?: string;
  departureAirport?: string;
  directFlight?: boolean;
  officialStars?: number | null;
  tripadvisorScore?: number | null;
  reviewSummaries?: HolidayReviewSummary[];
  independentSummary?: string;
  discounts?: HolidayDiscountInfo[];
  whySuitable?: string[];
  bookingMode?: HolidayBookingMode | null;
  costBreakdown?: HolidayCostBreakdown | null;
  researchNotes?: string[];
  priceConfidence?: "ai_researched" | "live" | "partial" | "estimated" | null;
  notes?: string;
  manual?: boolean;
  foundAt: string;
  createdAt?: any;
}

/** @deprecated prefer HolidaySearchOption — kept for older price docs */
export interface HolidayPriceFinding {
  id?: string;
  watchId: string;
  priceGbp: number;
  currency: "GBP";
  sourceName: string;
  sourceUrl: string;
  packageLabel?: string;
  outboundDate?: string;
  returnDate?: string;
  boardBasis?: string;
  flightClass?: string;
  notes?: string;
  manual?: boolean;
  foundAt: string;
  createdAt?: any;
  /** Newer fields may appear on price docs after upgrade */
  suitabilityScore?: number;
  rank?: number;
  officialStars?: number | null;
  tripadvisorScore?: number | null;
  reviewSummaries?: HolidayReviewSummary[];
  independentSummary?: string;
  discounts?: HolidayDiscountInfo[];
  whySuitable?: string[];
  hotelName?: string;
  destinationLabel?: string;
  nights?: number;
  departureAirport?: string;
  directFlight?: boolean;
  bookingMode?: HolidayBookingMode | null;
  costBreakdown?: HolidayCostBreakdown | null;
  researchNotes?: string[];
  priceConfidence?: "ai_researched" | "live" | "partial" | "estimated" | null;
}

export interface HolidaySettings {
  defaultSearchIntervalAmount: number;
  defaultSearchIntervalUnit: HolidaySearchUnit;
  defaultAlertChannels: HolidayAlertChannel[];
  preferredBrands: string[];
  preferredDepartureAirports: string[];
  /** Resorts/hotels the family has enjoyed before or wants to prioritise. */
  likedResorts: string[];
  /** Amenities the family cares about, beyond a single watch's key features. */
  likedAmenities: HolidayKeyFeatureId[];
  /** Free-text themes the AI should weigh when reading reviews, e.g. "quiet at night", "kid-friendly pool". */
  reviewPriorities: string[];
  /** Freeform notes the AI should take into account for every search and overview. */
  preferenceNotes: string;
  /** Shared monthly cap, in GBP, on AI research spend across every watch and Explore search. null = no cap. */
  aiMonthlyBudgetGbp: number | null;
  updatedAt?: any;
}

/** One shared monthly AI-research spend pot per household, read live from holidays/{uid}/meta/aiUsage. */
export interface HolidayAiUsage {
  periodKey: string;
  spendGbp: number;
  callCount: number;
  updatedAt?: any;
}

export const DEFAULT_HOLIDAY_SETTINGS: HolidaySettings = {
  defaultSearchIntervalAmount: 1,
  defaultSearchIntervalUnit: "days",
  defaultAlertChannels: ["push", "email"],
  preferredBrands: [
    "British Airways Holidays",
    "Jet2Holidays",
    "TUI",
    "easyJet Holidays",
    "Loveholidays",
    "On the Beach",
    "Trailfinders",
    "Virgin Atlantic Holidays",
  ],
  preferredDepartureAirports: ["LON", "MAN", "BHX", "EDI"],
  likedResorts: [],
  likedAmenities: [],
  reviewPriorities: [],
  preferenceNotes: "",
  aiMonthlyBudgetGbp: null,
};

/**
 * Rough per-call cost of an AI holiday search, in GBP, based on OpenAI's published
 * per-token and per-web-search rates for a typical multi-site lookup. This is an
 * estimate for display only — the real spend is metered and capped server-side.
 */
export const AI_SEARCH_ESTIMATED_COST_GBP = 0.15;
/** A destination overview does more web research and produces a longer report, so costs more per call. */
export const AI_OVERVIEW_ESTIMATED_COST_GBP = 0.4;

const AVERAGE_DAYS_PER_MONTH = 30.44;

/** Estimated AI research spend per month for a watch searching every `amount` `unit`s. */
export function estimateAiSearchMonthlyCostGbp(amount: number, unit: HolidaySearchUnit): number {
  const intervalMs = holidaySearchIntervalMs(amount, unit);
  const monthMs = AVERAGE_DAYS_PER_MONTH * 24 * 60 * 60 * 1000;
  const searchesPerMonth = monthMs / intervalMs;
  return AI_SEARCH_ESTIMATED_COST_GBP * searchesPerMonth;
}

export const HOLIDAY_BRAND_OPTIONS = UK_REPUTABLE_BRANDS;

export const HOLIDAY_ACCENT = "hsl(172,48%,38%)";
export const HOLIDAY_GRADIENT =
  "linear-gradient(135deg,hsl(172,52%,42%),hsl(188,48%,36%))";

export const WATCH_KIND_LABELS: Record<HolidayWatchKind, string> = {
  search: "Holiday search",
  flight: "Specific flight",
  hotel: "Specific hotel / resort",
};
export const DATE_MODE_LABELS: Record<HolidayDateMode, string> = {
  fixed: "Fixed dates",
  flexible_days: "Flexible (± days)",
  months: "By month",
  no_preference: "No preference",
};

export const FLIGHT_BOOKING_LABELS: Record<HolidayFlightBooking, string> = {
  british_airways: "Book through British Airways",
  travel_agent_package: "Travel agent package",
  book_separately: "Book flights separately",
  no_preference: "No preference",
};

export const FLIGHT_CLASS_LABELS: Record<HolidayFlightClass, string> = {
  economy: "Economy",
  premium_economy: "Premium economy",
  business: "Business",
  first: "First",
  no_preference: "No preference",
};

export const BOARD_BASIS_LABELS: Record<HolidayBoardBasis, string> = {
  room_only: "Room only",
  self_catering: "Self-catering",
  bed_breakfast: "Bed & breakfast",
  half_board: "Half board",
  full_board: "Full board",
  all_inclusive: "All-inclusive",
  no_preference: "No preference",
};

export const BOOKING_MODE_LABELS: Record<HolidayBookingMode, string> = {
  package: "Package holiday",
  flights_hotel_separate: "Flights + hotel separate",
  airline_holiday: "Airline holiday",
  hotel_only: "Hotel only",
};

export const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function holidaySearchIntervalMs(amount: number, unit: HolidaySearchUnit): number {
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

export function nextHolidaySearchAt(
  from: Date,
  amount: number,
  unit: HolidaySearchUnit,
): string {
  return new Date(from.getTime() + holidaySearchIntervalMs(amount, unit)).toISOString();
}

/** One resort/hotel surfaced by the AI destination overview, with sources so it can be checked. */
export interface HolidayOverviewResort {
  name: string;
  area: string;
  whyItFits: string[];
  approxPriceGbpPerPerson: number | null;
  boardBasis?: string;
  starRating?: number | null;
  reviewHighlights: string[];
  sourceUrls: string[];
}

/** One island/region/area within a broader destination query, e.g. one island within "Caribbean". */
export interface HolidayOverviewArea {
  name: string;
  summary: string;
  bestFor: string[];
}

/** AI-researched overview of a destination or region, tailored to the family's saved preferences. */
export interface HolidayDestinationOverview {
  id?: string;
  query: string;
  overview: string;
  areas: HolidayOverviewArea[];
  resorts: HolidayOverviewResort[];
  topPick: { name: string; reason: string } | null;
  caveats: string[];
  sources: { url: string; title: string }[];
  createdAt?: any;
}

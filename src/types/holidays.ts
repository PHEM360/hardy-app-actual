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

export type HolidayWatchStatus = "active" | "paused" | "archived";

export type HolidayAlertChannel = "push" | "email";

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
  includeTransfers: boolean;
  kidsClub: boolean;
  poolRequired: boolean;
  keyFeatures?: HolidayKeyFeatureId[];
  notes?: string;
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
}

export interface HolidayDiscountInfo {
  type: "nhs_bluelight" | "student" | "loyalty" | "senior" | "military" | "other";
  label: string;
  detail: string;
  estimatedSavingPct?: number;
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
}

export interface HolidaySettings {
  defaultSearchIntervalAmount: number;
  defaultSearchIntervalUnit: HolidaySearchUnit;
  defaultAlertChannels: HolidayAlertChannel[];
  preferredBrands: string[];
  preferredDepartureAirports: string[];
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
};

export const HOLIDAY_BRAND_OPTIONS = UK_REPUTABLE_BRANDS;

export const HOLIDAY_ACCENT = "hsl(172,48%,38%)";
export const HOLIDAY_GRADIENT =
  "linear-gradient(135deg,hsl(172,52%,42%),hsl(188,48%,36%))";

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

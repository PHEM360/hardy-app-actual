/** Holidays price-watch feature types. */

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
  /** ISO date — used for fixed / flexible_days */
  startDate?: string;
  /** ISO date — used for fixed / flexible_days */
  endDate?: string;
  /** Nights, when duration is preferred over an end date */
  nights?: number;
  /** ± days when mode is flexible_days */
  flexDays?: number;
  /** Calendar months 1–12 when mode is months */
  months?: number[];
  /** Optional year for month-based searches */
  year?: number;
}

export interface HolidayBrandPref {
  name: string;
  rank: number;
}

export interface HolidayWatch {
  id?: string;
  title: string;
  destination: string;
  departureAirports: string[];
  dates: HolidayDatePrefs;
  travellers: HolidayTravellers;
  brands: HolidayBrandPref[];
  flightBooking: HolidayFlightBooking;
  flightClass: HolidayFlightClass;
  boardBasis: HolidayBoardBasis;
  directFlightsOnly: boolean;
  maxStops?: number;
  hotelStarsMin?: number;
  /** Soft upper budget in GBP; null = no cap */
  maxBudgetGbp?: number | null;
  /** Alert when price is at or below this */
  targetPriceGbp?: number | null;
  includeTransfers: boolean;
  kidsClub: boolean;
  poolRequired: boolean;
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
  createdAt?: any;
  updatedAt?: any;
}

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
  /** true when entered by the user rather than the automated searcher */
  manual?: boolean;
  foundAt: string;
  createdAt?: any;
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
  ],
  preferredDepartureAirports: ["LHR", "LGW", "STN", "LTN", "MAN", "BHX", "EDI"],
};

export const HOLIDAY_BRAND_OPTIONS = [
  "British Airways Holidays",
  "British Airways",
  "Jet2Holidays",
  "Jet2",
  "TUI",
  "easyJet Holidays",
  "easyJet",
  "Loveholidays",
  "On the Beach",
  "Lastminute.com",
  "Expedia",
  "Booking.com",
  "Ryanair",
  "Virgin Atlantic",
  "Kuoni",
  "Trailfinders",
];

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

/** Milliseconds for a search interval. */
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

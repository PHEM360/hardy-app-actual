import Holidays from "@/pages/Holidays";
import {
  DEFAULT_HOLIDAY_SETTINGS,
  type HolidaySearchOption,
  type HolidayWatch,
} from "@/types/holidays";

/**
 * Dev-only, unauthenticated preview of the Holidays page with synthetic sample
 * data. Routed at /dev/holidays-preview when import.meta.env.DEV is true.
 */
export default function HolidaysPreview() {
  const watches: HolidayWatch[] = [
    {
      id: "w1",
      title: "Crete half-term",
      destination: "Crete",
      destinationPrefs: {
        filterMode: "region",
        destinationId: "crete",
        destination: "Crete",
        region: "Mediterranean",
        country: "Greece",
      },
      departureAirports: ["LON", "MAN"],
      dates: {
        mode: "flexible_days",
        startDate: "2027-02-13",
        endDate: "2027-02-20",
        nights: 7,
        flexDays: 3,
      },
      travellers: { adults: 2, children: 2, infants: 0 },
      brands: [
        { name: "Jet2Holidays", rank: 1 },
        { name: "TUI", rank: 2 },
        { name: "British Airways Holidays", rank: 3 },
      ],
      includeAllBrands: false,
      flightBooking: "travel_agent_package",
      flightClass: "economy",
      boardBasis: "all_inclusive",
      directFlightsOnly: true,
      hotelStarsMin: 4,
      tripadvisorMin: 4,
      maxBudgetGbp: 4500,
      targetPriceGbp: 3200,
      includeTransfers: true,
      kidsClub: true,
      poolRequired: true,
      keyFeatures: ["family_friendly", "kids_club", "pool", "beachfront"],
      notes: "Prefer quiet evenings after kids' bedtime",
      searchIntervalAmount: 6,
      searchIntervalUnit: "hours",
      alertChannels: ["push", "email"],
      status: "active",
      bestPriceGbp: 3480,
      bestPriceSource: "Jet2Holidays",
      bestPriceUrl: "https://www.jet2holidays.com/",
      bestPriceFoundAt: "2026-09-01T10:00:00.000Z",
      lastSearchedAt: "2026-09-02T08:00:00.000Z",
    },
    {
      id: "w2",
      title: "Barbados sunshine",
      destination: "Barbados",
      destinationPrefs: {
        filterMode: "region",
        destinationId: "barbados",
        destination: "Barbados",
        region: "Caribbean",
        country: "Barbados",
      },
      departureAirports: ["LHR"],
      dates: {
        mode: "months",
        months: [1, 2],
        year: 2027,
        nights: 10,
      },
      travellers: { adults: 2, children: 0, infants: 0 },
      brands: [
        { name: "British Airways Holidays", rank: 1 },
        { name: "Virgin Atlantic Holidays", rank: 2 },
      ],
      includeAllBrands: true,
      flightBooking: "british_airways",
      flightClass: "premium_economy",
      boardBasis: "bed_breakfast",
      directFlightsOnly: true,
      hotelStarsMin: 4,
      tripadvisorMin: 4.5,
      maxBudgetGbp: 6000,
      targetPriceGbp: 4800,
      includeTransfers: false,
      kidsClub: false,
      poolRequired: true,
      keyFeatures: ["adults_only", "spa", "beachfront"],
      notes: "",
      searchIntervalAmount: 1,
      searchIntervalUnit: "days",
      alertChannels: ["email"],
      status: "active",
      bestPriceGbp: 5120,
      bestPriceSource: "British Airways Holidays",
      bestPriceUrl: "https://www.britishairways.com/",
      bestPriceFoundAt: "2026-08-28T12:00:00.000Z",
      lastSearchedAt: "2026-09-01T12:00:00.000Z",
    },
  ];

  const pricesByWatchId: Record<string, HolidaySearchOption[]> = {
    w1: [
      {
        watchId: "w1",
        rank: 1,
        suitabilityScore: 92,
        priceGbp: 3480,
        currency: "GBP",
        sourceName: "Jet2Holidays",
        sourceUrl: "https://www.jet2holidays.com/",
        packageLabel: "Crete Resort · Jet2Holidays",
        hotelName: "Crete Beach Club",
        destinationLabel: "Crete",
        nights: 7,
        boardBasis: "all_inclusive",
        officialStars: 4.5,
        tripadvisorScore: 4.6,
        reviewSummaries: [
          {
            source: "TripAdvisor",
            score: 4.6,
            sampleSize: "2,100+ reviews",
            summary: "Guests praise cleanliness, kids club and beach access; a minority mention evening noise.",
          },
          {
            source: "Booking.com",
            score: 8.9,
            sampleSize: "Guest reviews",
            summary: "Recent guests highlight breakfast and pool; a few mention walking distance to the village.",
          },
        ],
        independentSummary:
          "Independent guest feedback averages about 4.6/5 with Booking.com guests typically scoring around 8.9/10. Official star rating sits at the premium end. Worth checking Jet2 free child places and NHS/Blue Light before you book.",
        discounts: [
          {
            type: "loyalty",
            label: "Jet2 free child places",
            detail: "Seasonal free child place promotions on package holidays.",
            estimatedSavingPct: 15,
          },
          {
            type: "nhs_bluelight",
            label: "NHS / Blue Light",
            detail: "Periodic healthcare worker offers via partner portals.",
            estimatedSavingPct: 5,
          },
        ],
        whySuitable: ["Within your max budget", "Matches your #1 brand", "Meets 4★ minimum"],
        foundAt: "2026-09-01T10:00:00.000Z",
      },
      {
        watchId: "w1",
        rank: 2,
        suitabilityScore: 86,
        priceGbp: 3610,
        currency: "GBP",
        sourceName: "TUI",
        sourceUrl: "https://www.tui.co.uk/",
        packageLabel: "Crete Hotel · TUI",
        hotelName: "Crete Hotel",
        destinationLabel: "Crete",
        nights: 7,
        boardBasis: "all_inclusive",
        officialStars: 4,
        tripadvisorScore: 4.2,
        reviewSummaries: [
          {
            source: "TripAdvisor",
            score: 4.2,
            sampleSize: "1,400+ reviews",
            summary: "Solid scores for rooms and food; some notes on queues at check-in.",
          },
          {
            source: "Booking.com",
            score: 8.3,
            sampleSize: "Guest reviews",
            summary: "Families like the pool area; a few mention dated bathrooms.",
          },
        ],
        independentSummary:
          "Independent guest feedback averages about 4.2/5. Mid-to-upper tier official rating. Check TUI Blue / free kid places.",
        discounts: [
          {
            type: "loyalty",
            label: "TUI Blue / club offers",
            detail: "Member pricing and free kid places on selected dates.",
            estimatedSavingPct: 10,
          },
        ],
        whySuitable: ["Within your max budget", "Matches preferred brand #2"],
        foundAt: "2026-09-01T10:00:00.000Z",
      },
      {
        watchId: "w1",
        rank: 3,
        suitabilityScore: 81,
        priceGbp: 3725,
        currency: "GBP",
        sourceName: "Loveholidays",
        sourceUrl: "https://www.loveholidays.com/",
        packageLabel: "Crete Suites · Loveholidays",
        hotelName: "Crete Suites",
        destinationLabel: "Crete",
        nights: 7,
        boardBasis: "all_inclusive",
        officialStars: 4,
        tripadvisorScore: 4.0,
        reviewSummaries: [
          {
            source: "TripAdvisor",
            score: 4.0,
            sampleSize: "900+ reviews",
            summary: "Good value flagged often, with occasional maintenance comments.",
          },
        ],
        independentSummary:
          "Value-focused option with Blue Light Card deals worth checking at checkout.",
        discounts: [
          {
            type: "nhs_bluelight",
            label: "Blue Light Card",
            detail: "Loveholidays regularly lists Blue Light exclusive deals.",
            estimatedSavingPct: 7,
          },
          {
            type: "student",
            label: "Student discount",
            detail: "Partner student codes appear seasonally.",
            estimatedSavingPct: 5,
          },
        ],
        whySuitable: ["Within your max budget", "2 discount route(s) to check"],
        foundAt: "2026-09-01T10:00:00.000Z",
      },
    ],
  };

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        // Simulate installed PWA / notch so preview checks status-bar clearance
        paddingTop: "env(safe-area-inset-top, 47px)",
        paddingBottom: "env(safe-area-inset-bottom, 34px)",
      }}
    >
      <Holidays
        mockData={{
          watches: watches.map((w) =>
            w.id === "w1" ? { ...w, lastOptions: pricesByWatchId.w1 } : w,
          ),
          pricesByWatchId,
          settings: DEFAULT_HOLIDAY_SETTINGS,
        }}
      />
    </div>
  );
}

import Holidays from "@/pages/Holidays";
import { DEFAULT_HOLIDAY_SETTINGS, type HolidayPriceFinding, type HolidayWatch } from "@/types/holidays";

/**
 * Dev-only, unauthenticated preview of the Holidays page with synthetic sample
 * data. Routed at /dev/holidays-preview when import.meta.env.DEV is true.
 */
export default function HolidaysPreview() {
  const watches: HolidayWatch[] = [
    {
      id: "w1",
      title: "Crete half-term",
      destination: "Crete, Greece",
      departureAirports: ["LGW", "LTN"],
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
      flightBooking: "travel_agent_package",
      flightClass: "economy",
      boardBasis: "all_inclusive",
      directFlightsOnly: true,
      maxBudgetGbp: 4500,
      targetPriceGbp: 3200,
      includeTransfers: true,
      kidsClub: true,
      poolRequired: true,
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
        { name: "Virgin Atlantic", rank: 2 },
      ],
      flightBooking: "british_airways",
      flightClass: "premium_economy",
      boardBasis: "bed_breakfast",
      directFlightsOnly: true,
      maxBudgetGbp: 6000,
      targetPriceGbp: 4800,
      includeTransfers: false,
      kidsClub: false,
      poolRequired: true,
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

  const pricesByWatchId: Record<string, HolidayPriceFinding[]> = {
    w1: [
      {
        id: "p1",
        watchId: "w1",
        priceGbp: 3480,
        currency: "GBP",
        sourceName: "Jet2Holidays",
        sourceUrl: "https://www.jet2holidays.com/",
        foundAt: "2026-09-01T10:00:00.000Z",
        packageLabel: "Crete · all-inclusive",
      },
      {
        id: "p2",
        watchId: "w1",
        priceGbp: 3610,
        currency: "GBP",
        sourceName: "TUI",
        sourceUrl: "https://www.tui.co.uk/",
        foundAt: "2026-08-30T09:00:00.000Z",
      },
      {
        id: "p3",
        watchId: "w1",
        priceGbp: 3725,
        currency: "GBP",
        sourceName: "Loveholidays",
        sourceUrl: "https://www.loveholidays.com/",
        foundAt: "2026-08-29T14:00:00.000Z",
        manual: true,
      },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Holidays
        mockData={{
          watches,
          pricesByWatchId,
          settings: DEFAULT_HOLIDAY_SETTINGS,
        }}
      />
    </div>
  );
}

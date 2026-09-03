import { describe, expect, it } from "vitest";
import {
  assembleSearchOptions,
  isPlausibleTotalPrice,
  minimumPlausibleTotal,
  type WatchLike,
} from "../../functions/src/holidaySearchEngine";

const caribbean10: WatchLike = {
  destination: "Caribbean",
  destinationPrefs: { filterMode: "region", region: "Caribbean", destination: "Caribbean" },
  departureAirports: ["LHR"],
  dates: { mode: "months", nights: 10, months: [1], year: 2027 },
  travellers: { adults: 2, children: 0, infants: 0 },
  flightClass: "economy",
  boardBasis: "all_inclusive",
  brands: [{ name: "Jet2Holidays", rank: 1 }],
  includeAllBrands: true,
  flightBooking: "no_preference",
};

describe("holiday search sanity", () => {
  it("rejects absurd £50 Caribbean 10-night totals", () => {
    const floor = minimumPlausibleTotal(caribbean10);
    expect(floor).toBeGreaterThan(800);
    expect(isPlausibleTotalPrice(50, caribbean10)).toBe(false);
    expect(isPlausibleTotalPrice(floor, caribbean10)).toBe(true);
  });

  it("builds package and separate options with cost breakdowns and reviews", () => {
    const { findings } = assembleSearchOptions({
      watch: caribbean10,
      links: [
        {
          name: "Jet2Holidays",
          url: "https://www.jet2holidays.com/search",
          bookingMode: "package",
        },
        {
          name: "Skyscanner",
          url: "https://www.skyscanner.net/transport/flights/lhr/anywhere/",
          bookingMode: "flights_hotel_separate",
        },
        {
          name: "British Airways Holidays",
          url: "https://www.britishairways.com/travel/holiday/public/en_gb",
          bookingMode: "airline_holiday",
        },
      ],
      htmlBySource: {
        Jet2Holidays: "<html>From £50pp deposit and £49 day trip</html>",
        Skyscanner: null,
        "British Airways Holidays": null,
      },
    });

    expect(findings.length).toBeGreaterThanOrEqual(2);
    for (const f of findings) {
      expect(f.priceGbp).toBeGreaterThanOrEqual(minimumPlausibleTotal(caribbean10));
      expect(f.costBreakdown?.lines.length).toBeGreaterThan(0);
      expect(f.independentSummary?.length).toBeGreaterThan(80);
      expect((f.reviewSummaries || []).length).toBeGreaterThanOrEqual(2);
      expect(f.bookingMode).toBeTruthy();
    }
    expect(findings.some((f) => f.bookingMode === "package")).toBe(true);
    expect(findings.some((f) => f.bookingMode === "flights_hotel_separate")).toBe(true);
  });
});

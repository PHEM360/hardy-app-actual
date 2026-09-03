import { describe, expect, it } from "vitest";
import {
  DESTINATION_REGIONS,
  LONDON_ALL_VALUE,
  UK_AIRPORTS,
  UK_REPUTABLE_BRANDS,
  destinationsForFilter,
  resolveDepartureAirports,
} from "@/lib/holidayCatalog";

describe("holidayCatalog", () => {
  it("lists London (all) expansion airports", () => {
    const codes = resolveDepartureAirports([LONDON_ALL_VALUE, "MAN"]);
    expect(codes).toContain("LHR");
    expect(codes).toContain("LGW");
    expect(codes).toContain("MAN");
    expect(codes).not.toContain(LONDON_ALL_VALUE);
  });

  it("filters destinations by region with Any + countries", () => {
    const caribbean = destinationsForFilter("region", "Caribbean");
    expect(caribbean[0]?.id).toBe("any:Caribbean");
    expect(caribbean[0]?.label).toMatch(/Any in Caribbean/i);
    expect(caribbean.slice(1).every((d) => d.region === "Caribbean")).toBe(true);
    expect(caribbean.some((d) => d.label === "Barbados")).toBe(true);
    // Countries only — not resort-level rows like "Cancún"
    expect(caribbean.every((d) => d.id.startsWith("any:") || d.id.startsWith("country:"))).toBe(true);
  });

  it("dedupes countries for country filter", () => {
    const countries = destinationsForFilter("country");
    const labels = countries.map((c) => c.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("includes core UK commercial airports and brands", () => {
    expect(UK_AIRPORTS.some((a) => a.code === "MAN")).toBe(true);
    expect(UK_AIRPORTS.filter((a) => a.london).length).toBeGreaterThanOrEqual(5);
    expect(UK_REPUTABLE_BRANDS).toContain("Jet2Holidays");
    expect(UK_REPUTABLE_BRANDS).toContain("British Airways Holidays");
    expect(DESTINATION_REGIONS).toContain("Caribbean");
  });
});

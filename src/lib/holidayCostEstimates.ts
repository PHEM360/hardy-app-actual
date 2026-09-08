/**
 * Client-side preview estimates for holiday add-on costs (parking, airport
 * hotel, private taxi transfers). Mirrors the rough rates used server-side
 * in functions/src/holidaySearchEngine.ts so the form can show a live "~£X"
 * before a search ever runs — the real, metered figure comes back from the
 * search itself.
 */

export type HolidayHaulBand = "short" | "medium" | "long" | "ultra";

const REGION_HAUL: Record<string, HolidayHaulBand> = {
  "UK & Ireland": "short",
  Europe: "short",
  Mediterranean: "short",
  Canaries: "short",
  "Middle East": "medium",
  Africa: "medium",
  Caribbean: "long",
  "North America": "long",
  "Central America": "long",
  "South America": "ultra",
  Asia: "ultra",
  "Indian Ocean": "ultra",
  Australasia: "ultra",
};

export function haulForRegion(region: string | undefined): HolidayHaulBand {
  return (region && REGION_HAUL[region]) || "medium";
}

function departureCode(departureAirports: string[] | undefined): string | undefined {
  const codes = (departureAirports || []).map((c) => c.toUpperCase());
  return codes.filter((c) => c !== "LON")[0] || codes[0];
}

const AIRPORT_PARKING_PER_DAY_GBP: Record<string, number> = {
  LHR: 22, LGW: 16, STN: 13, LTN: 12, LCY: 20, SEN: 9,
  MAN: 13, BHX: 12, EDI: 14, GLA: 12, ABZ: 11, BFS: 10,
  BRS: 13, NCL: 10, LPL: 9, EMA: 9, LBA: 9, SOU: 12, NWI: 9, EXT: 9,
};
const DEFAULT_PARKING_PER_DAY_GBP = 12;

export function estimateAirportParkingGbp(departureAirports: string[] | undefined, nights: number): number {
  const code = departureCode(departureAirports) || "";
  const perDay = AIRPORT_PARKING_PER_DAY_GBP[code] ?? DEFAULT_PARKING_PER_DAY_GBP;
  const days = Math.max(1, nights) + 1;
  return Math.round(perDay * days);
}

const AIRPORT_HOTEL_PER_ROOM_GBP: Record<string, number> = {
  LHR: 95, LGW: 80, STN: 70, LTN: 65, LCY: 100, SEN: 60,
  MAN: 75, BHX: 65, EDI: 80, GLA: 65, ABZ: 70, BFS: 65,
  BRS: 70, NCL: 60, LPL: 60, EMA: 60, LBA: 60, SOU: 70, NWI: 60, EXT: 60,
};
const DEFAULT_AIRPORT_HOTEL_PER_ROOM_GBP = 70;

export function roomsNeededFor(adults: number, children: number): number {
  return Math.max(1, Math.ceil((adults + children) / 3));
}

export function estimateAirportHotelGbp(departureAirports: string[] | undefined, rooms: number): number {
  const code = departureCode(departureAirports) || "";
  const perRoom = AIRPORT_HOTEL_PER_ROOM_GBP[code] ?? DEFAULT_AIRPORT_HOTEL_PER_ROOM_GBP;
  return Math.round(perRoom * Math.max(1, rooms));
}

const PARK_AND_STAY_SAVING_PCT = 0.15;

export function compareParkAndStayGbp(hotelGbp: number, parkingGbp: number) {
  const separateTotalGbp = hotelGbp + parkingGbp;
  const packageTotalGbp = Math.round(separateTotalGbp * (1 - PARK_AND_STAY_SAVING_PCT));
  return {
    separateTotalGbp,
    packageTotalGbp,
    packageIsCheaper: packageTotalGbp < separateTotalGbp,
    savingGbp: separateTotalGbp - packageTotalGbp,
  };
}

const PRIVATE_TAXI_MINUTES: Record<HolidayHaulBand, number> = { short: 35, medium: 50, long: 60, ultra: 75 };
const PRIVATE_TAXI_BASE_GBP: Record<HolidayHaulBand, number> = { short: 45, medium: 65, long: 85, ultra: 110 };

export function estimatePrivateTaxiGbp(region: string | undefined, partySize: number): { costGbp: number; durationMinutes: number } {
  const haul = haulForRegion(region);
  const extraPassengers = Math.max(0, partySize - 4);
  const oneWay = PRIVATE_TAXI_BASE_GBP[haul] + extraPassengers * 12;
  return { costGbp: Math.round(oneWay * 2), durationMinutes: PRIVATE_TAXI_MINUTES[haul] };
}

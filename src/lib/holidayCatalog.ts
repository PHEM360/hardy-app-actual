/** Curated holiday destination / airport / brand catalogues for the Holidays form. */

export type DestinationFilterMode = "country" | "region" | "other";

export interface HolidayDestinationOption {
  id: string;
  label: string;
  country: string;
  region: string;
}

export interface UkAirport {
  code: string;
  name: string;
  city: string;
  /** London-area airports grouped under "London (all)" */
  london?: boolean;
}

export const DESTINATION_REGIONS = [
  "Caribbean",
  "Mediterranean",
  "Canaries",
  "Europe",
  "Middle East",
  "Africa",
  "Asia",
  "Indian Ocean",
  "North America",
  "Central America",
  "South America",
  "Australasia",
  "UK & Ireland",
] as const;

export const HOLIDAY_DESTINATIONS: HolidayDestinationOption[] = [
  { id: "spain", label: "Spain", country: "Spain", region: "Mediterranean" },
  { id: "majorca", label: "Majorca", country: "Spain", region: "Mediterranean" },
  { id: "ibiza", label: "Ibiza", country: "Spain", region: "Mediterranean" },
  { id: "menorca", label: "Menorca", country: "Spain", region: "Mediterranean" },
  { id: "costa-del-sol", label: "Costa del Sol", country: "Spain", region: "Mediterranean" },
  { id: "costa-blanca", label: "Costa Blanca", country: "Spain", region: "Mediterranean" },
  { id: "tenerife", label: "Tenerife", country: "Spain", region: "Canaries" },
  { id: "gran-canaria", label: "Gran Canaria", country: "Spain", region: "Canaries" },
  { id: "lanzarote", label: "Lanzarote", country: "Spain", region: "Canaries" },
  { id: "fuerteventura", label: "Fuerteventura", country: "Spain", region: "Canaries" },
  { id: "portugal", label: "Portugal", country: "Portugal", region: "Europe" },
  { id: "algarve", label: "Algarve", country: "Portugal", region: "Europe" },
  { id: "madeira", label: "Madeira", country: "Portugal", region: "Europe" },
  { id: "greece", label: "Greece", country: "Greece", region: "Mediterranean" },
  { id: "crete", label: "Crete", country: "Greece", region: "Mediterranean" },
  { id: "rhodes", label: "Rhodes", country: "Greece", region: "Mediterranean" },
  { id: "corfu", label: "Corfu", country: "Greece", region: "Mediterranean" },
  { id: "santorini", label: "Santorini", country: "Greece", region: "Mediterranean" },
  { id: "cyprus", label: "Cyprus", country: "Cyprus", region: "Mediterranean" },
  { id: "turkey", label: "Turkey", country: "Turkey", region: "Mediterranean" },
  { id: "antalya", label: "Antalya", country: "Turkey", region: "Mediterranean" },
  { id: "italy", label: "Italy", country: "Italy", region: "Mediterranean" },
  { id: "sardinia", label: "Sardinia", country: "Italy", region: "Mediterranean" },
  { id: "sicily", label: "Sicily", country: "Italy", region: "Mediterranean" },
  { id: "france", label: "France", country: "France", region: "Europe" },
  { id: "croatia", label: "Croatia", country: "Croatia", region: "Mediterranean" },
  { id: "malta", label: "Malta", country: "Malta", region: "Mediterranean" },
  { id: "egypt", label: "Egypt", country: "Egypt", region: "Africa" },
  { id: "sharm", label: "Sharm El Sheikh", country: "Egypt", region: "Africa" },
  { id: "morocco", label: "Morocco", country: "Morocco", region: "Africa" },
  { id: "tunisia", label: "Tunisia", country: "Tunisia", region: "Africa" },
  { id: "cape-verde", label: "Cape Verde", country: "Cape Verde", region: "Africa" },
  { id: "dubai", label: "Dubai", country: "UAE", region: "Middle East" },
  { id: "abu-dhabi", label: "Abu Dhabi", country: "UAE", region: "Middle East" },
  { id: "maldives", label: "Maldives", country: "Maldives", region: "Indian Ocean" },
  { id: "mauritius", label: "Mauritius", country: "Mauritius", region: "Indian Ocean" },
  { id: "seychelles", label: "Seychelles", country: "Seychelles", region: "Indian Ocean" },
  { id: "sri-lanka", label: "Sri Lanka", country: "Sri Lanka", region: "Asia" },
  { id: "thailand", label: "Thailand", country: "Thailand", region: "Asia" },
  { id: "bali", label: "Bali", country: "Indonesia", region: "Asia" },
  { id: "vietnam", label: "Vietnam", country: "Vietnam", region: "Asia" },
  { id: "japan", label: "Japan", country: "Japan", region: "Asia" },
  { id: "barbados", label: "Barbados", country: "Barbados", region: "Caribbean" },
  { id: "antigua", label: "Antigua", country: "Antigua & Barbuda", region: "Caribbean" },
  { id: "st-lucia", label: "St Lucia", country: "St Lucia", region: "Caribbean" },
  { id: "jamaica", label: "Jamaica", country: "Jamaica", region: "Caribbean" },
  { id: "dominican", label: "Dominican Republic", country: "Dominican Republic", region: "Caribbean" },
  { id: "cuba", label: "Cuba", country: "Cuba", region: "Caribbean" },
  { id: "mexico", label: "Mexico", country: "Mexico", region: "Central America" },
  { id: "cancun", label: "Cancún", country: "Mexico", region: "Central America" },
  { id: "florida", label: "Florida", country: "USA", region: "North America" },
  { id: "new-york", label: "New York", country: "USA", region: "North America" },
  { id: "california", label: "California", country: "USA", region: "North America" },
  { id: "canada", label: "Canada", country: "Canada", region: "North America" },
  { id: "australia", label: "Australia", country: "Australia", region: "Australasia" },
  { id: "new-zealand", label: "New Zealand", country: "New Zealand", region: "Australasia" },
  { id: "iceland", label: "Iceland", country: "Iceland", region: "Europe" },
  { id: "norway", label: "Norway", country: "Norway", region: "Europe" },
  { id: "scotland", label: "Scotland", country: "UK", region: "UK & Ireland" },
  { id: "ireland", label: "Ireland", country: "Ireland", region: "UK & Ireland" },
];

/** UK airports with scheduled commercial passenger flights. */
export const UK_AIRPORTS: UkAirport[] = [
  { code: "LHR", name: "Heathrow", city: "London", london: true },
  { code: "LGW", name: "Gatwick", city: "London", london: true },
  { code: "STN", name: "Stansted", city: "London", london: true },
  { code: "LTN", name: "Luton", city: "London", london: true },
  { code: "LCY", name: "London City", city: "London", london: true },
  { code: "SEN", name: "Southend", city: "London", london: true },
  { code: "MAN", name: "Manchester", city: "Manchester" },
  { code: "BHX", name: "Birmingham", city: "Birmingham" },
  { code: "EDI", name: "Edinburgh", city: "Edinburgh" },
  { code: "GLA", name: "Glasgow", city: "Glasgow" },
  { code: "PIK", name: "Glasgow Prestwick", city: "Prestwick" },
  { code: "ABZ", name: "Aberdeen", city: "Aberdeen" },
  { code: "INV", name: "Inverness", city: "Inverness" },
  { code: "NCL", name: "Newcastle", city: "Newcastle" },
  { code: "LBA", name: "Leeds Bradford", city: "Leeds" },
  { code: "LPL", name: "Liverpool John Lennon", city: "Liverpool" },
  { code: "EMA", name: "East Midlands", city: "East Midlands" },
  { code: "BRS", name: "Bristol", city: "Bristol" },
  { code: "CWL", name: "Cardiff", city: "Cardiff" },
  { code: "EXT", name: "Exeter", city: "Exeter" },
  { code: "NWI", name: "Norwich", city: "Norwich" },
  { code: "SOU", name: "Southampton", city: "Southampton" },
  { code: "BOH", name: "Bournemouth", city: "Bournemouth" },
  { code: "HUY", name: "Humberside", city: "Humberside" },
  { code: "DSA", name: "Doncaster Sheffield", city: "Doncaster" },
  { code: "MME", name: "Teesside", city: "Teesside" },
  { code: "BFS", name: "Belfast International", city: "Belfast" },
  { code: "BHD", name: "Belfast City (George Best)", city: "Belfast" },
  { code: "LDY", name: "City of Derry", city: "Derry" },
  { code: "IOM", name: "Isle of Man", city: "Isle of Man" },
  { code: "JER", name: "Jersey", city: "Jersey" },
  { code: "GCI", name: "Guernsey", city: "Guernsey" },
  { code: "NQY", name: "Newquay Cornwall", city: "Newquay" },
];

export const LONDON_ALL_VALUE = "LON";

export const UK_REPUTABLE_BRANDS = [
  "British Airways Holidays",
  "British Airways",
  "Jet2Holidays",
  "Jet2",
  "TUI",
  "First Choice",
  "easyJet Holidays",
  "easyJet",
  "Loveholidays",
  "On the Beach",
  "Lastminute.com",
  "Expedia",
  "Booking.com",
  "Kayak",
  "Skyscanner",
  "Trailfinders",
  "Kuoni",
  "Virgin Atlantic Holidays",
  "Virgin Atlantic",
  "Ryanair",
  "Ryanair Holidays",
  "British Airways Avios partners",
  "Saga Holidays",
  "Olympic Holidays",
  "Thomas Cook (online)",
  "Travel Republic",
  "HolidayPirates",
  "Secret Escapes",
  "Travelodge Holidays",
  "Premier Inn Holidays",
  "Marriott Vacations",
  "Hilton Honors travel",
  "IHG Holidays",
];

export const HOLIDAY_KEY_FEATURES = [
  { id: "adults_only", label: "Adults only" },
  { id: "family_friendly", label: "Family friendly" },
  { id: "beachfront", label: "Beachfront" },
  { id: "city_break", label: "City break" },
  { id: "quiet", label: "Quiet / peaceful" },
  { id: "nightlife", label: "Nightlife nearby" },
  { id: "spa", label: "Spa" },
  { id: "kids_club", label: "Kids club" },
  { id: "pool", label: "Pool" },
  { id: "waterpark", label: "Waterpark" },
  { id: "ski", label: "Ski / snow" },
  { id: "accessible", label: "Accessible rooms" },
  { id: "pet_friendly", label: "Pet friendly" },
  { id: "all_inclusive_preferred", label: "Prefer all-inclusive" },
  { id: "near_airport", label: "Close to airport" },
] as const;

export type HolidayKeyFeatureId = (typeof HOLIDAY_KEY_FEATURES)[number]["id"];

export function resolveDepartureAirports(selected: string[]): string[] {
  const set = new Set<string>();
  for (const code of selected) {
    if (code === LONDON_ALL_VALUE) {
      UK_AIRPORTS.filter((a) => a.london).forEach((a) => set.add(a.code));
    } else {
      set.add(code);
    }
  }
  return [...set];
}

export function destinationsForFilter(
  mode: DestinationFilterMode,
  region?: string,
): HolidayDestinationOption[] {
  if (mode === "region" && region) {
    return HOLIDAY_DESTINATIONS.filter((d) => d.region === region);
  }
  if (mode === "country") {
    const seen = new Set<string>();
    return HOLIDAY_DESTINATIONS.filter((d) => {
      if (seen.has(d.country)) return false;
      seen.add(d.country);
      return true;
    }).map((d) => ({ ...d, id: d.country.toLowerCase().replace(/\s+/g, "-"), label: d.country }));
  }
  return HOLIDAY_DESTINATIONS;
}

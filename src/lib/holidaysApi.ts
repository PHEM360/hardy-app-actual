import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { HolidayDestinationOverview, HolidaySearchOption } from "@/types/holidays";

export interface HolidaySearchResult {
  watchId: string;
  findings: number;
  options?: HolidaySearchOption[];
  bestPriceGbp: number | null;
  cheaperThanBefore: boolean;
  sourcesChecked: string[];
  message?: string;
}

export async function runHolidayPriceSearch(watchId: string): Promise<HolidaySearchResult> {
  const call = httpsCallable<{ watchId: string }, HolidaySearchResult>(
    functions,
    "runHolidayPriceSearch",
  );
  const res = await call({ watchId });
  return res.data;
}

export interface DestinationOverviewCriteria {
  nights?: number;
  travellers?: { adults: number; children: number; infants: number };
  maxBudgetGbp?: number | null;
  boardBasis?: string;
  hotelStarsMin?: number | null;
  keyFeatures?: string[];
}

export async function researchHolidayDestination(
  query: string,
  criteria?: DestinationOverviewCriteria,
): Promise<HolidayDestinationOverview> {
  const call = httpsCallable<
    { query: string; criteria?: DestinationOverviewCriteria },
    HolidayDestinationOverview
  >(functions, "researchHolidayDestination");
  const res = await call({ query, criteria });
  return res.data;
}

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export interface HolidaySearchResult {
  watchId: string;
  findings: number;
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

import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { BusinessSetup, BusinessSetupProjection } from "@/lib/businessSetupModel";

export type BusinessSetupCritique = {
  summary: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  verdict: string;
  model: string;
};

export async function analyzeBusinessSetup(input: {
  setup: BusinessSetup;
  projection: BusinessSetupProjection;
}) {
  const call = httpsCallable<typeof input, BusinessSetupCritique>(functions, "analyzeBusinessSetup");
  const result = await call(input);
  return result.data;
}

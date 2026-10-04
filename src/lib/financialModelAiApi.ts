import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import type { FinancialModelInput } from "@/lib/financialModel";

export interface ModelAiResponse {
  status: "questions" | "ready";
  questions: { id: string; question: string; why: string; optional: boolean }[];
  model: Partial<FinancialModelInput>;
  summary: string;
  assumptions: string[];
}

export async function interpretFinancialModelScenario(prompt: string, current?: FinancialModelInput): Promise<ModelAiResponse> {
  const call = httpsCallable<{ prompt: string; current?: FinancialModelInput }, ModelAiResponse>(functions, "interpretFinancialModelScenario");
  const response = await call({ prompt, current });
  return response.data;
}

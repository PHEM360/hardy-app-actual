import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export type FinanceAnalysisResult = {
  period: string;
  incomeTotal: number;
  spendTotal: number;
  net: number;
  source: "transactions" | "balances";
  summary: string;
  categories: { name: string; amount: number; pct: number; note: string }[];
  income: { name: string; amount: number }[];
  insights: string[];
  savings: { title: string; detail: string; monthlySaveGbp: number }[];
  model: string;
};

export async function analyzeFinanceSpending(input: {
  accountIds: string[];
  model?: string;
  days?: number;
  householdId?: string;
}) {
  const call = httpsCallable<typeof input, FinanceAnalysisResult>(functions, "analyzeFinanceSpending");
  const result = await call(input);
  return result.data;
}

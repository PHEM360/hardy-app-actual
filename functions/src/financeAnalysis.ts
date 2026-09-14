import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import { generateMarketingJson } from "./marketingProviders";
import { collectAccountSpending } from "./truelayer";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const xaiApiKey = defineSecret("XAI_API_KEY");
const truelayerClientId = defineSecret("TRUELAYER_CLIENT_ID");
const truelayerClientSecret = defineSecret("TRUELAYER_CLIENT_SECRET");

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

function secretValue(secret: { value: () => string }): string {
  try {
    return String(secret.value() || "").trim();
  } catch {
    return "";
  }
}

function providerForModel(model: string): string | undefined {
  const id = model.trim().toLowerCase();
  if (!id || id === "auto") return undefined;
  if (id.startsWith("gpt") || id.startsWith("o")) return "openai";
  if (id.startsWith("gemini")) return "gemini";
  if (id.startsWith("grok")) return "grok";
  return undefined;
}

function emptyAnalysis(period: string, source: "transactions" | "balances", reason: string): FinanceAnalysisResult {
  return {
    period,
    incomeTotal: 0,
    spendTotal: 0,
    net: 0,
    source,
    summary: reason,
    categories: [],
    income: [],
    insights: [reason],
    savings: [],
    model: "none",
  };
}

export const analyzeFinanceSpending = onCall(
  {
    secrets: [openaiApiKey, geminiApiKey, xaiApiKey, truelayerClientId, truelayerClientSecret],
    timeoutSeconds: 180,
    memory: "512MiB",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid || request.auth?.token?.deviceId) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const accountIds = Array.isArray(request.data?.accountIds)
      ? (request.data.accountIds as unknown[]).map((id) => String(id || "").trim()).filter(Boolean)
      : [];
    if (accountIds.length === 0) {
      throw new HttpsError("invalid-argument", "Pick at least one account to analyse.");
    }
    const days = Math.max(30, Math.min(Number(request.data?.days) || 90, 180));
    const model = String(request.data?.model || "auto").trim() || "auto";
    const householdId = String(request.data?.householdId || "").trim();
    if (householdId) {
      const hh = await admin.firestore().doc(`households/${householdId}`).get();
      const members = (hh.data()?.memberIds || []) as string[];
      if (!hh.exists || !members.includes(uid)) {
        throw new HttpsError("permission-denied", "You are not a member of that household.");
      }
    }

    const snapshot = await collectAccountSpending({
      uid,
      accountIds,
      days,
      householdId: householdId || undefined,
    });
    const period = `Last ${days} days`;
    if (snapshot.accounts.length === 0) {
      return emptyAnalysis(period, "balances", "None of those accounts were found.");
    }

    const source = snapshot.transactions.length > 0 ? "transactions" : "balances";
    const payload = {
      period,
      accounts: snapshot.accounts,
      transactions: snapshot.transactions.slice(0, 400),
      balances: snapshot.balances.slice(-80),
    };

    const { value, usage } = await generateMarketingJson({
      task: "analysis",
      system: [
        "You are a careful UK household finance analyst for a private family app.",
        "Use only the supplied numbers. Do not invent merchants or amounts.",
        "If transactions are present, treat negative amounts as spending and positive as income unless the description clearly says otherwise.",
        "If only balances are present, infer cashflow from balance changes and say that deposits and withdrawals are not itemised.",
        "Give practical, specific ways to reduce spending. Stay civil and useful.",
        "Reply as JSON with keys: summary (string), incomeTotal, spendTotal, net, categories[{name,amount,pct,note}], income[{name,amount}], insights[string], savings[{title,detail,monthlySaveGbp}].",
      ].join(" "),
      user: JSON.stringify(payload),
      secrets: {
        openai: secretValue(openaiApiKey) || String(process.env.OPENAI_API_KEY || "").trim(),
        gemini: secretValue(geminiApiKey) || String(process.env.GEMINI_API_KEY || "").trim(),
        grok: secretValue(xaiApiKey) || String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || "").trim(),
      },
      overrides: {
        textProvider: providerForModel(model),
        textModel: model === "auto" ? undefined : model,
      },
      mockGenerate: () => ({
        summary: source === "transactions"
          ? "A first-pass look at recent bank transactions. Connect a live AI key for a fuller write-up."
          : "These accounts only have balance snapshots, so this is cashflow between logged dates — not a category spend report.",
        incomeTotal: snapshot.transactions.filter((tx) => tx.amount > 0).reduce((sum, tx) => sum + tx.amount, 0),
        spendTotal: snapshot.transactions.filter((tx) => tx.amount < 0).reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
        net: snapshot.transactions.reduce((sum, tx) => sum + tx.amount, 0),
        categories: [],
        income: [],
        insights: source === "transactions"
          ? ["Link a model key to get category breakdowns and savings ideas from these transactions."]
          : ["Connect the bank and pick a model to analyse real spending, not just balance changes."],
        savings: [],
      }),
    });

    const raw = (value && typeof value === "object") ? value as Record<string, unknown> : {};
    const num = (key: string) => {
      const n = Number(raw[key]);
      return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
    };
    return {
      period,
      incomeTotal: num("incomeTotal"),
      spendTotal: num("spendTotal"),
      net: num("net"),
      source,
      summary: String(raw.summary || "No summary returned."),
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      income: Array.isArray(raw.income) ? raw.income : [],
      insights: Array.isArray(raw.insights) ? raw.insights.map(String) : [],
      savings: Array.isArray(raw.savings) ? raw.savings : [],
      model: `${usage.provider}:${usage.model}`,
    } satisfies FinanceAnalysisResult;
  },
);

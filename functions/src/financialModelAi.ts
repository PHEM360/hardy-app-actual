import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { generateMarketingJson } from "./marketingProviders";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const xaiApiKey = defineSecret("XAI_API_KEY");

function secretValue(secret: { value: () => string }): string {
  try { return String(secret.value() || "").trim(); } catch { return ""; }
}

export const interpretFinancialModelScenario = onCall(
  { secrets: [openaiApiKey, geminiApiKey, xaiApiKey], timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid || request.auth?.token?.deviceId) throw new HttpsError("unauthenticated", "You must be signed in.");
    const prompt = String(request.data?.prompt || "").trim();
    if (prompt.length < 10) throw new HttpsError("invalid-argument", "Describe the scenario in a little more detail.");
    if (prompt.length > 12_000) throw new HttpsError("invalid-argument", "Keep the scenario below 12,000 characters.");

    const current = request.data?.current && typeof request.data.current === "object" ? request.data.current : undefined;
    const { value } = await generateMarketingJson({
      task: "analysis",
      system: [
        "You convert a UK household financial scenario into a strict structured model for a deterministic calculator.",
        "Never perform or invent the final calculations. Never invent balances, ages, fees, dates, ownership, or tax facts.",
        "Ask concise follow-up questions for material missing facts; every question can be optional and the user may skip it.",
        "Return JSON only with status ('questions' or 'ready'), summary, assumptions[], questions[{id,question,why,optional}], and model.",
        "model may contain name, description, years, inflationPct, deathYear, residenceValueGbp, residenceToDirectDescendants, transferableNilRateBandPct, people, accounts, gifts.",
        "people fields: id,name,age,annualIncomeGbp,annualSpendingGbp. accounts fields: id,ownerId,name,provider,kind,openingBalanceGbp,monthlyContributionGbp,monthlyWithdrawalGbp,returns{cautious,central,optimistic},fees[],includeInEstate.",
        "gifts fields: id,fromPersonId,toPersonId,fromAccountId,toAccountId,amountGbp,month,exemptGbp,fromNormalIncome,giftWithReservation.",
        "Use stable short ids with letters/numbers/underscores. Allowed account kinds: cash,cash_isa,stocks_isa,lisa,gia,pension,property,other.",
        "Default return assumptions only when explicitly labelled as assumptions: cash 2/3/4, invested 2/5/7, inflation 2. Show all percentages as numbers, not decimals.",
        "This is England and UK tax planning. Flag legal/tax uncertainty in assumptions and request professional confirmation where facts materially affect treatment.",
      ].join(" "),
      user: JSON.stringify({ prompt, current }),
      secrets: {
        openai: secretValue(openaiApiKey) || String(process.env.OPENAI_API_KEY || "").trim(),
        gemini: secretValue(geminiApiKey) || String(process.env.GEMINI_API_KEY || "").trim(),
        grok: secretValue(xaiApiKey) || String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || "").trim(),
      },
      mockGenerate: () => ({
        status: "questions",
        summary: "The scenario was received, but a live AI model is not configured.",
        assumptions: [],
        questions: [{ id: "manual", question: "Please add the people, accounts and gifts in the manual builder.", why: "The calculator needs structured figures.", optional: true }],
        model: {},
      }),
    });
    const raw = value && typeof value === "object" ? value as Record<string, unknown> : {};
    return {
      status: raw.status === "ready" ? "ready" : "questions",
      summary: String(raw.summary || "Scenario interpreted."),
      assumptions: Array.isArray(raw.assumptions) ? raw.assumptions.map(String).slice(0, 30) : [],
      questions: Array.isArray(raw.questions) ? raw.questions.slice(0, 20) : [],
      model: raw.model && typeof raw.model === "object" ? raw.model : {},
    };
  },
);

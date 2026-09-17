import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { generateMarketingJson } from "./marketingProviders";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const xaiApiKey = defineSecret("XAI_API_KEY");

export type BusinessSetupCritique = {
  summary: string;
  strengths: string[];
  risks: string[];
  suggestions: string[];
  verdict: string;
  model: string;
};

function secretValue(secret: { value: () => string }): string {
  try {
    const value = String(secret.value() || "").trim();
    return value && value !== "UNSET" ? value : "";
  } catch {
    return "";
  }
}

export const analyzeBusinessSetup = onCall(
  {
    secrets: [openaiApiKey, geminiApiKey, xaiApiKey],
    timeoutSeconds: 120,
    memory: "512MiB",
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) {
      throw new HttpsError("unauthenticated", "You must be signed in.");
    }
    const setup = request.data?.setup as Record<string, unknown> | undefined;
    const projection = request.data?.projection as Record<string, unknown> | undefined;
    if (!setup || typeof setup !== "object") {
      throw new HttpsError("invalid-argument", "Missing business setup data.");
    }

    const payload = { setup, projection };

    const { value, usage } = await generateMarketingJson({
      task: "analysis",
      system: [
        "You are a blunt, experienced UK small-business advisor reviewing a new venture's start-up plan for a private family app.",
        "You are given the plan's start-up costs, ongoing costs, income stream assumptions and a computed year-by-year projection (revenue, costs, tax, cumulative cash).",
        "Critique it like a good mentor would: point out unrealistic growth assumptions, missing costs, thin margins, cashflow/funding risk, and concentration risk (e.g. one income stream doing all the work).",
        "Be specific and reference actual numbers from the data given. Do not invent figures that are not implied by the input.",
        "Reply as strict JSON with keys: summary (string, 2-3 sentences), strengths (string[]), risks (string[]), suggestions (string[], concrete and actionable), verdict (one of: \"strong\", \"promising\", \"risky\", \"needs_work\").",
      ].join(" "),
      user: JSON.stringify(payload),
      secrets: {
        openai: secretValue(openaiApiKey) || String(process.env.OPENAI_API_KEY || "").trim(),
        gemini: secretValue(geminiApiKey) || String(process.env.GEMINI_API_KEY || "").trim(),
        grok: secretValue(xaiApiKey) || String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || "").trim(),
      },
      mockGenerate: () => ({
        summary: "Connect a live AI key to get a full critique of this plan's assumptions and cashflow.",
        strengths: [],
        risks: ["No AI model is currently connected, so this is a placeholder critique."],
        suggestions: ["Add an OpenAI, Gemini or Grok key to get a real analysis of this plan."],
        verdict: "needs_work",
      }),
    });

    const raw = (value && typeof value === "object") ? value as Record<string, unknown> : {};
    const strArray = (v: unknown) => (Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : []);
    const verdictRaw = String(raw.verdict || "").toLowerCase();
    const verdict = ["strong", "promising", "risky", "needs_work"].includes(verdictRaw) ? verdictRaw : "needs_work";

    return {
      summary: String(raw.summary || "No summary returned."),
      strengths: strArray(raw.strengths),
      risks: strArray(raw.risks),
      suggestions: strArray(raw.suggestions),
      verdict,
      model: `${usage.provider}:${usage.model}`,
    } satisfies BusinessSetupCritique;
  },
);

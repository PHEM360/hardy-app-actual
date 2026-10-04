import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { PDFParse } from "pdf-parse";
import { generateMarketingJson, parseModelJson } from "./marketingProviders";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const geminiApiKey = defineSecret("GEMINI_API_KEY");
const xaiApiKey = defineSecret("XAI_API_KEY");

// Finance > Compare platforms. Two jobs, one function:
//  - "fill": suggest figures the user has not entered, from the model's
//    knowledge of UK providers' published charges and long run returns.
//  - "extract": read the figures out of a document the user uploads (a costs
//    and charges statement, a savings summary box, a charges page as PDF).
// Either way the model may only return figures for the fields it was asked
// for, must return null when unsure, and every figure comes back with a note
// saying where it came from so the user can check it.

const MAX_DOCUMENT_BYTES = 6 * 1024 * 1024;
const MAX_TEXT_CHARS = 60000;

interface AssistField {
  key: string;
  label: string;
  unit: string;
  hint: string;
}

export interface PlatformAssistResult {
  values: Record<string, number | null>;
  notes: Record<string, string>;
  summary: string;
  model: string;
}

function secretValue(secret: { value: () => string }): string {
  try {
    const value = String(secret.value() || "").trim();
    return value && value !== "UNSET" ? value : "";
  } catch {
    return "";
  }
}

/** Sanity range per unit, so a mis-read "15" for 0.15% never reaches the maths unflagged. */
function plausible(unit: string, key: string, n: number): boolean {
  if (!Number.isFinite(n) || n < 0) return false;
  if (unit === "%") return key === "annualReturnPercent" ? n <= 30 : key === "interestRatePercent" ? n <= 15 : n <= 5;
  return n <= 1000000;
}

function shapeResult(raw: unknown, fields: AssistField[], model: string): PlatformAssistResult {
  const obj = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawValues = obj.values && typeof obj.values === "object" ? (obj.values as Record<string, unknown>) : {};
  const rawNotes = obj.notes && typeof obj.notes === "object" ? (obj.notes as Record<string, unknown>) : {};
  const values: Record<string, number | null> = {};
  const notes: Record<string, string> = {};
  for (const field of fields) {
    const v = rawValues[field.key];
    const n = v === null || v === undefined || v === "" ? NaN : Number(v);
    values[field.key] = plausible(field.unit, field.key, n) ? Math.round(n * 10000) / 10000 : null;
    const note = rawNotes[field.key];
    if (note && values[field.key] !== null) notes[field.key] = String(note).slice(0, 300);
  }
  return { values, notes, summary: String(obj.summary || "").slice(0, 600), model };
}

const OUTPUT_RULES = [
  "Reply as strict JSON with keys: values (object: field key to number, or null), notes (object: field key to a short string), summary (one or two plain sentences).",
  "Only use the field keys you were given. Percentages are plain numbers, so 0.15 means 0.15%. Money is in pounds per the field's meaning.",
  "Return null for any field you are not confident about. A wrong figure is worse than a blank one. Never invent a figure.",
  "Each note says where the figure comes from in a few words. Do not use dashes to join sentences.",
].join(" ");

export const platformCompareAssist = onCall(
  {
    secrets: [openaiApiKey, geminiApiKey, xaiApiKey],
    timeoutSeconds: 120,
    memory: "1GiB",
  },
  async (request): Promise<PlatformAssistResult> => {
    if (!request.auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");

    const mode = request.data?.mode === "extract" ? "extract" : "fill";
    const account = (request.data?.account ?? {}) as Record<string, unknown>;
    const fields: AssistField[] = Array.isArray(request.data?.fields)
      ? (request.data.fields as Record<string, unknown>[])
          .map((f) => ({ key: String(f?.key || ""), label: String(f?.label || ""), unit: String(f?.unit || ""), hint: String(f?.hint || "") }))
          .filter((f) => f.key && f.label)
          .slice(0, 20)
      : [];
    if (fields.length === 0) throw new HttpsError("invalid-argument", "Nothing to look up.");

    const context = {
      provider: String(account.providerName || "").slice(0, 80),
      accountType: String(account.accountTypeLabel || "").slice(0, 80),
      plan: String(account.planLabel || "").slice(0, 80),
      balance: Number(account.balance) || 0,
      alreadyKnown: account.known && typeof account.known === "object" ? account.known : {},
      fieldsWanted: fields,
    };

    const secrets = {
      openai: secretValue(openaiApiKey) || String(process.env.OPENAI_API_KEY || "").trim(),
      gemini: secretValue(geminiApiKey) || String(process.env.GEMINI_API_KEY || "").trim(),
      grok: secretValue(xaiApiKey) || String(process.env.XAI_API_KEY || process.env.GROK_API_KEY || "").trim(),
    };
    const emptyResult = (summary: string): PlatformAssistResult => ({
      values: Object.fromEntries(fields.map((f) => [f.key, null])),
      notes: {},
      summary,
      model: "none",
    });

    if (mode === "fill") {
      const { value, usage } = await generateMarketingJson({
        task: "analysis",
        system: [
          "You help a UK family compare savings and investment platforms inside a private app.",
          "You are given a provider, an account type, a plan, the figures already known, and a list of fields that are still blank.",
          "Fill each blank field from what you know of that provider's published UK charges and rates.",
          "For annualReturnPercent give the long run annualised return before charges of the typical default or most popular diversified fund on that platform, and name the fund and period in the note. Past returns are not a forecast, and say so in the summary.",
          "For interest rates give the provider's current standard variable rate for that account only if you know it, and say in the note that rates change often.",
          "You cannot browse the web, so your figures may be out of date. Say that in the summary.",
          OUTPUT_RULES,
        ].join(" "),
        user: JSON.stringify(context),
        secrets,
        mockGenerate: () => emptyResult("No AI model is connected, so nothing could be looked up. Enter the figures yourself."),
      });
      return shapeResult(value, fields, `${usage.provider}:${usage.model}`);
    }

    // extract
    const mimeType = String(request.data?.mimeType || "");
    const base64 = String(request.data?.documentBase64 || "");
    const pastedText = String(request.data?.text || "").slice(0, MAX_TEXT_CHARS);
    const system = [
      "You read a UK savings or investment document and lift specific charges and rates out of it for a private family app.",
      "The document may be a costs and charges statement, an annual statement, a savings account summary box, a key features document or a provider's charges page.",
      "Only report figures that are actually stated in the document. If a figure is given in pounds for the year and a percentage is wanted, work it out only when the document also gives the balance it applies to, and say so in the note.",
      "Each note quotes or names the line in the document the figure came from.",
      OUTPUT_RULES,
    ].join(" ");

    if (mimeType.startsWith("image/")) {
      if (!secrets.openai) throw new HttpsError("failed-precondition", "Reading a photo needs the OpenAI key. Upload a PDF instead.");
      if (base64.length * 0.75 > MAX_DOCUMENT_BYTES) throw new HttpsError("invalid-argument", "That file is too big. Keep it under 6 MB.");
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${secrets.openai}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            {
              role: "user",
              content: [
                { type: "text", text: JSON.stringify(context) },
                { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
              ],
            },
          ],
        }),
      });
      if (!res.ok) throw new HttpsError("internal", "The document could not be read. Try a PDF.");
      const payload = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
      return shapeResult(parseModelJson(payload.choices?.[0]?.message?.content || "{}"), fields, "openai:gpt-4o");
    }

    let text = pastedText;
    if (mimeType === "application/pdf") {
      const buffer = Buffer.from(base64, "base64");
      if (buffer.length > MAX_DOCUMENT_BYTES) throw new HttpsError("invalid-argument", "That file is too big. Keep it under 6 MB.");
      const parser = new PDFParse({ data: buffer });
      try {
        text = (await parser.getText()).text.slice(0, MAX_TEXT_CHARS);
      } catch {
        throw new HttpsError("invalid-argument", "That PDF could not be opened.");
      } finally {
        await parser.destroy();
      }
    }
    if (!text.trim()) {
      throw new HttpsError("invalid-argument", "No readable text was found. If the PDF is a scan, upload a photo of the page instead.");
    }

    const { value, usage } = await generateMarketingJson({
      task: "analysis",
      system,
      user: JSON.stringify({ ...context, document: text }),
      secrets,
      mockGenerate: () => emptyResult("No AI model is connected, so the document could not be read. Enter the figures yourself."),
    });
    return shapeResult(value, fields, `${usage.provider}:${usage.model}`);
  },
);

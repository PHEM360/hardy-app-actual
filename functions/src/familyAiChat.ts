/**
 * Family AI chat proxy. The OpenAI key stays in Secret Manager and never
 * reaches the browser (replaces the old appConfig/ai client-side path).
 */
import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";

const openaiApiKey = defineSecret("OPENAI_API_KEY");

const MAX_HISTORY = 20;
const MAX_MESSAGE_CHARS = 8000;

function requireUid(request: { auth?: { uid: string; token?: Record<string, unknown> } }) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (request.auth.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot use AI chat.");
  }
  return request.auth.uid;
}

function secretValue(secret: { value: () => string }) {
  try {
    const value = String(secret.value() || "").trim();
    return value && value !== "UNSET" ? value : "";
  } catch {
    return "";
  }
}

async function assertPasskeyEnrolled(uid: string) {
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  if (!snap.exists || snap.data()?.passkeyEnrolled !== true) {
    throw new HttpsError("failed-precondition", "Enrol a passkey before using AI chat.");
  }
}

export const familyAiChat = onCall(
  { secrets: [openaiApiKey], timeoutSeconds: 60 },
  async (request) => {
    const uid = requireUid(request);
    await assertPasskeyEnrolled(uid);

    const apiKey = secretValue(openaiApiKey);
    if (!apiKey) {
      throw new HttpsError(
        "failed-precondition",
        "Family AI is not configured. An admin needs to set the OPENAI_API_KEY secret.",
      );
    }

    const systemPrompt = String(request.data?.systemPrompt || "").trim().slice(0, MAX_MESSAGE_CHARS);
    const userMessage = String(request.data?.userMessage || "").trim().slice(0, MAX_MESSAGE_CHARS);
    if (!userMessage) throw new HttpsError("invalid-argument", "Message is required.");

    const rawHistory = Array.isArray(request.data?.history) ? request.data.history : [];
    const history = rawHistory.slice(-MAX_HISTORY).map((entry: { role?: string; text?: string }) => {
      const role = entry?.role === "model" || entry?.role === "assistant" ? "assistant" : "user";
      const content = String(entry?.text || "").trim().slice(0, MAX_MESSAGE_CHARS);
      return { role, content };
    }).filter((m: { content: string }) => m.content);

    const messages = [
      ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
      ...history,
      { role: "user", content: userMessage },
    ];

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature: 0.7,
          max_tokens: 4096,
        }),
      });
    } catch (err) {
      logger.error("familyAiChat fetch failed", { uid, err });
      throw new HttpsError("internal", "Could not reach the AI service.");
    }

    if (!response.ok) {
      const errBody = await response.text().catch(() => "");
      logger.warn("familyAiChat openai status", { uid, status: response.status, errBody: errBody.slice(0, 200) });
      throw new HttpsError("internal", "AI service returned an error.");
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = String(data.choices?.[0]?.message?.content || "").trim();
    if (!text) throw new HttpsError("internal", "AI returned an empty reply.");
    return { text };
  },
);

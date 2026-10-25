import { useCallback, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

/**
 * Family AI chat via Cloud Function. The OpenAI key stays in Secret Manager
 * and is never readable from the browser.
 */
export function useAiConfig() {
  const [loading] = useState(false);
  // Kept for Settings compatibility: key is server-managed, not editable in-app.
  const apiKey = "server-managed";

  const saveApiKey = useCallback(async (_key: string) => {
    throw new Error(
      "The family AI key is managed in Secret Manager (OPENAI_API_KEY), not in the app.",
    );
  }, []);

  const callGemini = useCallback(async (
    systemPrompt: string,
    userMessage: string,
    history: { role: "user" | "model"; text: string }[] = [],
  ): Promise<string> => {
    const call = httpsCallable(functions, "familyAiChat");
    const result = await call({ systemPrompt, userMessage, history });
    const text = String((result.data as { text?: string } | undefined)?.text || "").trim();
    if (!text) throw new Error("EMPTY_REPLY");
    return text;
  }, []);

  return { apiKey, loading, saveApiKey, callGemini };
}

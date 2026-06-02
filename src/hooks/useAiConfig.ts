import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Stores OpenAI API key in Firestore appConfig/ai
// Readable by any authenticated user (private family app).
// Key is used client-side to call the OpenAI REST API directly.

export function useAiConfig() {
  const [apiKey, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "appConfig", "ai"), (snap) => {
      setApiKey(snap.data()?.openaiKey ?? "");
      setLoading(false);
    });
    return unsub;
  }, []);

  const saveApiKey = useCallback(async (key: string) => {
    await setDoc(doc(db, "appConfig", "ai"), { openaiKey: key.trim() }, { merge: true });
  }, []);

  // Call OpenAI Chat Completions API (gpt-4o-mini) directly from the browser.
  // Returns the text reply or throws on error.
  const callGemini = useCallback(async (
    systemPrompt: string,
    userMessage: string,
    history: { role: "user" | "model"; text: string }[] = [],
  ): Promise<string> => {
    if (!apiKey) throw new Error("NO_KEY");

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({
        role: h.role === "model" ? "assistant" : "user",
        content: h.text,
      })),
      { role: "user", content: userMessage },
    ];

    const body = {
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 4096,
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data?.choices?.[0]?.message?.content ?? "";
  }, [apiKey]);

  return { apiKey, loading, saveApiKey, callGemini };
}

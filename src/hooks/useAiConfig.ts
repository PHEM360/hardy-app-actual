import { useEffect, useState, useCallback } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

// Stores Gemini API key in Firestore appConfig/ai
// Readable by any authenticated user (private family app).
// Key is used client-side to call the Gemini REST API directly.

export function useAiConfig() {
  const [apiKey, setApiKey] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "appConfig", "ai"), (snap) => {
      setApiKey(snap.data()?.geminiKey ?? "");
      setLoading(false);
    });
    return unsub;
  }, []);

  const saveApiKey = useCallback(async (key: string) => {
    await setDoc(doc(db, "appConfig", "ai"), { geminiKey: key.trim() }, { merge: true });
  }, []);

  // Call Gemini 1.5 Flash REST API directly from the browser.
  // Returns the text reply or throws on error.
  const callGemini = useCallback(async (
    systemPrompt: string,
    userMessage: string,
    history: { role: "user" | "model"; text: string }[] = [],
  ): Promise<string> => {
    if (!apiKey) throw new Error("NO_KEY");

    const contents = [
      // Include chat history as alternating user/model turns
      ...history.map((h) => ({
        role: h.role,
        parts: [{ text: h.text }],
      })),
      { role: "user", parts: [{ text: userMessage }] },
    ];

    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    };

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  }, [apiKey]);

  return { apiKey, loading, saveApiKey, callGemini };
}

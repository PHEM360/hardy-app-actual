import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

export async function runHealthAiAssessment(healthData: string): Promise<string> {
  const call = httpsCallable<{ healthData: string }, { answer: string }>(functions, "analyzeHealth");
  try {
    const result = await call({ healthData });
    return result.data.answer;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Assessment failed.";
    if (/quota|credit|billing|insufficient/i.test(message)) {
      throw new Error("The family AI key is out of credit. Top up OpenAI billing, then try again.");
    }
    if (/unauthenticated|signed in/i.test(message)) {
      throw new Error("Sign in again, then run the assessment.");
    }
    throw new Error(message.replace(/^Firebase:\s*/i, "").replace(/\s*\(.*\)$/, "") || "Assessment failed. Please try again.");
  }
}

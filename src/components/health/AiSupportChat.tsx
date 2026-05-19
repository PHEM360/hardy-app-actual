import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Loader2, Heart, AlertTriangle, Phone, MessageSquare, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAiConfig } from "@/hooks/useAiConfig";

interface Message {
  role: "user" | "assistant";
  text: string;
  crisis?: boolean;
}

const CRISIS_KEYWORDS = [
  "kill myself", "end my life", "end it all", "don't want to live",
  "not worth living", "want to die", "suicide", "suicidal",
  "hurt myself", "self harm", "self-harm", "cut myself",
  "no reason to live", "better off dead", "overdose",
  "can't go on", "give up on life",
];

function detectCrisis(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

const SYSTEM_PROMPT = `You are a warm, compassionate, non-judgemental mental wellness companion. Your role is to:

- Listen with genuine empathy and reflect back what you hear without immediately problem-solving
- Ask gentle, open-ended questions to help the person explore their feelings
- Validate emotions without judgement — all feelings are okay
- Offer gentle reframes when appropriate, but never dismiss or minimise
- Encourage healthy coping strategies (breathing, grounding, talking to someone trusted)
- If the person mentions feeling unsafe, in danger, or having thoughts of harming themselves, gently acknowledge it, take it seriously, and strongly encourage them to contact a crisis helpline immediately

You are NOT a therapist or doctor. You're a caring companion. Keep responses warm, conversational, and relatively brief (2-4 sentences usually). Never give medical advice. Never diagnose.

If at any point you detect the person may be in crisis, include the phrase "I want to make sure you're safe" in your response.`;

const CRISIS_RESOURCES = [
  { name: "Samaritans", detail: "Call 116 123 · Free, 24/7", color: "bg-red-50 border-red-200 text-red-800" },
  { name: "Crisis Text Line", detail: "Text SHOUT to 85258 · Free, 24/7", color: "bg-orange-50 border-orange-200 text-orange-800" },
  { name: "NHS Urgent Mental Health", detail: "Call 111, option 2", color: "bg-blue-50 border-blue-200 text-blue-800" },
  { name: "Papyrus (under 35)", detail: "Call 0800 068 4141", color: "bg-purple-50 border-purple-200 text-purple-800" },
];

export default function AiSupportChat({ tabName = "Support" }: { tabName?: string }) {
  const { callGemini, apiKey } = useAiConfig();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCrisis, setShowCrisis] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const isCrisis = detectCrisis(text);
    if (isCrisis) setShowCrisis(true);

    const userMsg: Message = { role: "user", text, crisis: isCrisis };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role === "user" ? "user" as const : "model" as const, text: m.text }));
      const reply = await callGemini(SYSTEM_PROMPT, text, history);

      const replyCrisis = reply.toLowerCase().includes("i want to make sure you're safe") || isCrisis;
      if (replyCrisis) setShowCrisis(true);

      setMessages((prev) => [...prev, { role: "assistant", text: reply, crisis: replyCrisis }]);
    } catch (e: any) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        text: "I'm here and I'm listening. I'm having a little trouble connecting right now — please try again in a moment.",
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, callGemini]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const reset = () => { setMessages([]); setShowCrisis(false); };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-rose-100">
            <Heart className="w-3.5 h-3.5 text-rose-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-card-foreground">{tabName} · AI Companion</p>
            <p className="text-[10px] text-muted-foreground">A safe space to talk. Completely private.</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={reset} className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Crisis banner */}
      <AnimatePresence>
        {showCrisis && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 p-3.5 rounded-2xl bg-red-50 border border-red-200"
          >
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <p className="text-xs font-bold text-red-800">If you're in crisis, please reach out now</p>
            </div>
            <p className="text-[11px] text-red-700 mb-2.5">You matter. Help is available right now — these services are free, confidential, and available 24/7.</p>
            <div className="space-y-1.5">
              {CRISIS_RESOURCES.map((r) => (
                <div key={r.name} className={`flex items-center gap-2 p-2 rounded-xl border text-[11px] font-medium ${r.color}`}>
                  <Phone className="w-3 h-3 flex-shrink-0" />
                  <span className="font-bold">{r.name}</span>
                  <span className="text-[10px] font-normal opacity-80">— {r.detail}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome message if empty */}
      {messages.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-10">
          <div className="p-4 rounded-full bg-rose-100 mb-3">
            <MessageSquare className="w-6 h-6 text-rose-500" />
          </div>
          <p className="text-sm font-semibold text-card-foreground mb-1">I'm here to listen</p>
          <p className="text-xs text-muted-foreground max-w-xs leading-relaxed">
            Whatever you're going through, this is a safe, private space. Tell me how you're feeling today.
          </p>
        </div>
      )}

      {/* Chat messages */}
      {messages.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-3 mb-3 pr-1">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-rose-500 text-white rounded-br-sm"
                  : "bg-muted text-card-foreground rounded-bl-sm border border-border/30"
              }`}>
                {msg.text}
                {msg.crisis && msg.role === "assistant" && (
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <p className="text-[10px] text-muted-foreground">💙 Remember: crisis support is available 24/7 — see the resources above.</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 border border-border/30">
                <div className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2 items-end mt-auto">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Share how you're feeling…"
          className="flex-1 rounded-2xl text-sm min-h-[44px] max-h-28 resize-none border-border/60"
          rows={1}
        />
        <Button
          onClick={send}
          disabled={!input.trim() || loading || !apiKey}
          size="icon"
          className="rounded-2xl h-11 w-11 bg-rose-500 hover:bg-rose-600 flex-shrink-0"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>

      {!apiKey && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          AI chat requires a Gemini API key — set one in Settings.
        </p>
      )}
    </div>
  );
}

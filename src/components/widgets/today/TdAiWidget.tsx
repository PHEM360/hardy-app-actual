import { useState, useEffect, useRef } from "react";
import { Send, RefreshCw, Sparkles } from "lucide-react";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useTodayPage } from "@/hooks/useTodayPage";
import { useTasks } from "@/hooks/useTasks";
import { useUserProfile } from "@/hooks/useUserProfile";
import { format } from "date-fns";
import { JEWEL } from "@/lib/brandPalette";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const BRIEFING_KEY = () => `aiDailyBriefing_${format(new Date(), "yyyy-MM-dd")}`;

export function TdAiWidget() {
  const { callGemini } = useAiConfig();
  const { daily } = useTodayPage();
  const { tasks } = useTasks();
  const { profile } = useUserProfile();

  const [briefing, setBriefing] = useState<string>(() => localStorage.getItem(BRIEFING_KEY()) ?? "");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const todayTasks = tasks.filter((t) => t.isToday);
  const doneTasks = todayTasks.filter((t) => t.status === "done").length;
  const name = profile?.firstName ?? "there";

  const buildSystemPrompt = () => {
    const date = format(new Date(), "EEEE d MMMM yyyy");
    const taskLines = todayTasks.map((t) => `  - ${t.title} (${t.status})`).join("\n");
    return `You are a warm, concise personal assistant for ${name}. Today is ${date}.

Their current context:
- Today's focus: "${daily.focus || "not set"}"
- Mood: ${daily.mood || "not checked in"} | Energy: ${daily.energy}/5
- Tasks today: ${todayTasks.length} total, ${doneTasks} done
${taskLines ? taskLines : "  (no tasks flagged for today)"}
- Morning intentions: ${daily.intentions.filter(Boolean).join("; ") || "none set"}
- Water: ${daily.waterCount}/8 glasses

Be brief, practical, and encouraging. Max 3 sentences per reply unless asked for more.`;
  };

  const generateBriefing = async () => {
    setAiLoading(true);
    setError("");
    try {
      const date = format(new Date(), "EEEE d MMMM");
      const taskCount = todayTasks.length;
      const prompt = `Give ${name} a brief, warm morning briefing for ${date}. In 2–3 sentences: acknowledge their focus ("${daily.focus || "not set yet"}"), their ${taskCount} task${taskCount !== 1 ? "s" : ""} for today, and finish with one short encouraging note. Be natural and friendly, not corporate.`;
      const text = await callGemini(buildSystemPrompt(), prompt, []);
      setBriefing(text);
      localStorage.setItem(BRIEFING_KEY(), text);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setAiLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || aiLoading) return;
    const userMsg = input.trim();
    setInput("");
    const newChat: ChatMessage[] = [...chat, { role: "user", text: userMsg }];
    setChat(newChat);
    setAiLoading(true);
    setError("");
    try {
      const history = newChat.slice(0, -1).map((m) => ({
        role: m.role === "user" ? "user" as const : "model" as const,
        text: m.text,
      }));
      const reply = await callGemini(buildSystemPrompt(), userMsg, history);
      setChat([...newChat, { role: "assistant", text: reply }]);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
      setChat(newChat.slice(0, -1));
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, aiLoading]);

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="btn-edge flex h-6 w-6 items-center justify-center rounded-md text-white"
            style={{ background: JEWEL.aubergine }}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <p className="text-xs font-bold text-foreground">AI Assistant</p>
        </div>
        <button
          type="button"
          onClick={generateBriefing}
          disabled={aiLoading}
          title="Regenerate briefing"
          className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${aiLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-3 space-y-2 pb-1">
        {!briefing && chat.length === 0 && !aiLoading && (
          <button
            type="button"
            onClick={generateBriefing}
            className="btn-edge w-full py-3 rounded-lg text-xs font-semibold text-white"
            style={{ background: JEWEL.aubergine }}
          >
            Generate your morning briefing
          </button>
        )}
        {briefing && chat.length === 0 && (
          <div
            className="rounded-xl border border-foreground/20 p-2.5 shadow-card"
            style={{ background: "color-mix(in srgb, " + JEWEL.aubergine + " 12%, white)" }}
          >
            <p className="text-xs text-foreground leading-relaxed">{briefing}</p>
          </div>
        )}
        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-foreground border border-foreground/20"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {aiLoading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-lg bg-card border border-foreground/20">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-[11px] text-destructive px-1">{error}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 p-2.5 border-t border-foreground/15 flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Ask me anything about your day…"
          className="flex-1 text-xs bg-card rounded-lg px-3 py-2 border border-foreground/20 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={!input.trim() || aiLoading}
          className="btn-edge w-8 h-8 rounded-lg text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0"
          style={{ background: JEWEL.aubergine }}
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

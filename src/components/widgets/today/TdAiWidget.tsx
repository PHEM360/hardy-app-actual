import { useState, useEffect, useRef } from "react";
import { Bot, Send, RefreshCw, Key, ExternalLink, Sparkles, X } from "lucide-react";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useTodayPage } from "@/hooks/useTodayPage";
import { useTasks } from "@/hooks/useTasks";
import { useUserProfile } from "@/hooks/useUserProfile";
import { format } from "date-fns";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const BRIEFING_KEY = () => `aiDailyBriefing_${format(new Date(), "yyyy-MM-dd")}`;

export function TdAiWidget() {
  const { apiKey, loading: keyLoading, saveApiKey, callGemini } = useAiConfig();
  const { daily } = useTodayPage();
  const { tasks } = useTasks();
  const { profile } = useUserProfile();

  const [briefing, setBriefing] = useState<string>(() => localStorage.getItem(BRIEFING_KEY()) ?? "");
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [showKeySetup, setShowKeySetup] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const todayTasks = tasks.filter((t) => t.isToday);
  const doneTasks = todayTasks.filter((t) => t.status === "done").length;
  const name = profile?.firstName ?? "there";

  // Build system prompt with live context
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
      if (e.message === "NO_KEY") setShowKeySetup(true);
      else setError(e.message ?? "Something went wrong");
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
      if (e.message === "NO_KEY") setShowKeySetup(true);
      else setError(e.message ?? "Something went wrong");
      setChat(newChat.slice(0, -1)); // rollback
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, aiLoading]);

  // Key setup screen
  if (!keyLoading && !apiKey) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-4 gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
          <Bot className="w-6 h-6 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground mb-1">Set up AI Assistant</p>
          <p className="text-[11px] text-muted-foreground">Add a free Gemini API key to get daily briefings and a personal AI assistant.</p>
        </div>
        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-primary font-medium">
          Get a free key at Google AI Studio <ExternalLink className="w-3 h-3" />
        </a>
        <div className="flex gap-2 w-full max-w-xs">
          <input
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && keyInput.trim()) saveApiKey(keyInput); }}
            placeholder="Paste API key…"
            className="flex-1 text-xs bg-muted/40 rounded-xl px-3 py-2 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
            type="password"
          />
          <button onClick={() => saveApiKey(keyInput)} disabled={!keyInput.trim()}
            className="px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium disabled:opacity-40">
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-white" />
          </div>
          <p className="text-xs font-bold text-foreground">AI Assistant</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={generateBriefing} disabled={aiLoading}
            title="Regenerate briefing"
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${aiLoading ? "animate-spin" : ""}`} />
          </button>
          <button onClick={() => setShowKeySetup((v) => !v)} title="API key settings"
            className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
            <Key className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Key update panel */}
      {showKeySetup && (
        <div className="mx-3 mb-2 p-2.5 rounded-xl bg-muted/40 border border-border/40 flex gap-2 flex-shrink-0">
          <input value={keyInput || apiKey} onChange={(e) => setKeyInput(e.target.value)}
            placeholder="Gemini API key…" type="password"
            className="flex-1 text-xs bg-background rounded-lg px-2.5 py-1.5 border border-border/40 focus:outline-none" />
          <button onClick={() => { saveApiKey(keyInput || apiKey); setShowKeySetup(false); }}
            className="text-xs text-primary font-medium px-2">Save</button>
          <button onClick={() => setShowKeySetup(false)}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
        </div>
      )}

      {/* Briefing / Chat history */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 space-y-2 pb-1">
        {!briefing && chat.length === 0 && !aiLoading && (
          <button onClick={generateBriefing}
            className="w-full py-4 rounded-xl border border-dashed border-violet-200 text-xs text-violet-500 font-medium flex items-center justify-center gap-2 hover:bg-violet-50/50 transition-colors">
            <Sparkles className="w-4 h-4" /> Generate your morning briefing
          </button>
        )}
        {briefing && chat.length === 0 && (
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-50 to-purple-50 border border-violet-100">
            <p className="text-xs text-violet-900 leading-relaxed">{briefing}</p>
          </div>
        )}
        {chat.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/60 text-foreground border border-border/40"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {aiLoading && (
          <div className="flex justify-start">
            <div className="px-3 py-2 rounded-2xl bg-muted/60 border border-border/40">
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

      {/* Chat input */}
      <div className="flex gap-2 p-2.5 border-t border-border/30 flex-shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
          placeholder="Ask me anything about your day…"
          className="flex-1 text-xs bg-muted/40 rounded-xl px-3 py-2 border border-border/40 focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button onClick={sendMessage} disabled={!input.trim() || aiLoading}
          className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center disabled:opacity-40 flex-shrink-0 transition-opacity">
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

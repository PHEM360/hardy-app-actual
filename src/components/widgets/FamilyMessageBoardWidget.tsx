import { useState } from "react";
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { useFamilyMessages } from "@/hooks/useFamilyMessages";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";
import { TdHead } from "@/components/widgets/today/TdHead";

export function FamilyMessageBoardWidget({ variant = "today" }: { variant?: "today" | "dashboard" }) {
  const { messages, loading, householdId, post, remove, uid } = useFamilyMessages();
  const [draft, setDraft] = useState("");
  const accent = WIDGET_ACCENT.messages;

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    await post(text);
  };

  const body = (
    <>
      {!householdId && <p className="text-xs text-muted-foreground">Join a household to use the family board.</p>}
      {householdId && loading && <p className="text-xs text-muted-foreground">Loading…</p>}
      {householdId && !loading && (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 mb-2">
          {messages.length === 0 && <p className="text-xs text-muted-foreground">No messages yet — say hello.</p>}
          {messages.slice(0, 8).map((m) => (
            <div key={m.id} className="rounded-xl bg-background/60 border border-border/40 px-2.5 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold text-muted-foreground truncate">{m.authorName}</p>
                {m.authorUid === uid && (
                  <button type="button" onClick={() => remove(m.id)} className="p-0.5 text-muted-foreground hover:text-destructive" aria-label="Remove">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
              <p className="text-xs text-foreground leading-snug">{m.text}</p>
            </div>
          ))}
        </div>
      )}
      {householdId && (
        <form
          className="flex gap-1.5 flex-shrink-0"
          onSubmit={(e) => { e.preventDefault(); void submit(); }}
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Write a note…"
            maxLength={280}
            className="h-9 flex-1 min-w-0 rounded-xl border border-border bg-background px-2.5 text-xs"
          />
          <button type="submit" className="h-9 px-3 rounded-xl bg-gradient-primary text-primary-foreground text-xs font-semibold">
            Post
          </button>
        </form>
      )}
    </>
  );

  if (variant === "dashboard") {
    return (
      <div className="w-full h-full p-3 pb-3.5 flex flex-col overflow-hidden">
        <div
          className="flex items-center gap-2 -mx-3 -mt-3 mb-2 px-3 py-2.5 flex-shrink-0"
          style={{ background: accentGradient(accent) }}
        >
          <span className="text-[11px] font-bold text-white uppercase tracking-wider">Family board</span>
          <span className="ml-auto text-xs text-white/80">{format(new Date(), "EEE d MMM")}</span>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="💬" title="Family board" />
      {body}
    </div>
  );
}

import { useRef } from "react";
import { useTodayPage } from "@/hooks/useTodayPage";

export function TdNoteWidget() {
  const { daily, saveDaily } = useTodayPage();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDaily({ note: v }), 600);
  };

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <span className="text-base">📝</span>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Daily Note</p>
      </div>
      <textarea
        defaultValue={daily.note}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jot down anything on your mind today…"
        className="flex-1 w-full text-xs text-foreground placeholder:text-muted-foreground/60 bg-transparent resize-none focus:outline-none leading-relaxed"
      />
    </div>
  );
}

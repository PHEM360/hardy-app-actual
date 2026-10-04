import { useRef } from "react";
import { useTodayPage } from "@/hooks/useTodayPage";

import { TdHead } from "./TdHead";
export function TdNoteWidget() {
  const { daily, saveDaily } = useTodayPage();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDaily({ note: v }), 600);
  };

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="📝" title="Daily Note" />
      <textarea
        defaultValue={daily.note}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Jot down anything on your mind today…"
        className="flex-1 w-full text-xs text-foreground placeholder:text-muted-foreground/60 bg-transparent resize-none focus:outline-none leading-relaxed"
      />
    </div>
  );
}

import { useRef } from "react";
import { useTodayPage } from "@/hooks/useTodayPage";

export function TdFocusWidget() {
  const { daily, saveDaily } = useTodayPage();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDaily({ focus: v }), 600);
  };

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <span className="text-base">🎯</span>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Today's Focus</p>
      </div>
      <textarea
        defaultValue={daily.focus}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What's the ONE big thing you want to accomplish today?"
        className="flex-1 w-full text-sm font-medium text-foreground placeholder:text-muted-foreground/60 placeholder:font-normal bg-transparent resize-none focus:outline-none leading-relaxed"
      />
    </div>
  );
}

import { useRef } from "react";
import { useTodayPage } from "@/hooks/useTodayPage";

export function TdReflectionWidget() {
  const { daily, saveDaily } = useTodayPage();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDaily({ reflection: v }), 600);
  };

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center gap-2 mb-2 flex-shrink-0">
        <span className="text-base">🌙</span>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Evening Reflection</p>
      </div>
      <textarea
        defaultValue={daily.reflection}
        onChange={(e) => onChange(e.target.value)}
        placeholder="How did today go? What went well? What could be better tomorrow?"
        className="flex-1 w-full text-xs text-foreground placeholder:text-muted-foreground/60 bg-transparent resize-none focus:outline-none leading-relaxed"
      />
    </div>
  );
}

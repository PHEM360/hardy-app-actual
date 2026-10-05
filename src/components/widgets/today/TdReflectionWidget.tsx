import { useRef } from "react";
import { useTodayPage } from "@/hooks/useTodayPage";

import { TdHead } from "./TdHead";
export function TdReflectionWidget() {
  const { daily, saveDaily } = useTodayPage();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDaily({ reflection: v }), 600);
  };

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="🌙" title="Evening Reflection" />
      <textarea
        defaultValue={daily.reflection}
        onChange={(e) => onChange(e.target.value)}
        placeholder="How did today go? What went well? What could be better tomorrow?"
        className="flex-1 w-full text-xs text-foreground placeholder:text-muted-foreground/60 bg-transparent resize-none focus:outline-none leading-relaxed"
      />
    </div>
  );
}

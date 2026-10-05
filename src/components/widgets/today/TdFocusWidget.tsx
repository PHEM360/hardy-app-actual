import { useRef } from "react";
import { useTodayPage } from "@/hooks/useTodayPage";

import { TdHead } from "./TdHead";
export function TdFocusWidget() {
  const { daily, saveDaily } = useTodayPage();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => saveDaily({ focus: v }), 600);
  };

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="🎯" title="Today's Focus" />
      <textarea
        defaultValue={daily.focus}
        onChange={(e) => onChange(e.target.value)}
        placeholder="What's the ONE big thing you want to accomplish today?"
        className="flex-1 w-full text-sm font-medium text-foreground placeholder:text-muted-foreground/60 placeholder:font-normal bg-transparent resize-none focus:outline-none leading-relaxed"
      />
    </div>
  );
}

import type { ReactNode } from "react";

export function TdHead({
  emoji,
  title,
  action,
}: {
  emoji: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2 flex-shrink-0 gap-2">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base">{emoji}</span>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{title}</p>
      </div>
      {action}
    </div>
  );
}

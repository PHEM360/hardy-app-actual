import { useState } from "react";
import { ChevronDown, Eye, Pencil } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useSharedScope } from "@/hooks/useSharedScope";

/** Dropdown for switching between "my own page" and pages other users have shared with me. */
export default function SharedScopeSwitcher({ page }: { page: string }) {
  const { scopeUserId, availableScopes, setScopeUserId } = useSharedScope(page);
  const [open, setOpen] = useState(false);

  if (availableScopes.length <= 1) return null;

  const current = availableScopes.find((s) => s.uid === scopeUserId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-background text-xs font-semibold text-foreground max-w-[10rem]">
          {current?.permission === "view" ? <Eye className="w-3.5 h-3.5 flex-shrink-0" /> : <Pencil className="w-3.5 h-3.5 flex-shrink-0" />}
          <span className="truncate">{current?.name ?? "Me"}</span>
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1.5">
        {availableScopes.map((s) => (
          <button
            key={s.uid}
            onClick={() => { setScopeUserId(s.uid); setOpen(false); }}
            className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              s.uid === scopeUserId ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
            }`}
          >
            <span className="truncate">{s.name}</span>
            {s.permission === "view" && <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">View only</span>}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

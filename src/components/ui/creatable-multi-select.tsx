import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";

interface CreatableMultiSelectProps {
  value: string[];
  onChange: (values: string[]) => void;
  options: string[];
  placeholder?: string;
  className?: string;
}

export function CreatableMultiSelect({
  value,
  onChange,
  options,
  placeholder = "Add or select…",
  className,
}: CreatableMultiSelectProps) {
  const [inputVal, setInputVal] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter(
    (o) => !value.includes(o) && o.toLowerCase().includes(inputVal.toLowerCase())
  );

  const add = (name: string) => {
    const t = name.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setInputVal("");
    setOpen(false);
    inputRef.current?.focus();
  };

  const remove = (name: string) => onChange(value.filter((v) => v !== name));

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputVal.trim()) {
      e.preventDefault();
      add(inputVal);
    }
    if (e.key === "Backspace" && !inputVal && value.length > 0) {
      remove(value[value.length - 1]);
    }
    if (e.key === "Escape") setOpen(false);
  };

  const showCreate =
    inputVal.trim() &&
    !options.map((o) => o.toLowerCase()).includes(inputVal.trim().toLowerCase()) &&
    !value.map((v) => v.toLowerCase()).includes(inputVal.trim().toLowerCase());

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div
        className="min-h-10 w-full rounded-xl border-2 border-border bg-input px-2 py-1.5 flex flex-wrap gap-1.5 cursor-text focus-within:ring-2 focus-within:ring-ring/50 transition-all"
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
      >
        {value.map((v) => (
          <span
            key={v}
            className="flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium rounded-full px-2.5 py-1 select-none"
          >
            {v}
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); remove(v); }}
              className="hover:text-destructive transition-colors -mr-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={inputVal}
          onChange={(e) => { setInputVal(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[100px] bg-transparent text-sm outline-none placeholder:text-muted-foreground py-0.5 px-1"
        />
      </div>

      {open && (filtered.length > 0 || showCreate) && (
        <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-border bg-popover shadow-lg z-50 overflow-hidden max-h-52 overflow-y-auto">
          {filtered.map((opt) => (
            <button
              key={opt}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); add(opt); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              {opt}
            </button>
          ))}
          {showCreate && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); add(inputVal); }}
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-center gap-2 text-primary border-t border-border/40"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Add <span className="font-semibold">"{inputVal.trim()}"</span></span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

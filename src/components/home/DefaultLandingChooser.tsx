import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LandingPageOption } from "@/lib/defaultLanding";

export function DefaultLandingChooser({
  options,
  value,
  onChoose,
  title = "Where should we take you after login?",
  description = "Pick your default page. You can change this anytime in Settings → Profile.",
  confirmLabel = "Use this page",
}: {
  options: LandingPageOption[];
  value?: string;
  onChoose: (path: string) => void | Promise<void>;
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [selected, setSelected] = useState(value || options[0]?.path || "/dashboard");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!selected || busy) return;
    setBusy(true);
    try {
      await onChoose(selected);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-4 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-lg">
          <Compass className="h-6 w-6" />
        </span>
        <h1 className="font-display text-xl font-bold text-foreground">{title}</h1>
        <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="mb-4 max-h-[min(52vh,28rem)] space-y-2 overflow-y-auto overscroll-contain pr-0.5">
        {options.map((opt, index) => {
          const Icon = opt.icon;
          const active = selected === opt.path;
          const pinned = index < 3;
          return (
            <motion.button
              key={opt.path}
              type="button"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index, 8) * 0.03 }}
              onClick={() => setSelected(opt.path)}
              className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${
                active
                  ? "border-primary/45 bg-primary/10 shadow-card"
                  : "border-border/50 bg-card hover:bg-muted/40"
              }`}
            >
              <span
                className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  active ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="font-display text-sm font-bold text-foreground">{opt.label}</span>
                  {pinned && (
                    <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Suggested
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{opt.description}</span>
              </span>
              {active && <Check className="mt-2 h-4 w-4 shrink-0 text-primary" />}
            </motion.button>
          );
        })}
      </div>

      <Button
        className="h-11 w-full rounded-xl bg-gradient-primary font-semibold"
        disabled={!selected || busy}
        onClick={() => void submit()}
      >
        {busy ? "Saving…" : confirmLabel}
      </Button>
    </div>
  );
}

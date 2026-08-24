import { useLocation } from "react-router-dom";
import { useEffect, useMemo } from "react";
import { ArrowRight, Compass, MonitorSmartphone } from "lucide-react";

const DESTINATIONS = [
  { path: "/display", label: "Always-on display", hint: "The screen a TV, tablet or Pi should show" },
  { path: "/dashboard", label: "Home dashboard", hint: "Everything for today" },
  { path: "/remote-displays", label: "Remote Displays", hint: "Set up and edit linked screens" },
  { path: "/notes", label: "Notes", hint: "Notes, lists and sketches" },
];

/** Edit distance, capped — enough to spot a mistyped address on a tablet keyboard. */
function distance(a: string, b: string) {
  const rows = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = rows[0];
    rows[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = rows[j];
      rows[j] = Math.min(
        rows[j] + 1,
        rows[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      previous = current;
    }
  }
  return rows[b.length];
}

const NotFound = () => {
  const location = useLocation();
  const typed = location.pathname;

  const suggestion = useMemo(() => {
    const candidates = DESTINATIONS.map((item) => ({ ...item, gap: distance(typed.toLowerCase(), item.path) }));
    const closest = candidates.sort((a, b) => a.gap - b.gap)[0];
    return closest && closest.gap <= 3 ? closest : null;
  }, [typed]);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", typed);
  }, [typed]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-gradient-hero px-5 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/20 bg-card shadow-elevated">
        <div className="bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--card)))] px-6 py-7 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-lg">
            <Compass className="h-7 w-7" />
          </span>
          <h1 className="mt-4 font-display text-xl font-bold">That page isn’t here</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Nothing lives at <span className="break-all font-medium text-foreground">{typed}</span>.
          </p>
        </div>

        <div className="space-y-3 p-6">
          {suggestion && (
            <a
              href={suggestion.path}
              className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-[color-mix(in_srgb,hsl(var(--primary))_12%,hsl(var(--card)))] p-4 transition hover:border-primary/60"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                <MonitorSmartphone className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">Did you mean {suggestion.label}?</span>
                <span className="block text-[11px] text-muted-foreground">{suggestion.hint}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-primary" />
            </a>
          )}

          <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Go to</p>
          <div className="space-y-1.5">
            {DESTINATIONS.filter((item) => item.path !== suggestion?.path).map((item) => (
              <a
                key={item.path}
                href={item.path}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition hover:border-primary/40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{item.label}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">{item.hint}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;

import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarMiniWidget } from "@/components/widgets/CalendarMiniWidget";
import { TasksWidget } from "@/components/widgets/TasksWidget";
import { NotesWidget } from "@/components/widgets/NotesWidget";
import { Button } from "@/components/ui/button";

const KINDS = ["calendar", "tasks", "notes"] as const;
type Kind = (typeof KINDS)[number];
type Size = "small" | "medium" | "large";

const STORE = "hardy-hub-home-widget";

function readStore(): { kind: Kind; size: Size } {
  try {
    const raw = localStorage.getItem(STORE);
    if (!raw) return { kind: "calendar", size: "medium" };
    const parsed = JSON.parse(raw) as { kind?: Kind; size?: Size };
    return {
      kind: KINDS.includes(parsed.kind as Kind) ? (parsed.kind as Kind) : "calendar",
      size: parsed.size === "small" || parsed.size === "large" ? parsed.size : "medium",
    };
  } catch {
    return { kind: "calendar", size: "medium" };
  }
}

export default function HubWidget() {
  const { kind: routeKind } = useParams();
  const navigate = useNavigate();
  const stored = useMemo(() => readStore(), []);
  const [kind, setKind] = useState<Kind>(
    KINDS.includes(routeKind as Kind) ? (routeKind as Kind) : stored.kind
  );
  const [size, setSize] = useState<Size>(stored.size);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORE, JSON.stringify({ kind, size }));
  }, [kind, size]);

  useEffect(() => {
    if (routeKind && KINDS.includes(routeKind as Kind)) setKind(routeKind as Kind);
  }, [routeKind]);

  const heights: Record<Size, string> = {
    small: "min-h-[160px] max-w-[180px]",
    medium: "min-h-[280px] max-w-[340px]",
    large: "min-h-[420px] max-w-[420px]",
  };

  const openFull = kind === "notes" ? "/notes" : `/${kind}`;

  return (
    <div
      className="min-h-[100dvh] bg-[linear-gradient(180deg,#1a2744_0%,#0f1923_55%,#142033_100%)] px-4 py-6 text-white"
      style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top, 0px) + 0.75rem))" }}
    >
      <div className="mx-auto flex max-w-md items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Home screen widget</p>
        <div className="flex gap-3">
          <button type="button" className="text-xs text-white/80" onClick={() => setEditing((v) => !v)}>
            {editing ? "Done" : "Edit"}
          </button>
          <button type="button" className="text-xs text-white/80" onClick={() => navigate(openFull)}>
            Open app
          </button>
        </div>
      </div>

      {editing && (
        <div className="mx-auto mt-4 max-w-md space-y-3 rounded-2xl bg-white/10 p-3 text-sm">
          <p className="text-xs text-white/70">
            Pick what this tile shows — like changing an iPhone widget. Add this page to your home screen (Safari Share → Add to Home Screen, or Chrome Install app) so the icon opens this glance instead of the login splash.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map((k) => (
              <Button
                key={k}
                size="sm"
                variant={kind === k ? "default" : "secondary"}
                onClick={() => {
                  setKind(k);
                  navigate(`/widget/${k}`, { replace: true });
                }}
              >
                {k[0].toUpperCase() + k.slice(1)}
              </Button>
            ))}
          </div>
          <div className="flex gap-1.5">
            {(["small", "medium", "large"] as Size[]).map((s) => (
              <Button key={s} size="sm" variant={size === s ? "default" : "secondary"} onClick={() => setSize(s)}>
                {s}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className={`mx-auto mt-8 ${heights[size]} w-full overflow-hidden rounded-[28px] bg-card text-card-foreground shadow-[0_12px_40px_rgba(0,0,0,0.35)]`}>
        {kind === "calendar" && <CalendarMiniWidget />}
        {kind === "tasks" && <TasksWidget />}
        {kind === "notes" && <NotesWidget />}
      </div>
    </div>
  );
}

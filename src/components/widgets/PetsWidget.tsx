import { useNavigate } from "react-router-dom";
import { Heart, Bug, Pill, ChevronRight } from "lucide-react";
import { usePets } from "@/hooks/usePets";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86_400_000);
}

function daysLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

export function PetsWidget() {
  const navigate = useNavigate();
  const { pets, loading } = usePets();
  const accent = WIDGET_ACCENT.pets;

  // Mirror getTreatmentStatus from Pets.tsx: use selectedFlea/selectedWorm + latest dateDue
  type NextItem = { petName: string; type: "worming" | "flea"; dateDue: string; days: number };
  const nextByType: Record<string, NextItem> = {};

  for (const pet of pets) {
    for (const type of ["flea", "worming"] as const) {
      const productName = type === "flea" ? pet.selectedFlea : pet.selectedWorm;
      if (!productName) continue;
      const records = (pet.treatmentHistory ?? [])
        .filter(t => t.type === type && t.name === productName)
        .sort((a, b) => b.dateDue.localeCompare(a.dateDue));
      const latest = records[0];
      if (!latest) continue;
      const days = daysUntil(latest.dateDue);
      if (!nextByType[type] || days < nextByType[type].days) {
        nextByType[type] = { petName: pet.name, type, dateDue: latest.dateDue, days };
      }
    }
  }

  const highlights = Object.values(nextByType).sort((a, b) => a.days - b.days);

  return (
    <button
      className="w-full h-full p-3 pb-3.5 flex flex-col text-left overflow-y-auto group"
      onClick={() => navigate("/pets")}
    >
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 mb-2 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(accent) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <Heart className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Pets</span>
        <ChevronRight className="w-3 h-3 text-white/50 ml-auto group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : pets.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No pets added</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 mb-2 flex-shrink-0 flex-wrap">
            {pets.slice(0, 4).map((p) => (
              <div key={p.id} className="flex items-center gap-1 bg-muted/60 rounded-full px-2 py-0.5 border border-border/50">
                <span className="text-sm">{p.avatar ?? "🐾"}</span>
                <span className="text-[10px] font-medium text-foreground">{p.name}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 space-y-1.5">
            {highlights.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No treatments due</p>
            ) : (
              highlights.map((h) => {
                const overdue = h.days < 0;
                const soon = h.days <= 3 && !overdue;
                const Icon = h.type === "flea" ? Bug : Pill;
                return (
                  <div
                    key={h.type}
                    className={`flex items-center gap-1.5 p-1.5 rounded-lg border ${
                      overdue
                        ? "bg-destructive/10 border-destructive/20"
                        : soon
                        ? "bg-gold/10 border-gold/25"
                        : "bg-muted/40 border-transparent"
                    }`}
                  >
                    <Icon className={`w-3 h-3 flex-shrink-0 ${overdue ? "text-destructive" : soon ? "text-gold" : "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-foreground capitalize">{h.type === "flea" ? "Flea" : "Wormer"}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{h.petName}</p>
                    </div>
                    <span className={`text-[9px] font-bold flex-shrink-0 ${overdue ? "text-destructive" : soon ? "text-gold" : "text-muted-foreground"}`}>
                      {daysLabel(h.days)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </button>
  );
}

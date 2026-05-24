import { useNavigate } from "react-router-dom";
import { Heart, Bug, Pill } from "lucide-react";
import { usePets } from "@/hooks/usePets";

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

  const now = new Date();

  // Find next wormer + next flea treatment across all pets (soonest)
  type NextItem = { petName: string; type: "worming" | "flea"; dateDue: string; days: number };
  const nextByType: Record<string, NextItem> = {};

  for (const pet of pets) {
    for (const tr of (pet.treatmentHistory ?? [])) {
      if ((tr.type === "worming" || tr.type === "flea") && tr.dateDue) {
        const days = daysUntil(tr.dateDue);
        const key = tr.type;
        if (!nextByType[key] || days < nextByType[key].days) {
          nextByType[key] = { petName: pet.name, type: tr.type, dateDue: tr.dateDue, days };
        }
      }
    }
  }

  const highlights = Object.values(nextByType).sort((a, b) => a.days - b.days);

  return (
    <button
      className="w-full h-full p-3 flex flex-col text-left overflow-hidden"
      onClick={() => navigate("/pets")}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <Heart className="w-3.5 h-3.5 text-red-500" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Pets</span>
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
              <div key={p.id} className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-0.5">
                <span className="text-sm">{p.avatar ?? "🐾"}</span>
                <span className="text-[10px] font-medium text-foreground">{p.name}</span>
              </div>
            ))}
          </div>

          <div className="flex-1 min-h-0 overflow-hidden space-y-1.5">
            {highlights.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">No treatments due 🎉</p>
            ) : (
              highlights.map((h) => {
                const overdue = h.days < 0;
                const soon = h.days <= 3 && !overdue;
                const Icon = h.type === "flea" ? Bug : Pill;
                return (
                  <div key={h.type} className={`flex items-center gap-1.5 p-1.5 rounded-lg ${overdue ? "bg-red-50 dark:bg-red-950/30" : soon ? "bg-amber-50 dark:bg-amber-950/30" : "bg-muted/40"}`}>
                    <Icon className={`w-3 h-3 flex-shrink-0 ${overdue ? "text-red-500" : soon ? "text-amber-500" : "text-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-semibold text-foreground capitalize">{h.type === "flea" ? "Flea" : "Wormer"}</p>
                      <p className="text-[9px] text-muted-foreground truncate">{h.petName}</p>
                    </div>
                    <span className={`text-[9px] font-bold flex-shrink-0 ${overdue ? "text-red-500" : soon ? "text-amber-500" : "text-muted-foreground"}`}>
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

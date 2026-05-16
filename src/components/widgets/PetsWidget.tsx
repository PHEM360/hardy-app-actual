import { useNavigate } from "react-router-dom";
import { Heart } from "lucide-react";
import { usePets } from "@/hooks/usePets";

export function PetsWidget() {
  const navigate = useNavigate();
  const { pets, loading } = usePets();

  const now = new Date();

  // Find the next due treatment across all pets
  const upcoming: { petName: string; treatmentName: string; dateDue: string }[] = [];
  for (const pet of pets) {
    for (const tr of (pet.treatmentHistory ?? [])) {
      if (tr.dateDue && new Date(tr.dateDue) >= now) {
        upcoming.push({ petName: pet.name, treatmentName: tr.name, dateDue: tr.dateDue });
      }
    }
  }
  upcoming.sort((a, b) => new Date(a.dateDue).getTime() - new Date(b.dateDue).getTime());

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

          <div className="flex-1 min-h-0 overflow-hidden space-y-1">
            {upcoming.slice(0, 3).map((u, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                <span className="text-[10px] text-foreground truncate flex-1">{u.petName} — {u.treatmentName}</span>
                <span className="text-[9px] text-muted-foreground flex-shrink-0">
                  {new Date(u.dateDue).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
            {upcoming.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No upcoming treatments 🎉</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}

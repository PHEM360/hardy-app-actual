import { useNavigate } from "react-router-dom";
import { usePets } from "@/hooks/usePets";
import { daysUntilDate } from "@/lib/todayInsights";
import { TdHead } from "./TdHead";

export function TdPetsCareWidget() {
  const navigate = useNavigate();
  const { pets, loading } = usePets();
  const due = pets.flatMap((pet) => {
    const rows: { id: string; label: string; days: number }[] = [];
    for (const type of ["flea", "worming"] as const) {
      const product = type === "flea" ? pet.selectedFlea : pet.selectedWorm;
      if (!product) continue;
      const latest = (pet.treatmentHistory ?? [])
        .filter((t) => t.type === type && t.name === product)
        .sort((a, b) => b.dateDue.localeCompare(a.dateDue))[0];
      if (!latest) continue;
      const days = daysUntilDate(latest.dateDue);
      if (days <= 21) rows.push({ id: `${pet.id}-${type}`, label: `${pet.name} · ${type}`, days });
    }
    if (pet.insurance?.renewalDate) {
      const days = daysUntilDate(pet.insurance.renewalDate);
      if (days >= 0 && days <= 31) rows.push({ id: `${pet.id}-ins`, label: `${pet.name} · insurance`, days });
    }
    return rows;
  }).sort((a, b) => a.days - b.days).slice(0, 6);

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead
        emoji="🐾"
        title="Pet care"
        action={
          <button type="button" onClick={() => navigate("/pets")} className="text-[11px] text-primary font-medium">Pets</button>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && due.length === 0 && <p className="text-xs text-muted-foreground">No treatments due soon.</p>}
        {due.map((row) => (
          <div key={row.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate">{row.label}</span>
            <span className={row.days < 0 ? "text-destructive font-semibold" : "text-muted-foreground"}>
              {row.days < 0 ? `${Math.abs(row.days)}d overdue` : row.days === 0 ? "Today" : `${row.days}d`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

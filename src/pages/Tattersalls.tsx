import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import FlatDashboard from "@/components/flats/FlatDashboard";
import { useFlatsList } from "@/hooks/useFlats";

const Tattersalls = () => {
  const { flats, loading } = useFlatsList();
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (!selectedId && flats.length > 0) {
      setSelectedId(flats[0].id);
    }
  }, [flats, selectedId]);

  const selected = flats.find((f) => f.id === selectedId) || flats[0];

  return (
    <FeaturePageShell
      title="Flats"
      subtitle="Rental tracking, yields, tax and bank imports"
      icon={<Building2 className="h-5 w-5" />}
      sharePage="tattersalls"
    >
      {loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Loading flats…</div>
      ) : flats.length === 0 ? (
        <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card">
          <p className="text-sm text-muted-foreground">No flats yet.</p>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:gap-4">
          {/* Mobile top tabs */}
          <div className="min-w-0 overflow-x-hidden lg:hidden">
            <div
              className="flex flex-wrap gap-1.5 rounded-2xl border border-border/50 bg-card p-1.5 shadow-card"
              role="tablist"
              aria-label="Flats"
            >
              {flats.map((f) => {
                const active = (selected?.id || selectedId) === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSelectedId(f.id)}
                    className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                      active
                        ? "border-primary/45 bg-primary/10 text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    {f.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Desktop left rail */}
          <aside className="hidden w-[11rem] shrink-0 lg:block">
            <nav
              aria-label="Flats"
              className="sticky top-2 space-y-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-card"
            >
              {flats.map((f) => {
                const active = (selected?.id || selectedId) === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedId(f.id)}
                    aria-current={active ? "page" : undefined}
                    className={`flex w-full items-center gap-2 rounded-xl border px-2 py-2 text-left transition ${
                      active
                        ? "border-primary/45 bg-primary/10 text-foreground"
                        : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    }`}
                  >
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        active ? "bg-gradient-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 truncate text-xs font-semibold">{f.name}</span>
                  </button>
                );
              })}
            </nav>
          </aside>

          <div className="min-w-0 flex-1 overflow-x-hidden">
            {(selected?.id || selectedId) && (
              <FlatDashboard flatId={selected?.id || selectedId} canEdit />
            )}
          </div>
        </div>
      )}
    </FeaturePageShell>
  );
};

export default Tattersalls;

import { useNavigate } from "react-router-dom";
import { Briefcase, ChevronRight } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

export function CompaniesWidget() {
  const navigate = useNavigate();
  const { companies, loading } = useCompanies();
  const accent = WIDGET_ACCENT.companies;

  return (
    <button
      className="w-full h-full p-3 pb-3.5 flex flex-col text-left overflow-y-auto group"
      onClick={() => navigate("/companies")}
    >
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 mb-2 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(accent) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <Briefcase className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Companies</span>
        <ChevronRight className="w-3 h-3 text-white/50 ml-auto group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : companies.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No companies</p>
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 mb-2.5">
            <p className="text-2xl font-bold font-display text-foreground leading-none">{companies.length}</p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {companies.length === 1 ? "company you manage" : "companies you manage"}
            </p>
          </div>

          <div className="flex-1 min-h-0 space-y-1.5">
            {companies.slice(0, 4).map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <span
                  className="flex items-center justify-center w-6 h-6 rounded-full flex-shrink-0 text-[11px] font-bold text-white shadow-sm"
                  style={{ background: c.color || accent }}
                >
                  {c.emoji ?? c.name.charAt(0).toUpperCase()}
                </span>
                <span className="text-sm text-foreground truncate">{c.name}</span>
              </div>
            ))}
            {companies.length > 4 && (
              <p className="text-xs text-muted-foreground pl-8">+{companies.length - 4} more</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}

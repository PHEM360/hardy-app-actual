import { useNavigate } from "react-router-dom";
import { Briefcase } from "lucide-react";
import { useCompanies } from "@/hooks/useCompanies";

export function CompaniesWidget() {
  const navigate = useNavigate();
  const { companies, loading } = useCompanies();

  return (
    <button
      className="w-full h-full p-3 flex flex-col text-left overflow-hidden"
      onClick={() => navigate("/companies")}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <Briefcase className="w-3.5 h-3.5 text-blue-500" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Companies</span>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : companies.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">No companies</p>
        </div>
      ) : (
        <>
          <div className="flex-shrink-0 mb-2">
            <p className="text-2xl font-bold font-display text-foreground leading-none">{companies.length}</p>
            <p className="text-[10px] text-muted-foreground">active {companies.length === 1 ? "company" : "companies"}</p>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden space-y-1">
            {companies.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ background: c.color || "#6366f1" }}
                />
                <span className="text-[10px] text-foreground truncate">{c.emoji ? `${c.emoji} ` : ""}{c.name}</span>
              </div>
            ))}
            {companies.length > 5 && (
              <p className="text-[9px] text-muted-foreground">+{companies.length - 5} more</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}

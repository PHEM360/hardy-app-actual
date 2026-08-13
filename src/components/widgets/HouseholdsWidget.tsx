import { useNavigate } from "react-router-dom";
import { Users, AlertCircle, ChevronRight } from "lucide-react";
import { useHouseholdItems } from "@/hooks/useHousehold";
import { WIDGET_ACCENT, accentGradient } from "@/lib/widgetAccents";

export function HouseholdsWidget() {
  const navigate = useNavigate();
  const { items, loading } = useHouseholdItems();
  const accent = WIDGET_ACCENT.households;

  const now = new Date();
  const in30 = new Date(); in30.setDate(in30.getDate() + 30);

  const renewingSoon = items.filter((i) => {
    if (!i.endDate) return false;
    const d = new Date(i.endDate);
    return d >= now && d <= in30;
  });

  return (
    <button
      className="w-full h-full p-3 pb-3.5 flex flex-col text-left overflow-y-auto group"
      onClick={() => navigate("/households")}
    >
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 mb-2 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(accent) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <Users className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Households</span>
        <ChevronRight className="w-3 h-3 text-white/50 ml-auto group-hover:text-white/80 group-hover:translate-x-0.5 transition-all" />
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          {/* Hero stat leads with what this widget is for: upcoming renewals */}
          <div className="mb-2.5 flex-shrink-0">
            <p className={`text-3xl font-bold font-display leading-none ${renewingSoon.length > 0 ? "text-destructive" : "text-foreground"}`}>
              {renewingSoon.length}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              renewing in 30 days &middot; {items.length} tracked
            </p>
          </div>

          <div className="flex-1 min-h-0 space-y-1.5">
            {renewingSoon.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-destructive flex-shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{item.type}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(item.endDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
            {renewingSoon.length === 0 && (
              <p className="text-sm text-muted-foreground">No renewals due soon</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}

import { useNavigate } from "react-router-dom";
import { Users, AlertCircle } from "lucide-react";
import { useHouseholdItems } from "@/hooks/useHousehold";

export function HouseholdsWidget() {
  const navigate = useNavigate();
  const { items, loading } = useHouseholdItems();

  const now = new Date();
  const in30 = new Date(); in30.setDate(in30.getDate() + 30);
  const in90 = new Date(); in90.setDate(in90.getDate() + 90);

  const renewingSoon = items.filter((i) => {
    if (!i.endDate) return false;
    const d = new Date(i.endDate);
    return d >= now && d <= in30;
  });

  const renewingIn90 = items.filter((i) => {
    if (!i.endDate) return false;
    const d = new Date(i.endDate);
    return d > in30 && d <= in90;
  });

  return (
    <button
      className="w-full h-full p-3 flex flex-col text-left overflow-hidden"
      onClick={() => navigate("/households")}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <Users className="w-3.5 h-3.5 text-orange-500" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Households</span>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1 mb-2 flex-shrink-0">
            <div className={`rounded-xl p-2 ${renewingSoon.length > 0 ? "bg-red-50" : "bg-muted/50"}`}>
              <p className={`text-lg font-bold font-display leading-none ${renewingSoon.length > 0 ? "text-red-600" : "text-foreground"}`}>
                {renewingSoon.length}
              </p>
              <p className="text-[10px] text-muted-foreground">due in 30d</p>
            </div>
            <div className="rounded-xl bg-muted/50 p-2">
              <p className="text-lg font-bold font-display text-foreground leading-none">{items.length}</p>
              <p className="text-[10px] text-muted-foreground">total items</p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden space-y-1">
            {renewingSoon.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3 text-red-500 flex-shrink-0" />
                <span className="text-[10px] text-foreground truncate flex-1">{item.type}</span>
                <span className="text-[9px] text-muted-foreground flex-shrink-0">
                  {new Date(item.endDate!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
            {renewingSoon.length === 0 && (
              <p className="text-[11px] text-muted-foreground">No renewals due soon 👍</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}

import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useHouseholdItems } from "@/hooks/useHousehold";
import { billsDueSoon, daysUntilDate } from "@/lib/todayInsights";
import { TdHead } from "./TdHead";

export function TdBillsWidget() {
  const navigate = useNavigate();
  const { items, loading } = useHouseholdItems();
  const due = billsDueSoon(items, new Date(), 31).slice(0, 6);

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead
        emoji="🧾"
        title="Bills & renewals"
        action={
          <button type="button" onClick={() => navigate("/households")} className="text-[11px] text-primary font-medium">
            All
          </button>
        }
      />
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && due.length === 0 && <p className="text-xs text-muted-foreground">No renewals in the next month.</p>}
        {due.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-background/60 border border-border/40 px-2.5 py-1.5">
            <p className="text-xs font-medium truncate">{item.provider || item.type}</p>
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {daysUntilDate(item.endDate!) === 0 ? "Today" : format(new Date(item.endDate!), "d MMM")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

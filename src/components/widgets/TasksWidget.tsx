import { useNavigate } from "react-router-dom";
import { CheckSquare } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";

const PRIORITY_COLOR: Record<string, string> = {
  critical: "bg-red-100 text-red-700",
  high:     "bg-orange-100 text-orange-700",
  medium:   "bg-yellow-100 text-yellow-700",
  low:      "bg-green-100 text-green-700",
};

export function TasksWidget() {
  const navigate = useNavigate();
  const { tasks, loading } = useTasks();

  const open   = tasks.filter((t) => t.status !== "done");
  const overdue = open.filter((t) => t.dueDate && new Date(t.dueDate) < new Date()).length;
  const critical = open.filter((t) => t.priority === "critical" || t.priority === "high").length;
  const top3 = open.slice(0, 3);

  return (
    <button
      className="w-full h-full p-3 flex flex-col text-left overflow-hidden"
      onClick={() => navigate("/tasks")}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-shrink-0">
        <CheckSquare className="w-3.5 h-3.5 text-violet-500" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tasks</span>
      </div>

      {loading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1 mb-2 flex-shrink-0">
            <div className="rounded-xl bg-muted/50 p-2">
              <p className="text-lg font-bold font-display text-foreground leading-none">{open.length}</p>
              <p className="text-[10px] text-muted-foreground">open</p>
            </div>
            <div className={`rounded-xl p-2 ${overdue > 0 ? "bg-red-50" : "bg-muted/50"}`}>
              <p className={`text-lg font-bold font-display leading-none ${overdue > 0 ? "text-red-600" : "text-foreground"}`}>{overdue}</p>
              <p className="text-[10px] text-muted-foreground">overdue</p>
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-hidden space-y-1">
            {top3.map((t) => (
              <div key={t.id} className="flex items-center gap-1.5">
                <span className={`text-[9px] px-1 py-0.5 rounded-full font-semibold flex-shrink-0 ${PRIORITY_COLOR[t.priority] ?? "bg-muted text-muted-foreground"}`}>
                  {t.priority?.[0]?.toUpperCase() ?? "?"}
                </span>
                <span className="text-[11px] text-foreground truncate">{t.title}</span>
              </div>
            ))}
            {open.length > 3 && (
              <p className="text-[10px] text-muted-foreground">+{open.length - 3} more</p>
            )}
          </div>
        </>
      )}
    </button>
  );
}

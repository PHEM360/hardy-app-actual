import { useTodayPage } from "@/hooks/useTodayPage";

const GLASSES = 8;

export function TdWaterWidget() {
  const { daily, saveDaily } = useTodayPage();
  const count = daily.waterCount;

  const tap = (i: number) => saveDaily({ waterCount: i < count ? i : i + 1 });

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-base">💧</span>
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Water</p>
        </div>
        <span className="text-xs font-bold text-blue-500">{count}/{GLASSES}</span>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: GLASSES }).map((_, i) => (
            <button key={i} onClick={() => tap(i)}
              className={`aspect-square rounded-xl border-2 flex items-center justify-center text-lg transition-all ${
                i < count
                  ? "bg-blue-100 border-blue-300 shadow-sm scale-105"
                  : "border-border/40 text-muted-foreground/30 hover:border-blue-200"
              }`}
            >
              {i < count ? "💧" : "○"}
            </button>
          ))}
        </div>

        {count > 0 && (
          <button onClick={() => saveDaily({ waterCount: count - 1 })}
            className="mt-2 text-[11px] text-muted-foreground text-center underline">
            undo last
          </button>
        )}
      </div>
    </div>
  );
}

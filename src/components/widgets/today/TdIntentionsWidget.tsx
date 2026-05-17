import { useTodayPage } from "@/hooks/useTodayPage";

const PLACEHOLDERS = ["I intend to…", "I also want to…", "One more thing…"];

export function TdIntentionsWidget() {
  const { daily, saveDaily } = useTodayPage();

  const update = (i: number, val: string) => {
    const next = [...daily.intentions] as [string, string, string];
    next[i] = val;
    saveDaily({ intentions: next });
  };

  return (
    <div className="h-full flex flex-col p-3">
      <div className="flex items-center gap-2 mb-3 flex-shrink-0">
        <span className="text-base">🌅</span>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Intentions</p>
      </div>
      <div className="flex-1 flex flex-col gap-2 min-h-0">
        {daily.intentions.map((val, i) => (
          <div key={i} className="flex items-start gap-2 flex-1 min-h-0">
            <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <textarea
              value={val}
              onChange={(e) => update(i, e.target.value)}
              placeholder={PLACEHOLDERS[i]}
              className="flex-1 text-xs text-foreground placeholder:text-muted-foreground/60 bg-transparent resize-none focus:outline-none leading-relaxed min-h-0"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

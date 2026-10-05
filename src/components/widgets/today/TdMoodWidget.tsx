import { useTodayPage } from "@/hooks/useTodayPage";

import { TdHead } from "./TdHead";
const MOODS = ["😩", "😕", "😐", "🙂", "😄"];
const ENERGY_LABELS = ["Low", "Tired", "OK", "Good", "Great"];

export function TdMoodWidget() {
  const { daily, saveDaily } = useTodayPage();

  return (
    <div className="h-full flex flex-col p-3">
      <TdHead emoji="😊" title="Mood" />

      <div className="flex-1 flex flex-col justify-center gap-4">
        {/* Mood row */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-1.5">How are you feeling?</p>
          <div className="flex justify-between">
            {MOODS.map((m) => (
              <button key={m} onClick={() => saveDaily({ mood: m === daily.mood ? "" : m })}
                className={`text-2xl p-1 rounded-xl transition-all ${m === daily.mood ? "bg-yellow-100 scale-125 shadow-sm" : "opacity-40 hover:opacity-70"}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Energy */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-muted-foreground">Energy</p>
            <p className="text-[10px] font-semibold text-foreground">{ENERGY_LABELS[daily.energy - 1]}</p>
          </div>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => saveDaily({ energy: n })}
                className={`flex-1 h-2 rounded-full transition-colors ${n <= daily.energy ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

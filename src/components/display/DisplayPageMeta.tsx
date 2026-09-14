import { Clock } from "lucide-react";
import {
  DURATION_CHOICES,
  durationLabel,
  type DisplayPage,
} from "@/lib/displayPages";

const FIELD = "h-10 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary";

export function DisplayPageMeta({
  page,
  onChange,
}: {
  page: DisplayPage;
  onChange: (next: DisplayPage) => void;
}) {
  const scheduled = !!page.activeFrom && !!page.activeTo && page.activeFrom !== page.activeTo;

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="page-name" className="text-xs font-semibold">Page name</label>
        <input
          id="page-name"
          value={page.name}
          onChange={(event) => onChange({ ...page, name: event.target.value })}
          className={`${FIELD} mt-1`}
        />
      </div>
      <div>
        <label htmlFor="page-duration" className="text-xs font-semibold">Show for</label>
        <select
          id="page-duration"
          value={DURATION_CHOICES.includes(page.durationSeconds) ? page.durationSeconds : 300}
          onChange={(event) => onChange({ ...page, durationSeconds: Number(event.target.value) })}
          className={`${FIELD} mt-1`}
        >
          {DURATION_CHOICES.map((seconds) => (
            <option key={seconds} value={seconds}>{durationLabel(seconds)}</option>
          ))}
        </select>
      </div>
      <div>
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Clock className="h-3.5 w-3.5" /> When it may show
        </p>
        <select
          value={scheduled ? "custom" : "all"}
          onChange={(event) => {
            if (event.target.value === "all") {
              const { activeFrom: _from, activeTo: _to, ...rest } = page;
              onChange(rest as DisplayPage);
            } else {
              onChange({ ...page, activeFrom: "21:00", activeTo: "06:00" });
            }
          }}
          aria-label="Page hours"
          className={`${FIELD} mt-1`}
        >
          <option value="all">All day</option>
          <option value="custom">Only between set hours</option>
        </select>
        {scheduled && (
          <>
            <div className="mt-2 flex items-center gap-2">
              <input
                type="time"
                value={page.activeFrom}
                onChange={(event) => onChange({ ...page, activeFrom: event.target.value })}
                aria-label="Show from"
                className={FIELD}
              />
              <span className="text-xs text-muted-foreground">to</span>
              <input
                type="time"
                value={page.activeTo}
                onChange={(event) => onChange({ ...page, activeTo: event.target.value })}
                aria-label="Show until"
                className={FIELD}
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">Overnight is fine — 21:00 to 06:00 runs through midnight.</p>
          </>
        )}
      </div>
    </div>
  );
}

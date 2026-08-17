import { Switch } from "@/components/ui/switch";
import { FINANCE_STATS, FINANCE_STAT_GROUPS, type FinanceStatId } from "@/lib/financeDisplay";

export default function DisplayStatsSettings({
  values,
  canEdit,
  onChange,
}: {
  values: Record<FinanceStatId, boolean>;
  canEdit: boolean;
  onChange: (next: Record<FinanceStatId, boolean>) => void;
}) {
  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-card border-2 border-border shadow-card mb-5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">What’s on screen</h3>
      <p className="text-xs text-muted-foreground mt-1 mb-4">
        Turn off anything you don’t want. The total tile sits at the top of the page; the rest appears on Summary.
      </p>
      <div className="space-y-5">
        {FINANCE_STAT_GROUPS.map((group) => (
          <div key={group}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-foreground/70 mb-2">{group}</p>
            <div className="rounded-2xl border border-border overflow-hidden divide-y divide-border">
              {FINANCE_STATS.filter((stat) => stat.group === group).map((stat) => (
                <label
                  key={stat.id}
                  className="flex items-center justify-between gap-3 px-3 py-2.5 bg-background hover:bg-muted/40"
                >
                  <span className="text-sm text-foreground">{stat.label}</span>
                  <Switch
                    checked={values[stat.id]}
                    disabled={!canEdit}
                    onCheckedChange={(checked) => onChange({ ...values, [stat.id]: checked })}
                  />
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

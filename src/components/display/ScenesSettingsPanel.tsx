import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { WIDGET_LABELS, WIDGET_ICONS } from "@/hooks/useDashboardLayout";
import type { WidgetType } from "@/hooks/useDashboardLayout";
import type { CalendarSceneSettings, OverviewSceneSettings, SceneRotationSettings } from "@/hooks/useDeviceSettings";
import { KIOSK_WIDGET_TYPES } from "@/lib/kioskWidgets";

export function ScenesSettingsPanel({
  hasHousehold,
  calendarSettings,
  onChangeCalendar,
  overviewSettings,
  onChangeOverview,
  sceneSettings,
  onChangeScenes,
  activeSceneCount,
}: {
  hasHousehold: boolean;
  calendarSettings: CalendarSceneSettings;
  onChangeCalendar: (patch: Partial<CalendarSceneSettings>) => void;
  overviewSettings: OverviewSceneSettings;
  onChangeOverview: (patch: Partial<OverviewSceneSettings>) => void;
  sceneSettings: SceneRotationSettings;
  onChangeScenes: (patch: Partial<SceneRotationSettings>) => void;
  activeSceneCount: number;
}) {
  const toggleWidget = (type: WidgetType) => {
    const has = overviewSettings.widgets.includes(type);
    onChangeOverview({
      widgets: has ? overviewSettings.widgets.filter((w) => w !== type) : [...overviewSettings.widgets, type],
    });
  };

  return (
    <div className="space-y-5">
      <p className="text-xs text-muted-foreground">
        The clock is always available. Turning on more scenes below adds them into rotation automatically —
        including the photo frame from the Photos tab.
      </p>

      {!hasHousehold && (
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
          This display isn't linked to a household, so the calendar and overview scenes aren't available yet.
        </p>
      )}

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">Household calendar</p>
          <p className="text-[11px] text-muted-foreground">Upcoming events across everyone in the household</p>
        </div>
        <Switch
          checked={calendarSettings.enabled}
          disabled={!hasHousehold}
          onCheckedChange={(v) => onChangeCalendar({ enabled: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm">Household overview</p>
          <p className="text-[11px] text-muted-foreground">A grid of the widgets picked below</p>
        </div>
        <Switch
          checked={overviewSettings.enabled}
          disabled={!hasHousehold}
          onCheckedChange={(v) => onChangeOverview({ enabled: v })}
        />
      </div>

      {overviewSettings.enabled && (
        <div className="space-y-2 pl-1">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Overview widgets</Label>
          <div className="grid grid-cols-2 gap-2">
            {KIOSK_WIDGET_TYPES.map((type) => (
              <button
                key={type}
                onClick={() => toggleWidget(type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-left transition-colors ${
                  overviewSettings.widgets.includes(type)
                    ? "bg-primary/10 border border-primary/30 text-primary"
                    : "bg-muted/50 border border-transparent text-muted-foreground"
                }`}
              >
                <span>{WIDGET_ICONS[type]}</span>
                {WIDGET_LABELS[type]}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeSceneCount > 1 && (
        <div className="space-y-2 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <span className="text-sm">Rotate every</span>
            <span className="text-xs text-muted-foreground">{sceneSettings.rotateSeconds}s</span>
          </div>
          <Slider
            value={[sceneSettings.rotateSeconds]}
            min={10}
            max={120}
            step={10}
            onValueChange={([v]) => onChangeScenes({ rotateSeconds: v })}
          />
        </div>
      )}
    </div>
  );
}

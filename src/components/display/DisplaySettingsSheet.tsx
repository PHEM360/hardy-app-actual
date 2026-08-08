import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import type {
  Alarm,
  CalendarSceneSettings,
  ClockSettings,
  ClockSize,
  ClockStyle,
  OverviewSceneSettings,
  PhotoFrameSettings,
  SceneRotationSettings,
} from "@/hooks/useDeviceSettings";
import type { HouseholdPhoto } from "@/hooks/useHouseholdPhotos";
import { AlarmsSettingsPanel } from "@/components/display/AlarmsSettingsPanel";
import { PhotoFrameSettingsPanel } from "@/components/display/PhotoFrameSettingsPanel";
import { ScenesSettingsPanel } from "@/components/display/ScenesSettingsPanel";

const ACCENTS = ["#7dd3fc", "#fca5a5", "#86efac", "#fde047", "#c4b5fd", "#f9a8d4", "#ffffff"];

export function DisplaySettingsSheet({
  open,
  onOpenChange,
  deviceLabel,
  onRename,
  onForgetDevice,
  clockSettings,
  onChangeClock,
  alarms,
  onAddAlarm,
  onUpdateAlarm,
  onDeleteAlarm,
  photoFrameSettings,
  onChangePhotoFrame,
  photos,
  photosLoading,
  onAddPhotos,
  onDeletePhoto,
  hasHousehold,
  calendarSettings,
  onChangeCalendar,
  overviewSettings,
  onChangeOverview,
  sceneSettings,
  onChangeScenes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deviceLabel: string;
  onRename: (label: string) => void;
  onForgetDevice: () => void;
  clockSettings: ClockSettings;
  onChangeClock: (patch: Partial<ClockSettings>) => void;
  alarms: Alarm[];
  onAddAlarm: (alarm: Omit<Alarm, "id">) => void;
  onUpdateAlarm: (id: string, patch: Partial<Alarm>) => void;
  onDeleteAlarm: (id: string) => void;
  photoFrameSettings: PhotoFrameSettings;
  onChangePhotoFrame: (patch: Partial<PhotoFrameSettings>) => void;
  photos: HouseholdPhoto[];
  photosLoading: boolean;
  onAddPhotos: (files: File[]) => Promise<void>;
  onDeletePhoto: (photo: HouseholdPhoto) => void;
  hasHousehold: boolean;
  calendarSettings: CalendarSceneSettings;
  onChangeCalendar: (patch: Partial<CalendarSceneSettings>) => void;
  overviewSettings: OverviewSceneSettings;
  onChangeOverview: (patch: Partial<OverviewSceneSettings>) => void;
  sceneSettings: SceneRotationSettings;
  onChangeScenes: (patch: Partial<SceneRotationSettings>) => void;
}) {
  const activeSceneCount =
    1 + // clock, always on
    (photoFrameSettings.enabled && photos.length > 0 ? 1 : 0) +
    (calendarSettings.enabled && hasHousehold ? 1 : 0) +
    (overviewSettings.enabled && hasHousehold ? 1 : 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-sm overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Display settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-2 mt-6 mb-5">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">This display</Label>
          <input
            value={deviceLabel}
            onChange={(e) => onRename(e.target.value)}
            className="w-full h-11 rounded-xl bg-muted/50 border border-border px-3 text-sm"
            placeholder="e.g. Kitchen Display"
          />
        </div>

        <Tabs defaultValue="clock">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="clock">Clock</TabsTrigger>
            <TabsTrigger value="alarms">Alarms</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
            <TabsTrigger value="scenes">Scenes</TabsTrigger>
          </TabsList>

          <TabsContent value="clock" className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-sm">Style</span>
              <Select value={clockSettings.style} onValueChange={(v: ClockStyle) => onChangeClock({ style: v })}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="digital">Digital</SelectItem>
                  <SelectItem value="analog">Analog</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Size</span>
              <Select value={clockSettings.size} onValueChange={(v: ClockSize) => onChangeClock({ size: v })}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xlarge">Extra large</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">24-hour time</span>
              <Switch checked={clockSettings.format24h} onCheckedChange={(v) => onChangeClock({ format24h: v })} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Show seconds</span>
              <Switch checked={clockSettings.showSeconds} onCheckedChange={(v) => onChangeClock({ showSeconds: v })} />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm">Show date</span>
              <Switch checked={clockSettings.showDate} onCheckedChange={(v) => onChangeClock({ showDate: v })} />
            </div>

            <div className="space-y-2">
              <span className="text-sm">Accent colour</span>
              <div className="flex gap-2 flex-wrap">
                {ACCENTS.map((c) => (
                  <button
                    key={c}
                    onClick={() => onChangeClock({ accentColor: c })}
                    className="w-8 h-8 rounded-full border-2 transition-transform"
                    style={{
                      backgroundColor: c,
                      borderColor: clockSettings.accentColor === c ? "hsl(var(--primary))" : "transparent",
                      transform: clockSettings.accentColor === c ? "scale(1.1)" : "scale(1)",
                    }}
                    aria-label={c}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="alarms" className="pt-2">
            <AlarmsSettingsPanel alarms={alarms} onAdd={onAddAlarm} onUpdate={onUpdateAlarm} onDelete={onDeleteAlarm} />
          </TabsContent>

          <TabsContent value="photos" className="pt-2">
            <PhotoFrameSettingsPanel
              settings={photoFrameSettings}
              onChange={onChangePhotoFrame}
              photos={photos}
              photosLoading={photosLoading}
              onAddPhotos={onAddPhotos}
              onDeletePhoto={onDeletePhoto}
              hasHousehold={hasHousehold}
            />
          </TabsContent>

          <TabsContent value="scenes" className="pt-2">
            <ScenesSettingsPanel
              hasHousehold={hasHousehold}
              calendarSettings={calendarSettings}
              onChangeCalendar={onChangeCalendar}
              overviewSettings={overviewSettings}
              onChangeOverview={onChangeOverview}
              sceneSettings={sceneSettings}
              onChangeScenes={onChangeScenes}
              activeSceneCount={activeSceneCount}
            />
          </TabsContent>
        </Tabs>

        <div className="pt-5 mt-5 border-t border-border">
          <Button variant="outline" className="w-full rounded-xl text-destructive" onClick={onForgetDevice}>
            Sign out this display
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

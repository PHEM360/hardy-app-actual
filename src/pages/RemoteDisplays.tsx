import { useEffect, useMemo, useRef, useState } from "react";
import {
  Cast, ChevronLeft, ChevronRight, Copy, ExternalLink, ImagePlus, LayoutGrid, MonitorSmartphone,
  Moon, Palette, Plus, RotateCcw, Sparkles, Sunrise, Trash2, Wifi, WifiOff, X, Zap,
} from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/auth/AuthContext";
import { useMyDevices } from "@/hooks/useMyDevices";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import {
  DEFAULT_DISPLAY_PAGES, PAGE_PRESETS, SCREEN_TEMPLATES,
  applyLookToPages, applyPageLayout, cloneDisplayPage, isEmptyDisplayWidget, isPageActiveAt,
  pageScheduleLabel, type DisplayPage, type DisplayWidgetLayout,
} from "@/lib/displayPages";
import { useDisplayOwnerPhotos } from "@/hooks/useDisplayOwnerPhotos";
import { useRemoteDisplayPhotos } from "@/hooks/useRemoteDisplayPhotos";
import { useTasks } from "@/hooks/useTasks";
import { useCalendar } from "@/hooks/useCalendar";
import { useBirthdays } from "@/hooks/useBirthdays";
import { useFamilyMessages } from "@/hooks/useFamilyMessages";
import { RemoteLayoutEditor } from "@/components/display/RemoteLayoutEditor";
import { DisplayPageRenderer } from "@/components/display/DisplayPageRenderer";
import { AlarmsSettingsPanel } from "@/components/display/AlarmsSettingsPanel";
import { NightModeSettingsPanel } from "@/components/display/NightModeSettingsPanel";
import { SunriseLightsPanel } from "@/components/display/SunriseLightsPanel";
import { DisplayPhotoLibrary } from "@/components/display/DisplayPhotoLibrary";
import { DisplayWidgetSettings } from "@/components/display/DisplayWidgetSettings";
import { DisplayAppearance } from "@/components/display/DisplayAppearance";
import { DisplayPageMeta } from "@/components/display/DisplayPageMeta";
import { DisplayEmptyState, DisplayPairingGuide, DISPLAY_RECEIVER_PATH } from "@/components/display/DisplayPairingGuide";
import { nextNightEndIso, overrideUntilForAlarm } from "@/lib/displayNightMode";
import { describeDisplayStatus } from "@/lib/deviceStatus";
import { toast } from "sonner";

type StudioSection = "look" | "layout" | "screen" | "photos" | "lights";
type PreviewShape = "tv" | "tablet" | "portrait";

const ACCENT = "hsl(198,60%,46%)";
const SECTIONS: { id: StudioSection; label: string; icon: typeof Palette }[] = [
  { id: "look", label: "Look", icon: Palette },
  { id: "layout", label: "Layout", icon: LayoutGrid },
  { id: "screen", label: "Screen", icon: MonitorSmartphone },
  { id: "photos", label: "Photos", icon: ImagePlus },
  { id: "lights", label: "Lights", icon: Sunrise },
];

const PREVIEW_SHAPES: { id: PreviewShape; label: string; className: string }[] = [
  { id: "tv", label: "TV", className: "aspect-video" },
  { id: "tablet", label: "Tablet", className: "aspect-[4/3]" },
  { id: "portrait", label: "Portrait", className: "aspect-[9/16] max-h-[28rem] mx-auto" },
];

function railButtonClass(active: boolean) {
  return `flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-semibold transition ${
    active
      ? "bg-gradient-primary text-primary-foreground shadow-sm"
      : "hover:bg-[color-mix(in_srgb,hsl(198,60%,46%)_12%,transparent)]"
  }`;
}

export default function RemoteDisplays() {
  const { dataUid } = useAuth();
  const { devices: allDevices, loading, renameDevice, forgetDevice } = useMyDevices();
  const devices = useMemo(() => allDevices.filter((item) => item.deviceType !== "light"), [allDevices]);
  const lights = useMemo(() => allDevices.filter((item) => item.deviceType === "light"), [allDevices]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [editorPages, setEditorPages] = useState<DisplayPage[]>([]);
  const [section, setSection] = useState<StudioSection>("look");
  const [previewShape, setPreviewShape] = useState<PreviewShape>("tv");
  const [pairOpen, setPairOpen] = useState(false);
  const loadedDeviceRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPagesRef = useRef<DisplayPage[] | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const {
    device, loading: deviceLoading, updatePages, addAlarm, updateAlarm, deleteAlarm,
    updateNightMode, updateControl, copyLookFrom,
  } = useDeviceSettings(selectedDeviceId);
  const photoOwnerId = device?.uid || dataUid;
  const { photos: previewPhotos, albums: previewAlbums, loading: photosLoading } = useDisplayOwnerPhotos(photoOwnerId);
  const { photos: quickPhotos, addPhotos, addLinkedPhotos, deletePhoto } = useRemoteDisplayPhotos(photoOwnerId);
  const { tasks } = useTasks(dataUid || undefined);
  const { events: calendarEvents } = useCalendar(dataUid || undefined);
  const { birthdays } = useBirthdays(device?.householdId ?? null);
  const { messages: familyMessages } = useFamilyMessages(device?.householdId ?? null);
  const calendarCategories = useMemo(
    () => [...new Set(calendarEvents.map((event) => event.category).filter(Boolean))].sort(),
    [calendarEvents],
  );
  const otherDisplays = useMemo(
    () => devices.filter((item) => item.id !== selectedDeviceId),
    [devices, selectedDeviceId],
  );

  useEffect(() => {
    if (!selectedDeviceId && devices[0]) setSelectedDeviceId(devices[0].id);
    if (selectedDeviceId && !devices.some((item) => item.id === selectedDeviceId)) {
      setSelectedDeviceId(devices[0]?.id || null);
    }
  }, [devices, selectedDeviceId]);

  useEffect(() => {
    if (!device || loadedDeviceRef.current === device.id) return;
    loadedDeviceRef.current = device.id;
    setEditorPages(device.settings.pages);
    setSelectedPageId(device.settings.pages[0]?.id || null);
    setSelectedWidgetId(null);
    setSection("look");
  }, [device]);

  useEffect(() => {
    if (!selectedPageId || !editorPages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(editorPages[0]?.id || null);
      setSelectedWidgetId(null);
    }
  }, [editorPages, selectedPageId]);

  useEffect(() => {
    const flush = () => {
      if (!pendingPagesRef.current) return;
      const pending = pendingPagesRef.current;
      pendingPagesRef.current = null;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      void updatePages(pending).catch((error) => {
        toast.error(error instanceof Error ? error.message : "Could not update this display");
      });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [updatePages]);

  useEffect(() => {
    setDeviceName(device?.label || "");
  }, [device?.label]);

  useEffect(() => {
    if (selectedWidgetId) {
      setSection("layout");
      settingsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedWidgetId]);

  const pages = editorPages.length > 0 ? editorPages : device?.settings.pages || DEFAULT_DISPLAY_PAGES;
  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages[0];
  const selectedWidget = selectedPage?.widgets.find((widget) =>
    widget.id === selectedWidgetId && !isEmptyDisplayWidget(widget),
  ) || null;
  const linked = devices.find((item) => item.id === selectedDeviceId);
  const status = describeDisplayStatus(linked?.lastSeenAt);

  const savePages = (next: DisplayPage[]) => {
    const prepared = next.map(applyPageLayout);
    setEditorPages(prepared);
    pendingPagesRef.current = prepared;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const pending = pendingPagesRef.current;
      pendingPagesRef.current = null;
      saveTimerRef.current = null;
      if (!pending) return;
      void updatePages(pending).catch((error) => {
        toast.error(error instanceof Error ? error.message : "Could not update this display");
      });
    }, 150);
  };

  const updatePage = (nextPage: DisplayPage) => {
    savePages(pages.map((page) => page.id === nextPage.id ? nextPage : page));
  };

  const updateWidget = (patch: Partial<DisplayWidgetLayout>) => {
    if (!selectedPage || !selectedWidget) return;
    updatePage({
      ...selectedPage,
      widgets: selectedPage.widgets.map((widget) => widget.id === selectedWidget.id ? { ...widget, ...patch } : widget),
    });
  };

  const addPreset = (presetId: string) => {
    const preset = PAGE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    const page = applyPageLayout(preset.build());
    savePages([...pages, page]);
    setSelectedPageId(page.id);
    setSelectedWidgetId(page.widgets[0]?.id || null);
    setShowPresets(false);
    toast.success(`${preset.name} added to this screen`);
  };

  const applyTemplate = (templateId: string) => {
    const template = SCREEN_TEMPLATES.find((item) => item.id === templateId);
    if (!template) return;
    if (pages.length > 0 && !window.confirm(`Replace the pages on this screen with the ${template.name} preset?`)) return;
    const next = template.build();
    savePages(next);
    setSelectedPageId(next[0]?.id || null);
    setSelectedWidgetId(null);
    toast.success(`${template.name} look applied`);
  };

  const duplicatePage = () => {
    if (!selectedPage) return;
    const clone = cloneDisplayPage(selectedPage);
    clone.name = `${selectedPage.name} copy`;
    const index = pages.findIndex((page) => page.id === selectedPage.id);
    const next = [...pages];
    next.splice(index + 1, 0, clone);
    savePages(next);
    setSelectedPageId(clone.id);
    toast.success("Page duplicated");
  };

  const movePage = (direction: -1 | 1) => {
    if (!selectedPage) return;
    const index = pages.findIndex((page) => page.id === selectedPage.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    savePages(next);
  };

  const findPlace = async () => {
    const query = placeQuery.trim();
    if (!query) return;
    try {
      const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1`);
      const data = await response.json();
      const hit = data?.results?.[0];
      if (!hit) {
        toast.error(`Could not find ${query}`);
        return;
      }
      updateWidget({
        weatherLatitude: Number(hit.latitude),
        weatherLongitude: Number(hit.longitude),
        weatherPlace: hit.name as string,
      });
      toast.success(`Weather set to ${hit.name}`);
    } catch {
      toast.error("Could not look that place up");
    }
  };

  const selectDevice = (id: string) => {
    if (id === selectedDeviceId) return;
    if (saveTimerRef.current || pendingPagesRef.current) {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      const pending = pendingPagesRef.current || editorPages;
      pendingPagesRef.current = null;
      void updatePages(pending);
    }
    loadedDeviceRef.current = null;
    setEditorPages([]);
    setSelectedPageId(null);
    setSelectedWidgetId(null);
    setSelectedDeviceId(id);
  };

  const copyFrom = async (sourceId: string) => {
    if (!sourceId) return;
    try {
      const copied = await copyLookFrom(sourceId);
      setEditorPages(copied);
      setSelectedPageId(copied[0]?.id || null);
      setSelectedWidgetId(null);
      toast.success("Look copied onto this screen");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not copy that screen");
    }
  };

  const previewClass = PREVIEW_SHAPES.find((item) => item.id === previewShape)?.className || "aspect-video";

  return (
    <FeaturePageShell
      title="Remote Displays"
      subtitle="Build always-on screens for this account"
      icon={<MonitorSmartphone className="h-5 w-5" />}
      action={
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <a href={DISPLAY_RECEIVER_PATH} target="_blank" rel="noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open receiver
          </a>
        </Button>
      }
    >
      <div className="grid min-w-0 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="h-fit space-y-3">
          <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-card">
            <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Connected screens</p>
            <div className="mt-2 space-y-2">
              {loading ? (
                <p className="px-2 py-6 text-center text-xs text-muted-foreground">Loading displays…</p>
              ) : devices.length === 0 ? (
                <div
                  className="rounded-xl p-4 text-center"
                  style={{ background: "color-mix(in srgb, hsl(198,60%,46%) 12%, hsl(var(--card)))" }}
                >
                  <MonitorSmartphone className="mx-auto h-7 w-7 text-primary" />
                  <p className="mt-2 text-xs font-semibold">No screens linked</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Use the steps on the right to add one.</p>
                </div>
              ) : devices.map((item) => {
                const itemStatus = describeDisplayStatus(item.lastSeenAt);
                const active = selectedDeviceId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectDevice(item.id)}
                    className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                      active ? "border-primary shadow-sm" : "border-border/50 hover:border-primary/35"
                    }`}
                    style={{
                      background: active
                        ? `color-mix(in srgb, ${ACCENT} 16%, hsl(var(--card)))`
                        : `color-mix(in srgb, ${ACCENT} 8%, hsl(var(--card)))`,
                      borderLeftWidth: 4,
                      borderLeftColor: itemStatus.online ? "hsl(152,55%,40%)" : ACCENT,
                    }}
                  >
                    <span className="flex items-center gap-2">
                      {itemStatus.online
                        ? <Wifi className="h-4 w-4 text-emerald-600" />
                        : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold">{item.label}</span>
                    </span>
                    <span className={`mt-1 block pl-6 text-[10px] font-medium ${
                      itemStatus.tone === "ok" ? "text-emerald-700" : itemStatus.tone === "warn" ? "text-amber-700" : "text-muted-foreground"
                    }`}>
                      {itemStatus.label}
                    </span>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setPairOpen(true)}
              className="mt-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-primary text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-3.5 w-3.5" /> Link a screen
            </button>
          </div>

          {selectedDeviceId && (
            <nav className="rounded-2xl border border-border/60 bg-card p-3 shadow-card" aria-label="Customise this screen">
              <p className="px-1 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Customise</p>
              {SECTIONS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSection(item.id)}
                    className={railButtonClass(section === item.id)}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          )}
        </aside>

        <section className="min-w-0 space-y-4">
          {!selectedDeviceId ? (
            <DisplayEmptyState />
          ) : deviceLoading ? (
            <div className="rounded-2xl bg-card py-16 text-center text-sm text-muted-foreground shadow-card">Loading display settings…</div>
          ) : !device ? (
            <div className="rounded-2xl border border-border/60 bg-card px-6 py-16 text-center shadow-card">
              <WifiOff className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-3 font-display text-lg font-bold">This screen isn't available</p>
              <p className="mt-1 text-sm text-muted-foreground">It may have just been disconnected. Pick another screen, or link it again.</p>
            </div>
          ) : !selectedPage ? (
            <div className="rounded-2xl bg-card py-16 text-center text-sm text-muted-foreground shadow-card">This screen has no pages yet — add one below.</div>
          ) : (
            <>
              <div
                className="overflow-hidden rounded-2xl border border-border/60 shadow-card"
                style={{ background: `color-mix(in srgb, ${ACCENT} 12%, hsl(var(--card)))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}
              >
                <div className="flex flex-wrap items-center gap-2 p-3">
                  <input
                    value={deviceName}
                    onChange={(event) => setDeviceName(event.target.value)}
                    onBlur={() => {
                      if (deviceName.trim() && deviceName.trim() !== device.label) void renameDevice(device.id, deviceName);
                    }}
                    className="h-10 max-w-xs flex-1 rounded-xl border border-border bg-card px-3 text-sm font-semibold outline-none focus:border-primary"
                    aria-label="Display name"
                  />
                  <span className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1 text-[11px] font-bold ${
                    status.online
                      ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-800"
                      : status.tone === "warn"
                        ? "border-amber-500/30 bg-amber-500/15 text-amber-800"
                        : "border-border bg-card text-muted-foreground"
                  }`}>
                    {status.online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                    {status.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(`Disconnect ${device.label}?`)) void forgetDevice(device.id); }}
                    className="ml-auto flex h-10 items-center gap-1.5 rounded-xl border border-red-300/60 bg-card px-3 text-xs font-semibold text-red-700 transition hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Disconnect
                  </button>
                </div>
                <p className="px-3 pb-3 text-[11px] leading-relaxed text-muted-foreground">{status.detail}</p>
              </div>

              {section === "look" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {pages.map((page) => {
                      const active = selectedPage.id === page.id;
                      return (
                        <button
                          key={page.id}
                          type="button"
                          onClick={() => { setSelectedPageId(page.id); setSelectedWidgetId(null); }}
                          className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                            active
                              ? "bg-gradient-primary text-primary-foreground shadow-sm"
                              : "border border-border bg-card hover:border-primary/40"
                          }`}
                        >
                          {page.name}
                          <span className={`ml-1.5 text-[10px] font-medium ${active ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                            {pageScheduleLabel(page)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 px-3 py-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Live preview</p>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {PREVIEW_SHAPES.map((shape) => (
                          <button
                            key={shape.id}
                            type="button"
                            onClick={() => setPreviewShape(shape.id)}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold ${
                              previewShape === shape.id
                                ? "bg-gradient-primary text-primary-foreground"
                                : "border border-border bg-background text-muted-foreground"
                            }`}
                          >
                            {shape.label}
                          </button>
                        ))}
                        {isPageActiveAt(selectedPage, new Date()) ? (
                          <span className="rounded-lg bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">On screen now</span>
                        ) : (
                          <span className="rounded-lg bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Outside its hours</span>
                        )}
                      </div>
                    </div>
                    <div className="bg-zinc-950 p-3">
                      <div className={`relative mx-auto w-full overflow-hidden rounded-xl border border-white/10 ${previewClass}`}>
                        <DisplayPageRenderer
                          page={selectedPage}
                          photos={previewPhotos}
                          photosLoading={photosLoading}
                          calendarEvents={calendarEvents}
                          tasks={tasks}
                          birthdays={birthdays}
                          familyMessages={familyMessages}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-card px-3 py-2.5 shadow-card">
                    {device.settings.control.forcedPageId ? (
                      <>
                        <span className="flex items-center gap-1.5 rounded-lg bg-sky-500/15 px-2.5 py-1 text-[11px] font-bold text-sky-800">
                          <Cast className="h-3.5 w-3.5" />
                          {device.settings.pages.find((page) => page.id === device.settings.control.forcedPageId)?.name || "A page"} is pinned to the screen
                        </span>
                        <button
                          type="button"
                          onClick={() => void updateControl({ forcedPageId: null, forcedUntil: null })}
                          className="flex h-8 items-center gap-1.5 rounded-xl border border-border px-3 text-xs font-semibold transition hover:border-primary/40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Resume automatic rotation
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void updateControl({
                          forcedPageId: selectedPage.id,
                          forcedUntil: Date.now() + 2 * 60 * 60 * 1000,
                        })}
                        className="flex h-8 items-center gap-1.5 rounded-xl bg-gradient-primary px-3 text-xs font-semibold text-primary-foreground"
                      >
                        <Cast className="h-3.5 w-3.5" /> Show “{selectedPage.name}” on screen now
                      </button>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Overrides rotation and schedule on the physical screen for up to 2 hours.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">This page’s look</p>
                    <DisplayAppearance
                      page={selectedPage}
                      pageCount={pages.length}
                      onChange={updatePage}
                      onApplyLookToAll={() => {
                        savePages(applyLookToPages(pages, {
                          theme: selectedPage.theme,
                          background: selectedPage.background,
                          backdrop: selectedPage.backdrop || "none",
                        }));
                        toast.success("Look applied to every page");
                      }}
                    />
                  </div>
                </div>
              )}

              {section === "layout" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-card">
                    <div className="flex flex-wrap gap-2">
                      {pages.map((page) => {
                        const active = selectedPage.id === page.id;
                        return (
                          <button
                            key={page.id}
                            type="button"
                            onClick={() => { setSelectedPageId(page.id); setSelectedWidgetId(null); }}
                            className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                              active
                                ? "bg-gradient-primary text-primary-foreground shadow-sm"
                                : "border border-border bg-background hover:border-primary/40"
                            }`}
                          >
                            {page.name}
                            <span className={`ml-1.5 text-[10px] font-medium ${active ? "text-primary-foreground/75" : "text-muted-foreground"}`}>
                              {pageScheduleLabel(page)}
                            </span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setShowPresets((value) => !value)}
                        className="flex h-9 items-center gap-1 rounded-xl border border-dashed border-primary/40 px-3 text-xs font-semibold text-primary"
                      >
                        {showPresets ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Add page
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {pages.length === 1 ? "One page, shown all the time" : `Rotates through ${pages.length} pages`}
                    </p>
                    {showPresets && (
                      <div className="mt-3 rounded-2xl border border-primary/20 p-3" style={{ background: `color-mix(in srgb, ${ACCENT} 10%, hsl(var(--card)))` }}>
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-bold">
                          <Sparkles className="h-3.5 w-3.5 text-primary" /> Start from a ready-made page
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                          {PAGE_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => addPreset(preset.id)}
                              className="rounded-xl border border-border bg-card p-3 text-left transition hover:border-primary/60"
                            >
                              <p className="text-xs font-bold">{preset.name}</p>
                              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{preset.description}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="min-w-0 space-y-4">
                      <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-card">
                        <RemoteLayoutEditor
                          page={selectedPage}
                          selectedWidgetId={selectedWidgetId}
                          onSelectWidget={setSelectedWidgetId}
                          onChange={updatePage}
                        />
                      </div>
                      {pages.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => movePage(-1)} className="flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-semibold hover:border-primary/40">
                            <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Move earlier
                          </button>
                          <button type="button" onClick={() => movePage(1)} className="flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-semibold hover:border-primary/40">
                            Move later <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </button>
                          <button type="button" onClick={duplicatePage} className="flex h-9 items-center rounded-xl border border-border bg-card px-3 text-xs font-semibold hover:border-primary/40">
                            <Copy className="mr-1 h-3.5 w-3.5" /> Duplicate page
                          </button>
                          {pages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => {
                                const next = pages.filter((page) => page.id !== selectedPage.id);
                                savePages(next);
                                setSelectedPageId(next[0]?.id || null);
                              }}
                              className="ml-auto flex h-9 items-center rounded-xl px-3 text-xs font-semibold text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete page
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div ref={settingsRef} className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
                      <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Page settings</p>
                        <DisplayPageMeta page={selectedPage} onChange={updatePage} />
                      </div>
                      {selectedWidget ? (
                        <DisplayWidgetSettings
                          widget={selectedWidget}
                          albums={previewAlbums}
                          photos={previewPhotos}
                          tasks={tasks}
                          calendarCategories={calendarCategories}
                          placeQuery={placeQuery}
                          onPlaceQuery={setPlaceQuery}
                          onFindPlace={() => void findPlace()}
                          onChange={updateWidget}
                          onClose={() => setSelectedWidgetId(null)}
                        />
                      ) : (
                        <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                          Pick a widget’s <span className="font-semibold text-foreground">Settings</span> button to change what it shows.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {section === "screen" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                    <h2 className="font-display text-base font-bold">Ready-made screen</h2>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">Replace every page with a sensible starting point. You can still edit afterwards.</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {SCREEN_TEMPLATES.map((template) => (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => applyTemplate(template.id)}
                          className="rounded-2xl border border-border bg-background p-3 text-left transition hover:border-primary/50"
                        >
                          <p className="text-sm font-bold">{template.name}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{template.description}</p>
                        </button>
                      ))}
                    </div>
                    {otherDisplays.length > 0 && (
                      <label className="mt-3 block text-xs font-semibold">
                        Copy look from another screen
                        <select
                          aria-label="Copy look from another screen"
                          defaultValue=""
                          onChange={(event) => {
                            const value = event.target.value;
                            event.target.value = "";
                            if (value) void copyFrom(value);
                          }}
                          className="mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
                        >
                          <option value="">Choose a screen…</option>
                          {otherDisplays.map((item) => (
                            <option key={item.id} value={item.id}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        <div>
                          <h2 className="font-display text-base font-bold">Keep the screen awake</h2>
                          <p className="text-[11px] text-muted-foreground">
                            {device.settings.control.keepAwake
                              ? "This screen is stopped from sleeping or switching off, 24/7."
                              : "This screen can sleep or switch off on its own, like a normal device."}
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={device.settings.control.keepAwake}
                        onCheckedChange={(value) => void updateControl({ keepAwake: value })}
                        aria-label="Keep the screen awake"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                    <div className="mb-3 flex items-center gap-2">
                      <Moon className="h-4 w-4 text-sky-500" />
                      <div>
                        <h2 className="font-display text-base font-bold">Night mode</h2>
                        <p className="text-[11px] text-muted-foreground">Show a clock or a blank screen at bedtime, on a schedule or with one tap.</p>
                      </div>
                    </div>
                    <NightModeSettingsPanel
                      nightMode={device.settings.nightMode}
                      alarms={device.settings.alarms}
                      onChange={(patch) => void updateNightMode(patch)}
                      onActivate={() => void updateNightMode({
                        override: "on",
                        overrideUntil: nextNightEndIso(device.settings.nightMode, new Date()),
                      })}
                      onClear={() => void updateNightMode({
                        override: "off",
                        overrideUntil: nextNightEndIso(device.settings.nightMode, new Date()),
                      })}
                    />
                  </div>

                  <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                    <div className="mb-3 flex items-center gap-2">
                      <Sunrise className="h-4 w-4 text-amber-500" />
                      <div>
                        <h2 className="font-display text-base font-bold">Alarm clock</h2>
                        <p className="text-[11px] text-muted-foreground">Sunrise mode gradually warms and brightens the display before the alarm.</p>
                      </div>
                    </div>
                    <AlarmsSettingsPanel
                      alarms={device.settings.alarms}
                      lights={lights}
                      onAdd={(alarm) => {
                        void addAlarm(alarm);
                        if (device.settings.nightMode.withAlarms && alarm.enabled) {
                          void updateNightMode({
                            override: "on",
                            overrideUntil: overrideUntilForAlarm(alarm.time, new Date()),
                          });
                        }
                      }}
                      onUpdate={(id, patch) => {
                        void updateAlarm(id, patch);
                        if (patch.enabled === true && device.settings.nightMode.withAlarms) {
                          const time = patch.time || device.settings.alarms.find((item) => item.id === id)?.time;
                          if (time) {
                            void updateNightMode({
                              override: "on",
                              overrideUntil: overrideUntilForAlarm(time, new Date()),
                            });
                          }
                        }
                      }}
                      onDelete={deleteAlarm}
                    />
                  </div>
                </div>
              )}

              {section === "photos" && (
                <DisplayPhotoLibrary
                  photos={quickPhotos}
                  loading={photosLoading}
                  hasPhotoPage={pages.some((page) => page.widgets.some((widget) => widget.type === "photos"))}
                  onUpload={addPhotos}
                  onAddLinks={addLinkedPhotos}
                  onDelete={deletePhoto}
                  onAddPhotoPage={() => {
                    addPreset("photo-frame");
                    setSection("layout");
                  }}
                />
              )}

              {section === "lights" && (
                <SunriseLightsPanel lights={lights} onRename={renameDevice} onForget={forgetDevice} />
              )}
            </>
          )}
        </section>
      </div>

      <Dialog open={pairOpen} onOpenChange={setPairOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">Link a screen</DialogTitle>
            <DialogDescription>
              Open the display website on the tablet or TV, then approve it from a phone that is already signed in.
            </DialogDescription>
          </DialogHeader>
          <DisplayPairingGuide compact />
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Clock, ExternalLink, ImagePlus, MapPin, MonitorSmartphone,
  Moon, Palette, Plus, Search, Sparkles, Sunrise, Trash2, Wifi, WifiOff, X,
} from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/auth/AuthContext";
import { useMyDevices } from "@/hooks/useMyDevices";
import { useDeviceSettings } from "@/hooks/useDeviceSettings";
import {
  BACKDROP_LABELS, DEFAULT_DISPLAY_PAGES, DISPLAY_THEMES, DURATION_CHOICES, PAGE_PRESETS, WIDGET_LABELS,
  applyPageLayout, durationLabel, isPageActiveAt, pageScheduleLabel,
  type DisplayBackdropKind, type DisplayPage, type DisplayWidgetLayout,
} from "@/lib/displayPages";
import { useRemoteDisplayPhotos, type RemoteDisplayPhoto } from "@/hooks/useRemoteDisplayPhotos";
import { usePictureAlbums, useAlbumPhotoUrls } from "@/hooks/usePictures";
import { useTasks } from "@/hooks/useTasks";
import { useCalendar } from "@/hooks/useCalendar";
import { RemoteLayoutEditor } from "@/components/display/RemoteLayoutEditor";
import { DisplayPageRenderer } from "@/components/display/DisplayPageRenderer";
import { AlarmsSettingsPanel } from "@/components/display/AlarmsSettingsPanel";
import { NightModeSettingsPanel } from "@/components/display/NightModeSettingsPanel";
import { DisplayPhotoLibrary } from "@/components/display/DisplayPhotoLibrary";
import { nextNightEndIso, overrideUntilForAlarm } from "@/lib/displayNightMode";
import { toast } from "sonner";

const FIELD = "h-10 w-full min-w-0 rounded-xl border border-white/15 bg-white/[0.09] px-3 text-sm text-white placeholder:text-white/35 outline-none transition focus:border-primary focus:bg-white/[0.14]";
const LABEL = "text-[11px] font-bold uppercase tracking-wider text-white/45";
const CARD = "rounded-2xl border border-white/10 bg-white/[0.04] p-3";

const BACKDROPS: DisplayBackdropKind[] = ["none", "weather", "stars", "snow", "rain", "clouds", "aurora"];

function timestampMs(value: unknown) {
  if (value && typeof (value as { toMillis?: () => number }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function lastSeenLabel(value: unknown) {
  const ms = timestampMs(value);
  if (!ms) return "Not seen yet";
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (minutes < 2) return "Online now";
  if (minutes < 60) return `Seen ${minutes} minutes ago`;
  if (minutes < 1440) return `Seen ${Math.round(minutes / 60)} hours ago`;
  return `Seen ${Math.round(minutes / 1440)} days ago`;
}

function PairingSteps() {
  const steps = [
    { title: "On the screen itself", body: "Open a browser on the tablet, TV or Pi and go to hardyapp.co.uk/display." },
    { title: "Scan its QR code", body: "Use the phone you are signed in on. One passkey check covers seven days." },
    { title: "Approve it", body: "Tap approve on your phone. The screen starts showing your pages here." },
  ];
  return (
    <div className="mb-4 overflow-hidden rounded-3xl border border-primary/25 shadow-card">
      <div className="flex flex-wrap items-center gap-3 bg-gradient-primary px-4 py-3 text-primary-foreground">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/20">
          <Wifi className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold leading-tight">Link a screen in three steps</h2>
          <p className="text-xs text-primary-foreground/80">Any device with a browser can become an always-on display.</p>
        </div>
      </div>
      <ol className="grid gap-2.5 bg-[color-mix(in_srgb,hsl(var(--primary))_9%,hsl(var(--card)))] p-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="rounded-2xl border border-primary/15 bg-card p-3 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-sm font-bold text-primary-foreground">
                {index + 1}
              </span>
              <p className="text-sm font-bold">{step.title}</p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              {step.body.split("hardyapp.co.uk/display").map((part, partIndex, parts) => (
                <span key={partIndex}>
                  {part}
                  {partIndex < parts.length - 1 && (
                    <code className="rounded-md bg-primary/12 px-1.5 py-0.5 font-bold text-primary">hardyapp.co.uk/display</code>
                  )}
                </span>
              ))}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

export default function RemoteDisplays() {
  const { dataUid } = useAuth();
  const { devices, loading, renameDevice, forgetDevice } = useMyDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [showPresets, setShowPresets] = useState(false);
  const [placeQuery, setPlaceQuery] = useState("");
  const [editorPages, setEditorPages] = useState<DisplayPage[]>([]);
  const loadedDeviceRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const { device, loading: deviceLoading, updatePages, addAlarm, updateAlarm, deleteAlarm, updateNightMode } = useDeviceSettings(selectedDeviceId);
  const { photos, loading: photosLoading, addPhotos, addLinkedPhotos, updateCaption, deletePhoto } = useRemoteDisplayPhotos(dataUid);
  const { albums } = usePictureAlbums();
  const { tasks } = useTasks(dataUid || undefined);
  const { events: calendarEvents } = useCalendar(dataUid || undefined);
  const calendarCategories = useMemo(
    () => [...new Set(calendarEvents.map((event) => event.category).filter(Boolean))].sort(),
    [calendarEvents],
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
  }, [device]);

  useEffect(() => {
    if (!selectedPageId || !editorPages.some((page) => page.id === selectedPageId)) {
      setSelectedPageId(editorPages[0]?.id || null);
      setSelectedWidgetId(null);
    }
  }, [editorPages, selectedPageId]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  useEffect(() => {
    setDeviceName(device?.label || "");
  }, [device?.label]);

  // The settings rail sits beside the builder on wide screens but below it on a
  // laptop, where opening it off-screen looks like the button did nothing.
  useEffect(() => {
    if (selectedWidgetId) settingsRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [selectedWidgetId]);

  const pages = editorPages.length > 0 ? editorPages : device?.settings.pages || DEFAULT_DISPLAY_PAGES;
  const selectedPage = pages.find((page) => page.id === selectedPageId) || pages[0];
  const selectedWidget = selectedPage?.widgets.find((widget) => widget.id === selectedWidgetId) || null;

  const savePages = (next: DisplayPage[]) => {
    setEditorPages(next);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void updatePages(next).catch((error) => {
        toast.error(error instanceof Error ? error.message : "Could not update this display");
      });
    }, 350);
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

  const scheduled = !!selectedPage?.activeFrom && !!selectedPage?.activeTo && selectedPage.activeFrom !== selectedPage.activeTo;
  const photoIds = useMemo(() => new Set(selectedWidget?.photoIds || []), [selectedWidget?.photoIds]);
  const albumIds = useMemo(() => new Set(selectedWidget?.albumIds || []), [selectedWidget?.albumIds]);
  const previewAlbumIds = useMemo(() => {
    const ids = new Set<string>();
    for (const page of editorPages) {
      for (const widget of page.widgets || []) {
        if (widget.type === "photos") (widget.albumIds || []).forEach((id) => ids.add(id));
      }
    }
    return [...ids];
  }, [editorPages]);
  const { photos: albumPhotos } = useAlbumPhotoUrls(previewAlbumIds);
  const previewPhotos = useMemo<RemoteDisplayPhoto[]>(() => {
    const fromAlbums = albumPhotos.map((photo) => ({
      id: `album:${photo.albumId}:${photo.id}`,
      url: photo.url,
      albumId: photo.albumId,
      storagePath: photo.storagePath || "",
      caption: photo.name || "",
      source: "album" as const,
      createdAt: photo.createdAt,
    }));
    return [...photos, ...fromAlbums];
  }, [photos, albumPhotos]);

  const selectDevice = (id: string) => {
    if (id === selectedDeviceId) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      void updatePages(editorPages);
    }
    loadedDeviceRef.current = null;
    setEditorPages([]);
    setSelectedPageId(null);
    setSelectedWidgetId(null);
    setSelectedDeviceId(id);
  };

  return (
    <FeaturePageShell
      title="Remote Displays"
      subtitle="Build always-on screens for this account"
      icon={<MonitorSmartphone className="h-5 w-5" />}
      action={
        <Button variant="outline" size="sm" className="rounded-xl" asChild>
          <a href="/display" target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Open receiver</a>
        </Button>
      }
    >
      <PairingSteps />

      <div className="grid min-w-0 gap-4 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="h-fit space-y-2 rounded-2xl border border-border/60 bg-card p-3 shadow-card">
          <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Connected screens</p>
          {loading ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">Loading displays…</p>
          ) : devices.length === 0 ? (
            <div className="rounded-xl bg-muted/35 p-4 text-center">
              <MonitorSmartphone className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-xs font-semibold">No screens linked</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Follow the three steps above to add one.</p>
            </div>
          ) : devices.map((linked) => {
            const online = timestampMs(linked.lastSeenAt) > Date.now() - 10 * 60_000;
            return (
              <button
                key={linked.id}
                type="button"
                onClick={() => selectDevice(linked.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  selectedDeviceId === linked.id ? "border-primary bg-primary/10 shadow-sm" : "border-border/50 hover:border-primary/35"
                }`}
              >
                <span className="flex items-center gap-2">
                  {online ? <Wifi className="h-4 w-4 text-emerald-500" /> : <WifiOff className="h-4 w-4 text-muted-foreground" />}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{linked.label}</span>
                </span>
                <span className="mt-1 block pl-6 text-[10px] text-muted-foreground">{lastSeenLabel(linked.lastSeenAt)}</span>
              </button>
            );
          })}
        </aside>

        <section className="min-w-0 space-y-4">
          {!selectedDeviceId ? (
            <div className="rounded-2xl border border-border/60 bg-card px-6 py-16 text-center shadow-card">
              <MonitorSmartphone className="mx-auto h-10 w-10 text-primary" />
              <p className="mt-3 font-display text-lg font-bold">Link your first screen</p>
              <p className="mt-1 text-sm text-muted-foreground">The display will appear here immediately after you approve it.</p>
            </div>
          ) : deviceLoading || !device || !selectedPage ? (
            <div className="rounded-2xl bg-card py-16 text-center text-sm text-muted-foreground shadow-card">Loading display settings…</div>
          ) : (
            <>
              {/* Dark console: the builder reads as the screen it is designing. */}
              <div className="overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 shadow-card">
                <div className="flex flex-wrap items-center gap-2 border-b border-white/10 bg-white/[0.03] p-3">
                  <input
                    value={deviceName}
                    onChange={(event) => setDeviceName(event.target.value)}
                    onBlur={() => {
                      if (deviceName.trim() && deviceName.trim() !== device.label) void renameDevice(device.id, deviceName);
                    }}
                    className={`${FIELD} max-w-xs flex-1 font-semibold`}
                    aria-label="Display name"
                  />
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(`Disconnect ${device.label}?`)) void forgetDevice(device.id); }}
                    className="flex h-10 items-center gap-1.5 rounded-xl border border-red-400/30 bg-red-500/10 px-3 text-xs font-semibold text-red-200 transition hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Disconnect
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2 border-b border-white/10 p-3">
                  {pages.map((page) => {
                    const active = selectedPage.id === page.id;
                    return (
                      <button
                        key={page.id}
                        type="button"
                        onClick={() => { setSelectedPageId(page.id); setSelectedWidgetId(null); }}
                        className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${
                          active
                            ? "bg-gradient-primary text-primary-foreground shadow-lg"
                            : "border border-white/12 bg-white/[0.07] text-white hover:bg-white/[0.13]"
                        }`}
                      >
                        {page.name}
                        <span className={`ml-1.5 text-[10px] font-medium ${active ? "text-primary-foreground/75" : "text-white/45"}`}>
                          {pageScheduleLabel(page)}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setShowPresets((value) => !value)}
                    className="flex h-9 items-center gap-1 rounded-xl border border-dashed border-white/25 px-3 text-xs font-semibold text-white/80 transition hover:border-white/50 hover:text-white"
                  >
                    {showPresets ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />} Add page
                  </button>
                  <p className="ml-auto hidden text-[11px] text-white/40 sm:block">
                    {pages.length === 1
                      ? "One page, shown all the time"
                      : `Rotates through ${pages.length} pages`}
                  </p>
                </div>

                {showPresets && (
                  <div className="border-b border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-bold text-white">
                      <Sparkles className="h-3.5 w-3.5 text-primary" /> Start from a ready-made page
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {PAGE_PRESETS.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => addPreset(preset.id)}
                          className="rounded-xl border border-white/12 bg-white/[0.06] p-3 text-left transition hover:border-primary/60 hover:bg-white/[0.12]"
                        >
                          <p className="text-xs font-bold text-white">{preset.name}</p>
                          <p className="mt-0.5 text-[11px] leading-snug text-white/45">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid gap-4 p-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
                  <div className="min-w-0 space-y-4">
                    <div className="overflow-hidden rounded-2xl border border-white/10">
                      <div className="flex items-center justify-between gap-2 bg-white/[0.05] px-3 py-2">
                        <p className={LABEL}>Live preview</p>
                        {isPageActiveAt(selectedPage, new Date()) ? (
                          <span className="rounded-lg bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">On screen now</span>
                        ) : (
                          <span className="rounded-lg bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/60">Outside its hours</span>
                        )}
                      </div>
                      <div className="relative aspect-video w-full">
                        <DisplayPageRenderer page={selectedPage} photos={previewPhotos} calendarEvents={calendarEvents} tasks={tasks} />
                      </div>
                    </div>

                    <RemoteLayoutEditor
                      page={selectedPage}
                      selectedWidgetId={selectedWidgetId}
                      onSelectWidget={setSelectedWidgetId}
                      onChange={updatePage}
                    />

                    {pages.length > 1 && (
                      <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                        <button type="button" onClick={() => movePage(-1)} className="flex h-9 items-center rounded-xl border border-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/10">
                          <ChevronLeft className="mr-1 h-3.5 w-3.5" /> Move earlier
                        </button>
                        <button type="button" onClick={() => movePage(1)} className="flex h-9 items-center rounded-xl border border-white/15 px-3 text-xs font-semibold text-white transition hover:bg-white/10">
                          Move later <ChevronRight className="ml-1 h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = pages.filter((page) => page.id !== selectedPage.id);
                            savePages(next);
                            setSelectedPageId(next[0]?.id || null);
                          }}
                          className="ml-auto flex h-9 items-center rounded-xl px-3 text-xs font-semibold text-red-300 transition hover:bg-red-500/15"
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete page
                        </button>
                      </div>
                    )}
                  </div>

                  <div ref={settingsRef} className="min-w-0 space-y-3 xl:sticky xl:top-4 xl:self-start">
                    <div className={CARD}>
                      <p className={LABEL}>Page settings</p>
                      <div className="mt-2 space-y-3">
                        <div>
                          <label htmlFor="page-name" className="text-xs font-semibold text-white/80">Page name</label>
                          <input
                            id="page-name"
                            value={selectedPage.name}
                            onChange={(event) => updatePage({ ...selectedPage, name: event.target.value })}
                            className={`${FIELD} mt-1`}
                          />
                        </div>
                        <div>
                          <label htmlFor="page-duration" className="text-xs font-semibold text-white/80">Show for</label>
                          <select
                            id="page-duration"
                            value={DURATION_CHOICES.includes(selectedPage.durationSeconds) ? selectedPage.durationSeconds : 300}
                            onChange={(event) => updatePage({ ...selectedPage, durationSeconds: Number(event.target.value) })}
                            className={`${FIELD} mt-1`}
                          >
                            {DURATION_CHOICES.map((seconds) => (
                              <option key={seconds} value={seconds}>{durationLabel(seconds)}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-white/80">
                            <Clock className="h-3.5 w-3.5" /> When it may show
                          </p>
                          <select
                            value={scheduled ? "custom" : "all"}
                            onChange={(event) => {
                              if (event.target.value === "all") {
                                // Deleting the keys keeps the document free of undefined values.
                                const { activeFrom: _from, activeTo: _to, ...rest } = selectedPage;
                                updatePage(rest as DisplayPage);
                              } else {
                                updatePage({ ...selectedPage, activeFrom: "21:00", activeTo: "06:00" });
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
                                  value={selectedPage.activeFrom}
                                  onChange={(event) => updatePage({ ...selectedPage, activeFrom: event.target.value })}
                                  aria-label="Show from"
                                  className={FIELD}
                                />
                                <span className="text-xs text-white/50">to</span>
                                <input
                                  type="time"
                                  value={selectedPage.activeTo}
                                  onChange={(event) => updatePage({ ...selectedPage, activeTo: event.target.value })}
                                  aria-label="Show until"
                                  className={FIELD}
                                />
                              </div>
                              <p className="mt-1 text-[10px] text-white/40">Overnight is fine — 21:00 to 06:00 runs through midnight.</p>
                            </>
                          )}
                        </div>
                        <div>
                          <p className={`flex items-center gap-1.5 ${LABEL}`}><Palette className="h-3.5 w-3.5" /> Theme</p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {DISPLAY_THEMES.map((theme) => (
                              <button
                                key={theme.id}
                                type="button"
                                onClick={() => updatePage({ ...selectedPage, theme: theme.id, background: theme.background })}
                                aria-label={`${theme.label} theme`}
                                title={theme.label}
                                className={`h-9 w-9 rounded-xl border-2 transition ${
                                  selectedPage.theme === theme.id ? "scale-105 border-primary" : "border-white/15 hover:border-white/40"
                                }`}
                                style={{ background: `linear-gradient(140deg, ${theme.background} 45%, ${theme.accent} 160%)` }}
                              />
                            ))}
                            <input
                              type="color"
                              value={selectedPage.background}
                              onChange={(event) => updatePage({ ...selectedPage, theme: "custom", background: event.target.value })}
                              aria-label="Custom background"
                              className="h-9 w-12 cursor-pointer rounded-xl border border-white/15 bg-transparent p-1"
                            />
                          </div>
                        </div>
                        <div>
                          <label htmlFor="page-backdrop" className="text-xs font-semibold text-white/80">Background animation</label>
                          <select
                            id="page-backdrop"
                            value={selectedPage.backdrop || "none"}
                            onChange={(event) => updatePage({ ...selectedPage, backdrop: event.target.value as DisplayBackdropKind })}
                            className={`${FIELD} mt-1`}
                          >
                            {BACKDROPS.map((kind) => (
                              <option key={kind} value={kind}>{BACKDROP_LABELS[kind]}</option>
                            ))}
                          </select>
                          {selectedPage.backdrop === "weather" && (
                            <p className="mt-1 text-[10px] text-white/40">Snow when it snows, rain when it rains, stars after dark.</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {selectedWidget && (
                      <div className="rounded-2xl border border-primary/30 bg-primary/[0.09] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h2 className="font-display text-sm font-bold text-white">{WIDGET_LABELS[selectedWidget.type]} settings</h2>
                          <button
                            type="button"
                            onClick={() => setSelectedWidgetId(null)}
                            aria-label="Close widget settings"
                            className="rounded-lg p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-white/80" htmlFor="widget-title">Heading on screen</label>
                            <input
                              id="widget-title"
                              value={selectedWidget.title || ""}
                              placeholder={WIDGET_LABELS[selectedWidget.type]}
                              onChange={(event) => updateWidget({ title: event.target.value })}
                              className={`${FIELD} mt-1`}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <label className="text-xs font-semibold text-white/80" htmlFor="widget-accent">Accent colour</label>
                            <input
                              id="widget-accent"
                              type="color"
                              value={selectedWidget.accentColor || "#5eead4"}
                              onChange={(event) => updateWidget({ accentColor: event.target.value })}
                              className="h-9 w-16 cursor-pointer rounded-xl border border-white/15 bg-transparent p-1"
                            />
                          </div>

                          {selectedWidget.type === "clock" && (
                            <label className="block text-xs font-semibold text-white/80">
                              Clock face
                              <select
                                value={selectedWidget.clockStyle || "digital"}
                                onChange={(event) => updateWidget({ clockStyle: event.target.value as "digital" | "analog" })}
                                className={`${FIELD} mt-1`}
                              >
                                <option value="digital">Digital</option>
                                <option value="analog">Analogue</option>
                              </select>
                            </label>
                          )}

                          {(selectedWidget.type === "clock" || selectedWidget.type === "today") && (
                            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.05] p-2.5">
                              <label className="flex items-center justify-between gap-3 text-xs text-white">
                                <span>24-hour time</span>
                                <Switch checked={selectedWidget.format24h !== false} onCheckedChange={(value) => updateWidget({ format24h: value })} />
                              </label>
                              {selectedWidget.type === "clock" && (
                                <>
                                  <label className="flex items-center justify-between gap-3 text-xs text-white">
                                    <span>Show seconds</span>
                                    <Switch checked={selectedWidget.showSeconds === true} onCheckedChange={(value) => updateWidget({ showSeconds: value })} />
                                  </label>
                                  <label className="flex items-center justify-between gap-3 text-xs text-white">
                                    <span>Show date</span>
                                    <Switch checked={selectedWidget.showDate !== false} onCheckedChange={(value) => updateWidget({ showDate: value })} />
                                  </label>
                                </>
                              )}
                            </div>
                          )}

                          {selectedWidget.type === "photos" && (
                            <div className="space-y-2">
                              {albums.length > 0 && (
                                <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.04] p-2.5">
                                  <p className="text-xs font-semibold text-white/80">Picture albums</p>
                                  <p className="text-[10px] text-white/40">Choose albums from Pictures to show on this frame.</p>
                                  <div className="flex max-h-36 flex-col gap-1 overflow-y-auto">
                                    {albums.map((album) => {
                                      const on = albumIds.has(album.id);
                                      return (
                                        <button
                                          key={album.id}
                                          type="button"
                                          onClick={() => {
                                            const next = new Set(albumIds);
                                            if (next.has(album.id)) next.delete(album.id); else next.add(album.id);
                                            updateWidget({ albumIds: [...next] });
                                          }}
                                          className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${
                                            on ? "border-primary/50 bg-primary/15 text-white" : "border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/10"
                                          }`}
                                        >
                                          <span className="min-w-0 truncate font-medium">{album.name}</span>
                                          <span className="shrink-0 text-[10px] text-white/45">{album.photoCount} pics</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-semibold text-white/80">Library photos</p>
                                <label className="flex h-8 cursor-pointer items-center gap-1 rounded-xl border border-white/15 bg-white/10 px-2 text-[11px] font-semibold text-white transition hover:bg-white/20">
                                  <ImagePlus className="h-3.5 w-3.5" /> Upload
                                  <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => {
                                    if (event.target.files?.length) void addPhotos(Array.from(event.target.files));
                                    event.target.value = "";
                                  }} />
                                </label>
                              </div>
                              <p className="text-[10px] text-white/40">Select none to use the whole library.</p>
                              {photosLoading ? <p className="text-xs text-white/50">Loading photos…</p> : (
                                <div className="grid max-h-56 grid-cols-3 gap-1.5 overflow-y-auto">
                                  {photos.map((photo) => (
                                    <button
                                      key={photo.id}
                                      type="button"
                                      onClick={() => {
                                        const next = new Set(photoIds);
                                        if (next.has(photo.id)) next.delete(photo.id); else next.add(photo.id);
                                        updateWidget({ photoIds: [...next] });
                                      }}
                                      className={`relative overflow-hidden rounded-lg border-2 ${photoIds.has(photo.id) ? "border-primary" : "border-transparent"}`}
                                    >
                                      <img src={photo.url} alt={photo.caption} className="h-16 w-full object-cover" />
                                      {photoIds.has(photo.id) && (
                                        <span className="absolute right-0.5 top-0.5 rounded-md bg-primary p-0.5 text-primary-foreground"><Check className="h-2.5 w-2.5" /></span>
                                      )}
                                    </button>
                                  ))}
                                </div>
                              )}
                              <label className="flex items-center gap-2 text-xs text-white">
                                Change every
                                <input
                                  type="number"
                                  min={5}
                                  value={selectedWidget.photoIntervalSeconds || 20}
                                  onChange={(event) => updateWidget({ photoIntervalSeconds: Math.max(5, Number(event.target.value) || 20) })}
                                  className={`${FIELD} h-8 w-20`}
                                />
                                secs
                              </label>
                              {photos.length > 0 && (
                                <details className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                                  <summary className="cursor-pointer text-[11px] font-semibold text-white/70">Captions and deleting</summary>
                                  <div className="mt-2 space-y-1.5">
                                    {photos.map((photo) => (
                                      <div key={photo.id} className="flex items-center gap-1.5">
                                        <input
                                          value={photo.caption}
                                          onChange={(event) => void updateCaption(photo.id, event.target.value)}
                                          placeholder="Caption"
                                          className={`${FIELD} h-8 text-xs`}
                                        />
                                        <button
                                          type="button"
                                          onClick={() => void deletePhoto(photo)}
                                          aria-label={`Delete ${photo.caption || "photo"}`}
                                          className="rounded-lg p-1.5 text-white/50 transition hover:bg-red-500/20 hover:text-red-200"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>
                          )}

                          {(selectedWidget.type === "calendar" || selectedWidget.type === "today") && (
                            <>
                              {selectedWidget.type === "calendar" && (
                                <>
                                  <label className="block text-xs font-semibold text-white/80">
                                    Calendar style
                                    <select
                                      value={selectedWidget.calendarView || "month"}
                                      onChange={(event) => updateWidget({ calendarView: event.target.value as DisplayWidgetLayout["calendarView"] })}
                                      className={`${FIELD} mt-1`}
                                    >
                                      <option value="month">Whole month grid</option>
                                      <option value="week">This week</option>
                                      <option value="agenda">List of what’s coming up</option>
                                    </select>
                                  </label>
                                  {selectedWidget.calendarView === "agenda" ? (
                                    <label className="flex items-center gap-2 text-xs text-white">
                                      Show the next
                                      <input
                                        type="number"
                                        min={1}
                                        max={90}
                                        value={selectedWidget.calendarDaysAhead || 14}
                                        onChange={(event) => updateWidget({ calendarDaysAhead: Math.max(1, Number(event.target.value) || 14) })}
                                        className={`${FIELD} h-8 w-20`}
                                      />
                                      days
                                    </label>
                                  ) : (
                                    <label className="block text-xs font-semibold text-white/80">
                                      How events appear
                                      <select
                                        value={selectedWidget.calendarEventStyle || "titles"}
                                        onChange={(event) => updateWidget({ calendarEventStyle: event.target.value as DisplayWidgetLayout["calendarEventStyle"] })}
                                        className={`${FIELD} mt-1`}
                                      >
                                        <option value="titles">Event titles</option>
                                        <option value="dots">Coloured dots only</option>
                                        <option value="compact">A count per day</option>
                                      </select>
                                    </label>
                                  )}
                                </>
                              )}
                              <div className="flex items-center justify-between gap-2">
                                <label className="text-xs font-semibold text-white/80" htmlFor="event-colour">Event colour</label>
                                <input
                                  id="event-colour"
                                  type="color"
                                  value={selectedWidget.eventColor || "#f87171"}
                                  onChange={(event) => updateWidget({ eventColor: event.target.value })}
                                  className="h-9 w-16 cursor-pointer rounded-xl border border-white/15 bg-transparent p-1"
                                />
                              </div>
                              {calendarCategories.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-white/80">Categories</p>
                                  <p className="text-[10px] text-white/40">None selected shows everything.</p>
                                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                                    {calendarCategories.map((category) => {
                                      const selected = (selectedWidget.calendarCategories || []).includes(category);
                                      return (
                                        <button
                                          key={category}
                                          type="button"
                                          onClick={() => {
                                            const next = new Set(selectedWidget.calendarCategories || []);
                                            if (selected) next.delete(category); else next.add(category);
                                            updateWidget({ calendarCategories: [...next] });
                                          }}
                                          className={`rounded-xl border px-2.5 py-1 text-[11px] capitalize transition ${
                                            selected ? "border-primary bg-primary/25 text-white" : "border-white/15 bg-white/[0.06] text-white/70"
                                          }`}
                                        >
                                          {category}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </>
                          )}

                          {(selectedWidget.type === "tasks" || selectedWidget.type === "today") && (
                            <>
                              {selectedWidget.type === "tasks" && (
                                <label className="block text-xs font-semibold text-white/80">
                                  Tasks to show
                                  <select
                                    value={selectedWidget.taskFilter || "open"}
                                    onChange={(event) => updateWidget({ taskFilter: event.target.value as DisplayWidgetLayout["taskFilter"] })}
                                    className={`${FIELD} mt-1`}
                                  >
                                    <option value="today">Today only</option>
                                    <option value="open">All open tasks</option>
                                    <option value="all">Open and completed</option>
                                  </select>
                                </label>
                              )}
                              <label className="block text-xs font-semibold text-white/80">
                                Subtasks
                                <select
                                  value={selectedWidget.subtaskMode || "open"}
                                  onChange={(event) => updateWidget({ subtaskMode: event.target.value as DisplayWidgetLayout["subtaskMode"] })}
                                  className={`${FIELD} mt-1`}
                                >
                                  <option value="open">Show the ones still to do</option>
                                  <option value="all">Show all, ticked included</option>
                                  <option value="hide">Hide, show progress only</option>
                                </select>
                              </label>
                              <div className="grid grid-cols-2 gap-2">
                                <label className="text-xs font-semibold text-white/80">
                                  Rows at a time
                                  <input
                                    type="number"
                                    min={1}
                                    max={30}
                                    value={selectedWidget.taskLimit || 8}
                                    onChange={(event) => updateWidget({ taskLimit: Math.max(1, Number(event.target.value) || 8) })}
                                    className={`${FIELD} mt-1`}
                                  />
                                </label>
                                <label className="text-xs font-semibold text-white/80">
                                  Scroll on after
                                  <input
                                    type="number"
                                    min={5}
                                    max={300}
                                    value={selectedWidget.autoCycleSeconds || 20}
                                    onChange={(event) => updateWidget({ autoCycleSeconds: Math.max(5, Number(event.target.value) || 20) })}
                                    className={`${FIELD} mt-1`}
                                  />
                                </label>
                              </div>
                              <p className="text-[10px] text-white/40">
                                Longer lists move on by themselves, so nothing stays hidden on a screen you cannot tap.
                              </p>
                              {selectedWidget.type === "tasks" && (
                                <details className="rounded-xl border border-white/10 bg-white/[0.04] p-2">
                                  <summary className="cursor-pointer text-[11px] font-semibold text-white/70">Choose individual tasks</summary>
                                  <div className="mt-2 max-h-44 space-y-1 overflow-y-auto">
                                    {tasks.map((task) => {
                                      const taskId = task.id || "";
                                      const selected = (selectedWidget.taskIds || []).includes(taskId);
                                      return (
                                        <button
                                          key={taskId}
                                          type="button"
                                          onClick={() => {
                                            const next = new Set(selectedWidget.taskIds || []);
                                            if (selected) next.delete(taskId); else next.add(taskId);
                                            updateWidget({ taskIds: [...next] });
                                          }}
                                          className={`flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left text-[11px] ${
                                            selected ? "border-primary bg-primary/20 text-white" : "border-white/10 bg-white/[0.05] text-white/75"
                                          }`}
                                        >
                                          <span className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-white/30"}`}>
                                            {selected && <Check className="h-2.5 w-2.5" />}
                                          </span>
                                          <span className="truncate">{task.title}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </details>
                              )}
                            </>
                          )}

                          {selectedWidget.type === "weather" && (
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-white/80" htmlFor="weather-place">Location</label>
                              <div className="flex gap-1.5">
                                <input
                                  id="weather-place"
                                  value={placeQuery}
                                  onChange={(event) => setPlaceQuery(event.target.value)}
                                  onKeyDown={(event) => { if (event.key === "Enter") void findPlace(); }}
                                  placeholder="Town or city"
                                  className={FIELD}
                                />
                                <button
                                  type="button"
                                  onClick={() => void findPlace()}
                                  aria-label="Find place"
                                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground"
                                >
                                  <Search className="h-4 w-4" />
                                </button>
                              </div>
                              <p className="flex items-center gap-1.5 text-[11px] text-white/50">
                                <MapPin className="h-3 w-3" />
                                {selectedWidget.weatherPlace
                                  ? `Showing ${selectedWidget.weatherPlace}`
                                  : "Using the screen’s own location, if it allows it."}
                              </p>
                            </div>
                          )}

                          {selectedWidget.type === "message" && (
                            <label className="block text-xs font-semibold text-white/80">
                              Message
                              <textarea
                                value={selectedWidget.message || ""}
                                onChange={(event) => updateWidget({ message: event.target.value })}
                                rows={4}
                                placeholder="Back at 6 — dinner in the oven"
                                className={`${FIELD} mt-1 h-auto py-2`}
                              />
                            </label>
                          )}

                          {selectedWidget.type === "countdown" && (
                            <div className="space-y-2">
                              <label className="block text-xs font-semibold text-white/80">
                                Counting down to
                                <input
                                  type="date"
                                  value={selectedWidget.countdownTo || ""}
                                  onChange={(event) => updateWidget({ countdownTo: event.target.value })}
                                  className={`${FIELD} mt-1`}
                                />
                              </label>
                              <label className="block text-xs font-semibold text-white/80">
                                What for
                                <input
                                  value={selectedWidget.countdownLabel || ""}
                                  onChange={(event) => updateWidget({ countdownLabel: event.target.value })}
                                  placeholder="Holiday"
                                  className={`${FIELD} mt-1`}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {!selectedWidget && (
                      <p className="px-1 text-[11px] leading-relaxed text-white/40">
                        Pick a widget’s <span className="font-semibold text-white/60">Settings</span> button to change what it shows.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <DisplayPhotoLibrary
                photos={photos}
                loading={photosLoading}
                hasPhotoPage={pages.some((page) => page.widgets.some((widget) => widget.type === "photos"))}
                onUpload={addPhotos}
                onAddLinks={addLinkedPhotos}
                onDelete={deletePhoto}
                onAddPhotoPage={() => addPreset("photo-frame")}
              />

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                <div className="mb-3 flex items-center gap-2">
                  <Moon className="h-4 w-4 text-sky-400" />
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
            </>
          )}
        </section>
      </div>
    </FeaturePageShell>
  );
}

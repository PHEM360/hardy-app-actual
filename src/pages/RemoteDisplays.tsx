import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check, ExternalLink, ImagePlus, MonitorSmartphone, Pencil, Plus, Sunrise, Trash2, Wifi, WifiOff,
} from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/auth/AuthContext";
import { useMyDevices } from "@/hooks/useMyDevices";
import {
  DEFAULT_DISPLAY_PAGES,
  type DisplayPage,
  type DisplayWidgetLayout,
  useDeviceSettings,
} from "@/hooks/useDeviceSettings";
import { useRemoteDisplayPhotos } from "@/hooks/useRemoteDisplayPhotos";
import { useTasks } from "@/hooks/useTasks";
import { useCalendar } from "@/hooks/useCalendar";
import { RemoteLayoutEditor } from "@/components/display/RemoteLayoutEditor";
import { AlarmsSettingsPanel } from "@/components/display/AlarmsSettingsPanel";
import { toast } from "sonner";

function pageId() {
  return crypto.randomUUID();
}

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

export default function RemoteDisplays() {
  const { dataUid } = useAuth();
  const { devices, loading, renameDevice, forgetDevice } = useMyDevices();
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState("");
  const [editorPages, setEditorPages] = useState<DisplayPage[]>([]);
  const loadedDeviceRef = useRef<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { device, loading: deviceLoading, updatePages, addAlarm, updateAlarm, deleteAlarm } = useDeviceSettings(selectedDeviceId);
  const { photos, loading: photosLoading, addPhotos, updateCaption, deletePhoto } = useRemoteDisplayPhotos(dataUid);
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
    void savePages(pages.map((page) => page.id === nextPage.id ? nextPage : page));
  };

  const updateWidget = (patch: Partial<DisplayWidgetLayout>) => {
    if (!selectedPage || !selectedWidget) return;
    updatePage({
      ...selectedPage,
      widgets: selectedPage.widgets.map((widget) => widget.id === selectedWidget.id ? { ...widget, ...patch } : widget),
    });
  };

  const addPage = () => {
    const page: DisplayPage = {
      id: pageId(),
      name: `Page ${pages.length + 1}`,
      durationSeconds: device?.settings.scenes.rotateSeconds || 30,
      background: "#09090b",
      widgets: [],
    };
    savePages([...pages, page]);
    setSelectedPageId(page.id);
  };

  const photoIds = useMemo(() => new Set(selectedWidget?.photoIds || []), [selectedWidget?.photoIds]);
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
        <Button size="sm" className="rounded-xl bg-gradient-primary" onClick={() => window.open("/display", "_blank", "noopener,noreferrer")}>
          <Plus className="mr-1.5 h-4 w-4" /> Link a screen
        </Button>
      }
    >
      <div className="mb-4 rounded-2xl border border-primary/20 bg-[color-mix(in_srgb,hsl(var(--primary))_10%,hsl(var(--card)))] p-4 shadow-card">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Wifi className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Secure QR pairing over Wi‑Fi</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              On the iPad, TV browser, Raspberry Pi or other screen, open <strong>hardyapp.co.uk/display</strong>.
              Scan its QR code while signed into this account. The display receives a revocable device credential—not your password.
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0 rounded-xl" asChild>
            <a href="/display" target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3.5 w-3.5" /> Open receiver</a>
          </Button>
        </div>
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]">
        <aside className="h-fit space-y-2 rounded-2xl border border-border/60 bg-card p-3 shadow-card">
          <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Connected screens</p>
          {loading ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">Loading displays…</p>
          ) : devices.length === 0 ? (
            <div className="rounded-xl bg-muted/35 p-4 text-center">
              <MonitorSmartphone className="mx-auto h-7 w-7 text-muted-foreground" />
              <p className="mt-2 text-xs font-semibold">No screens linked</p>
              <p className="mt-1 text-[11px] text-muted-foreground">Open the receiver on another device to begin.</p>
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
              <p className="mt-1 text-sm text-muted-foreground">The display will appear here immediately after QR approval.</p>
            </div>
          ) : deviceLoading || !device || !selectedPage ? (
            <div className="rounded-2xl bg-card py-16 text-center text-sm text-muted-foreground shadow-card">Loading display settings…</div>
          ) : (
            <>
              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    value={deviceName}
                    onChange={(event) => setDeviceName(event.target.value)}
                    onBlur={() => {
                      if (deviceName.trim() && deviceName.trim() !== device.label) void renameDevice(device.id, deviceName);
                    }}
                    className="h-10 min-w-48 flex-1 rounded-xl font-semibold"
                    aria-label="Display name"
                  />
                  <Button variant="outline" size="sm" className="rounded-xl text-destructive" onClick={() => {
                    if (window.confirm(`Disconnect ${device.label}?`)) void forgetDevice(device.id);
                  }}>
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Disconnect
                  </Button>
                </div>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      type="button"
                      onClick={() => { setSelectedPageId(page.id); setSelectedWidgetId(null); }}
                      className={`rounded-xl px-3 py-2 text-xs font-semibold ${selectedPage.id === page.id ? "bg-gradient-primary text-primary-foreground" : "bg-muted text-foreground"}`}
                    >
                      {page.name}
                    </button>
                  ))}
                  <Button variant="outline" size="sm" className="h-9 rounded-xl" onClick={addPage}><Plus className="mr-1 h-3.5 w-3.5" /> Page</Button>
                  {pages.length > 1 && (
                    <Button variant="ghost" size="sm" className="ml-auto h-9 rounded-xl text-destructive" onClick={() => {
                      const next = pages.filter((page) => page.id !== selectedPage.id);
                      savePages(next);
                      setSelectedPageId(next[0]?.id || null);
                    }}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete page
                    </Button>
                  )}
                </div>
                <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_8rem_8rem]">
                  <div>
                    <Label>Page name</Label>
                    <Input value={selectedPage.name} onChange={(event) => updatePage({ ...selectedPage, name: event.target.value })} className="mt-1 rounded-xl" />
                  </div>
                  <div>
                    <Label>Seconds</Label>
                    <Input type="number" min={10} value={selectedPage.durationSeconds} onChange={(event) => updatePage({ ...selectedPage, durationSeconds: Math.max(10, Number(event.target.value) || 30) })} className="mt-1 rounded-xl" />
                  </div>
                  <div>
                    <Label>Background</Label>
                    <Input type="color" value={selectedPage.background} onChange={(event) => updatePage({ ...selectedPage, background: event.target.value })} className="mt-1 h-10 rounded-xl p-1" />
                  </div>
                </div>
                <RemoteLayoutEditor page={selectedPage} selectedWidgetId={selectedWidgetId} onSelectWidget={setSelectedWidgetId} onChange={updatePage} />
              </div>

              {selectedWidget && (
                <div className="rounded-2xl border border-primary/25 bg-[color-mix(in_srgb,hsl(var(--primary))_7%,hsl(var(--card)))] p-4 shadow-card">
                  <div className="mb-3 flex items-center gap-2">
                    <Pencil className="h-4 w-4 text-primary" />
                    <h2 className="font-display text-base font-bold">Widget settings</h2>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Title</Label>
                      <Input value={selectedWidget.title || ""} onChange={(event) => updateWidget({ title: event.target.value })} className="mt-1 rounded-xl" />
                    </div>
                    <div>
                      <Label>Accent colour</Label>
                      <Input type="color" value={selectedWidget.accentColor || "#14b8a6"} onChange={(event) => updateWidget({ accentColor: event.target.value })} className="mt-1 h-10 rounded-xl p-1" />
                    </div>
                  </div>

                  {selectedWidget.type === "clock" && (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-xs">
                        <span className="font-semibold">Clock face</span>
                        <select value={selectedWidget.clockStyle || "digital"} onChange={(event) => updateWidget({ clockStyle: event.target.value as "digital" | "analog" })} className="h-9 w-full rounded-xl border border-border bg-card px-3">
                          <option value="digital">Digital</option>
                          <option value="analog">Analog</option>
                        </select>
                      </label>
                      <div className="space-y-2 rounded-xl border border-border/60 bg-card/70 p-3">
                        <label className="flex items-center justify-between gap-3 text-xs"><span>24-hour time</span><Switch checked={selectedWidget.format24h !== false} onCheckedChange={(value) => updateWidget({ format24h: value })} /></label>
                        <label className="flex items-center justify-between gap-3 text-xs"><span>Show seconds</span><Switch checked={selectedWidget.showSeconds === true} onCheckedChange={(value) => updateWidget({ showSeconds: value })} /></label>
                        <label className="flex items-center justify-between gap-3 text-xs"><span>Show date</span><Switch checked={selectedWidget.showDate !== false} onCheckedChange={(value) => updateWidget({ showDate: value })} /></label>
                      </div>
                    </div>
                  )}

                  {selectedWidget.type === "photos" && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold">Photos on this widget</p>
                          <p className="text-[11px] text-muted-foreground">Select none to rotate through the whole library.</p>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl" asChild>
                          <label className="cursor-pointer">
                            <ImagePlus className="mr-1 h-3.5 w-3.5" /> Upload
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => {
                              if (event.target.files?.length) void addPhotos(Array.from(event.target.files));
                              event.target.value = "";
                            }} />
                          </label>
                        </Button>
                      </div>
                      {photosLoading ? <p className="text-xs text-muted-foreground">Loading photos…</p> : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                          {photos.map((photo) => (
                            <div key={photo.id} className={`group relative overflow-hidden rounded-xl border-2 ${photoIds.has(photo.id) ? "border-primary" : "border-transparent"}`}>
                              <button type="button" className="block w-full" onClick={() => {
                                const next = new Set(photoIds);
                                if (next.has(photo.id)) next.delete(photo.id); else next.add(photo.id);
                                updateWidget({ photoIds: [...next] });
                              }}>
                                <img src={photo.url} alt={photo.caption} className="h-24 w-full object-cover" />
                              </button>
                              <Input value={photo.caption} onChange={(event) => void updateCaption(photo.id, event.target.value)} placeholder="Caption" className="h-8 rounded-none border-0 text-[10px]" />
                              <button type="button" onClick={() => void deletePhoto(photo)} className="absolute right-1 top-1 rounded-lg bg-black/60 p-1 text-white opacity-0 group-hover:opacity-100"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <label className="flex items-center gap-2 text-xs">
                        Change photo every
                        <Input type="number" min={5} value={selectedWidget.photoIntervalSeconds || 20} onChange={(event) => updateWidget({ photoIntervalSeconds: Math.max(5, Number(event.target.value) || 20) })} className="h-8 w-20 rounded-lg" />
                        seconds
                      </label>
                    </div>
                  )}

                  {selectedWidget.type === "calendar" && (
                    <div className="mt-4 space-y-3">
                      <label className="flex items-center gap-2 text-xs">
                        Show the next
                        <Input type="number" min={1} max={90} value={selectedWidget.calendarDaysAhead || 14} onChange={(event) => updateWidget({ calendarDaysAhead: Math.max(1, Number(event.target.value) || 14) })} className="h-8 w-20 rounded-lg" />
                        days
                      </label>
                      {calendarCategories.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold">Calendar categories</p>
                          <p className="text-[11px] text-muted-foreground">Leave all unselected to show every category.</p>
                          <div className="mt-2 flex flex-wrap gap-2">
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
                                  className={`rounded-xl border px-3 py-1.5 text-xs capitalize ${selected ? "border-primary bg-primary/10 text-primary" : "border-border bg-card"}`}
                                >
                                  {category}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedWidget.type === "tasks" && (
                    <div className="mt-4 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="space-y-1 text-xs">
                          <span className="font-semibold">Tasks to show</span>
                          <select value={selectedWidget.taskFilter || "open"} onChange={(event) => updateWidget({ taskFilter: event.target.value as DisplayWidgetLayout["taskFilter"] })} className="h-9 w-full rounded-xl border border-border bg-card px-3">
                            <option value="today">Today</option>
                            <option value="open">All open tasks</option>
                            <option value="all">Open and completed</option>
                          </select>
                        </label>
                        <label className="space-y-1 text-xs">
                          <span className="font-semibold">Maximum tasks</span>
                          <Input type="number" min={1} max={30} value={selectedWidget.taskLimit || 8} onChange={(event) => updateWidget({ taskLimit: Math.max(1, Number(event.target.value) || 8) })} className="h-9 rounded-xl" />
                        </label>
                      </div>
                      <div>
                        <p className="text-xs font-semibold">Choose individual tasks</p>
                        <p className="text-[11px] text-muted-foreground">Leave all unselected to use the filter above.</p>
                        <div className="mt-2 grid max-h-48 gap-1.5 overflow-y-auto sm:grid-cols-2">
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
                                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs ${selected ? "border-primary bg-primary/10" : "border-border/60 bg-card"}`}
                              >
                                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}>
                                  {selected && <Check className="h-3 w-3" />}
                                </span>
                                <span className="truncate">{task.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-card">
                <div className="mb-3 flex items-center gap-2">
                  <Sunrise className="h-4 w-4 text-amber-500" />
                  <div>
                    <h2 className="font-display text-base font-bold">Alarm clock</h2>
                    <p className="text-[11px] text-muted-foreground">Sunrise mode gradually warms and brightens the display before the alarm.</p>
                  </div>
                </div>
                <AlarmsSettingsPanel alarms={device.settings.alarms} onAdd={addAlarm} onUpdate={updateAlarm} onDelete={deleteAlarm} />
              </div>
            </>
          )}
        </section>
      </div>
    </FeaturePageShell>
  );
}

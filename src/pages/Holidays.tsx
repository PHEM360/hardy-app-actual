import { useEffect, useMemo, useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  Palmtree,
  Plus,
  Search,
  Pause,
  Play,
  Trash2,
  Pencil,
  ExternalLink,
  Bell,
  Archive,
  Settings2,
  PoundSterling,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import DogLoader from "@/components/DogLoader";
import { HolidayWatchForm, type HolidayWatchFormValue } from "@/components/holidays/HolidayWatchForm";
import { HolidayOptionsPanel } from "@/components/holidays/HolidayOptionsPanel";
import { useHolidays } from "@/hooks/useHolidays";
import { useSharedScope } from "@/hooks/useSharedScope";
import { runHolidayPriceSearch } from "@/lib/holidaysApi";
import {
  BOARD_BASIS_LABELS,
  DATE_MODE_LABELS,
  DEFAULT_HOLIDAY_SETTINGS,
  FLIGHT_BOOKING_LABELS,
  FLIGHT_CLASS_LABELS,
  HOLIDAY_ACCENT,
  MONTH_LABELS,
  type HolidayPriceFinding,
  type HolidaySearchOption,
  type HolidaySettings,
  type HolidayWatch,
} from "@/types/holidays";

type RailSection = "watches" | "best" | "settings";

export interface HolidaysMockData {
  watches: HolidayWatch[];
  pricesByWatchId?: Record<string, HolidaySearchOption[] | HolidayPriceFinding[]>;
  settings?: HolidaySettings;
}

function fmtMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return format(parseISO(d.slice(0, 10)), "d MMM yyyy");
  } catch {
    return d;
  }
}

function dateSummary(w: HolidayWatch): string {
  const mode = w.dates?.mode || "fixed";
  if (mode === "no_preference") return "Any dates";
  if (mode === "months") {
    const months = (w.dates?.months || []).map((m) => MONTH_LABELS[m - 1]).join(", ");
    return `${months || "Months"} ${w.dates?.year || ""} · ${w.dates?.nights || "?"}n`.trim();
  }
  const start = fmtDate(w.dates?.startDate);
  const end = fmtDate(w.dates?.endDate);
  const flex =
    mode === "flexible_days" && w.dates?.flexDays
      ? ` ±${w.dates.flexDays}d`
      : "";
  if (start && end) return `${start} → ${end}${flex}`;
  if (start) return `${start} · ${w.dates?.nights || "?"}n${flex}`;
  return DATE_MODE_LABELS[mode];
}

function WatchCard({
  watch,
  accent,
  selected,
  canEdit,
  onSelect,
  onEdit,
  onTogglePause,
  onArchive,
  onDelete,
  onSearch,
  searching,
}: {
  watch: HolidayWatch;
  accent: string;
  selected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onTogglePause: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onSearch: () => void;
  searching: boolean;
}) {
  const paused = watch.status === "paused";
  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left shadow-card transition ${
        selected ? "border-primary/50 ring-1 ring-primary/20" : "border-border/50"
      }`}
      style={{
        background: `color-mix(in srgb, ${accent} 14%, var(--card))`,
        borderLeftWidth: 4,
        borderLeftColor: accent,
      }}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-base font-bold text-foreground truncate">
              {watch.title || watch.destination}
            </h3>
            <Badge
              variant="outline"
              className={`text-[10px] ${
                watch.status === "active"
                  ? "border-primary/30 bg-primary/10 text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {watch.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-foreground/80">{watch.destination}</p>
          <p className="mt-1 text-xs text-muted-foreground">{dateSummary(watch)}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-lg bg-card/80 px-2 py-0.5 text-[10px] font-medium text-foreground">
              {FLIGHT_BOOKING_LABELS[watch.flightBooking]}
            </span>
            <span className="rounded-lg bg-card/80 px-2 py-0.5 text-[10px] font-medium text-foreground">
              {FLIGHT_CLASS_LABELS[watch.flightClass]}
            </span>
            <span className="rounded-lg bg-card/80 px-2 py-0.5 text-[10px] font-medium text-foreground">
              {BOARD_BASIS_LABELS[watch.boardBasis]}
            </span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Best
          </p>
          <p className="font-display text-xl font-bold text-foreground">
            {fmtMoney(watch.bestPriceGbp)}
          </p>
          {watch.bestPriceSource && (
            <p className="max-w-[7rem] truncate text-[10px] text-muted-foreground">
              {watch.bestPriceSource}
            </p>
          )}
        </div>
      </div>

      {canEdit && (
        <div
          className="mt-3 flex flex-wrap gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            size="sm"
            className="h-8 rounded-xl bg-gradient-primary text-primary-foreground border-0"
            disabled={searching || watch.status === "archived"}
            onClick={onSearch}
          >
            <Search className="mr-1 h-3.5 w-3.5" />
            {searching ? "Searching…" : "Search now"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={onEdit}>
            <Pencil className="mr-1 h-3.5 w-3.5" />
            Edit
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={onTogglePause}>
            {paused ? <Play className="mr-1 h-3.5 w-3.5" /> : <Pause className="mr-1 h-3.5 w-3.5" />}
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded-xl" onClick={onArchive}>
            <Archive className="mr-1 h-3.5 w-3.5" />
            Archive
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 rounded-xl text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </motion.button>
  );
}

const Holidays = ({ mockData }: { mockData?: HolidaysMockData } = {}) => {
  const { scopeUserId, isOwnScope, pageTitle } = useSharedScope("holidays");
  const live = useHolidays(scopeUserId);
  const canEdit = mockData ? true : isOwnScope;

  const watches = mockData?.watches ?? live.watches;
  const settings = mockData?.settings ?? live.settings ?? DEFAULT_HOLIDAY_SETTINGS;
  const loading = mockData ? false : live.loading;
  const error = mockData ? null : live.error;
  const { saveSettings, addWatch, updateWatch, setWatchStatus, deleteWatch, addManualPrice } = live;

  const [section, setSection] = useState<RailSection>("watches");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HolidayWatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [defaultIntervalAmount, setDefaultIntervalAmount] = useState(
    settings.defaultSearchIntervalAmount,
  );
  const [defaultIntervalUnit, setDefaultIntervalUnit] = useState(settings.defaultSearchIntervalUnit);

  useEffect(() => {
    setDefaultIntervalAmount(settings.defaultSearchIntervalAmount);
    setDefaultIntervalUnit(settings.defaultSearchIntervalUnit);
  }, [settings.defaultSearchIntervalAmount, settings.defaultSearchIntervalUnit]);

  useEffect(() => {
    if (!selectedId && watches[0]?.id) setSelectedId(watches[0].id);
  }, [watches, selectedId]);

  const selected = watches.find((w) => w.id === selectedId) || null;

  const visible = useMemo(
    () =>
      watches.filter((w) =>
        showArchived ? w.status === "archived" : w.status !== "archived",
      ),
    [watches, showArchived],
  );

  const bestDeals = useMemo(
    () =>
      [...watches]
        .filter((w) => w.bestPriceGbp != null && w.status !== "archived")
        .sort((a, b) => (a.bestPriceGbp || 0) - (b.bestPriceGbp || 0)),
    [watches],
  );

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (w: HolidayWatch) => {
    setEditing(w);
    setFormOpen(true);
  };

  const handleSave = async (value: HolidayWatchFormValue) => {
    if (mockData) {
      toast.success("Preview only — not saved");
      setFormOpen(false);
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      if (editing?.id) {
        await updateWatch(editing.id, value);
        toast.success("Watch updated");
      } else {
        await addWatch(value);
        toast.success("Watching for deals");
        setSection("watches");
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      toast.error((err as Error).message || "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const handleSearch = async (watchId: string) => {
    if (!canEdit) {
      toast("Only the owner can run a live search");
      return;
    }
    setSearchingId(watchId);
    try {
      const res = await runHolidayPriceSearch(watchId);
      if (res.findings === 0) {
        toast(res.message || "No options matched your filters");
      } else if (res.cheaperThanBefore) {
        toast.success(`${res.findings} options · new best ${fmtMoney(res.bestPriceGbp)}`);
      } else {
        toast.success(`${res.findings} options ranked · best ${fmtMoney(res.bestPriceGbp)}`);
      }
    } catch (err) {
      toast.error((err as Error).message || "Search failed");
    } finally {
      setSearchingId(null);
    }
  };

  const rail = [
    { id: "watches" as const, label: "Watches", icon: Palmtree },
    { id: "best" as const, label: "Best prices", icon: PoundSterling },
    { id: "settings" as const, label: "Defaults", icon: Settings2 },
  ];

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle={
        isOwnScope
          ? "Watch legitimate travel sites for the best family holiday price"
          : "Shared with you"
      }
      icon={<Palmtree className="h-5 w-5" />}
      sharePage={mockData ? undefined : "holidays"}
      action={
        canEdit ? (
          <Button
            size="sm"
            className="rounded-xl bg-gradient-primary text-primary-foreground border-0"
            onClick={openNew}
          >
            <Plus className="mr-1 h-4 w-4" />
            New watch
          </Button>
        ) : undefined
      }
    >
      <div className="flex min-w-0 gap-3 lg:gap-4">
        <aside className="w-[3.5rem] shrink-0 sm:w-[10.75rem]">
          <nav
            aria-label="Holidays sections"
            className="sticky top-2 space-y-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-card"
          >
            {rail.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-2 rounded-xl border px-1.5 py-2 text-left transition sm:px-2 ${
                    active
                      ? "border-primary/45 bg-primary/10 text-foreground"
                      : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      active ? "bg-gradient-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="hidden min-w-0 text-xs font-semibold sm:block">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1 space-y-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <DogLoader />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-destructive/30 bg-card p-6 text-sm text-destructive shadow-card">
              {error}
            </div>
          ) : (
            <>
              {section === "watches" && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-muted-foreground">
                      {visible.length} {showArchived ? "archived" : "active"} watch
                      {visible.length === 1 ? "" : "es"}
                    </p>
                    <button
                      type="button"
                      className="text-xs font-semibold text-primary"
                      onClick={() => setShowArchived((v) => !v)}
                    >
                      {showArchived ? "Show active" : "Show archived"}
                    </button>
                  </div>

                  {visible.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card"
                      style={{
                        background: `color-mix(in srgb, ${HOLIDAY_ACCENT} 12%, var(--card))`,
                        borderLeftWidth: 4,
                        borderLeftColor: HOLIDAY_ACCENT,
                      }}
                    >
                      <div
                        className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
                        style={{ background: HOLIDAY_ACCENT }}
                      >
                        <Palmtree className="h-6 w-6" />
                      </div>
                      <h2 className="font-display text-lg font-bold">No holiday watches yet</h2>
                      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                        Set your dates (fixed, flexible, or by month), brands, cabin and board — we’ll
                        check legitimate travel sites on your schedule and alert you on a better price.
                      </p>
                      {canEdit && (
                        <Button
                          className="mt-4 rounded-xl bg-gradient-primary text-primary-foreground border-0"
                          onClick={openNew}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Create a watch
                        </Button>
                      )}
                    </motion.div>
                  ) : (
                    <div className="space-y-3">
                      <AnimatePresence initial={false}>
                        {visible.map((w) => (
                          <WatchCard
                            key={w.id}
                            watch={w}
                            accent={HOLIDAY_ACCENT}
                            selected={selectedId === w.id}
                            canEdit={canEdit}
                            onSelect={() => setSelectedId(w.id || null)}
                            onEdit={() => openEdit(w)}
                            onTogglePause={() =>
                              w.id &&
                              setWatchStatus(w.id, w.status === "paused" ? "active" : "paused")
                            }
                            onArchive={() => w.id && setWatchStatus(w.id, "archived")}
                            onDelete={() => {
                              if (w.id && confirm("Delete this holiday watch?")) deleteWatch(w.id);
                            }}
                            onSearch={() => w.id && handleSearch(w.id)}
                            searching={searchingId === w.id}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}

                  {selected && (
                    <HolidayOptionsPanel
                      watch={
                        selected.id && mockData?.pricesByWatchId?.[selected.id]
                          ? {
                              ...selected,
                              lastOptions: mockData.pricesByWatchId[selected.id],
                            }
                          : selected
                      }
                      scopeUserId={scopeUserId}
                      canEdit={canEdit}
                      onLogPrice={async (data) => {
                        if (!selected.id) return;
                        await addManualPrice(selected.id, {
                          ...data,
                          foundAt: new Date().toISOString(),
                        });
                      }}
                    />
                  )}
                </>
              )}

              {section === "best" && (
                <div className="space-y-3">
                  {bestDeals.length === 0 ? (
                    <div className="rounded-2xl border border-border/50 bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
                      Best prices will appear here once a watch finds a deal.
                    </div>
                  ) : (
                    bestDeals.map((w, i) => (
                      <motion.div
                        key={w.id}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-4 shadow-card"
                        style={{
                          background: `color-mix(in srgb, ${HOLIDAY_ACCENT} 10%, var(--card))`,
                          borderLeftWidth: 4,
                          borderLeftColor: HOLIDAY_ACCENT,
                        }}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-display font-bold">{w.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {w.destination} · {w.bestPriceSource}
                          </p>
                        </div>
                        <p className="font-display text-xl font-bold">{fmtMoney(w.bestPriceGbp)}</p>
                        {w.bestPriceUrl && (
                          <a
                            href={w.bestPriceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </motion.div>
                    ))
                  )}
                </div>
              )}

              {section === "settings" && (
                <div
                  className="space-y-4 rounded-2xl border border-border/50 bg-card p-5 shadow-card"
                  style={{
                    background: `color-mix(in srgb, ${HOLIDAY_ACCENT} 10%, var(--card))`,
                    borderLeftWidth: 4,
                    borderLeftColor: HOLIDAY_ACCENT,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Bell className="h-4 w-4 text-primary" />
                    <h2 className="font-display text-base font-bold">Default search cadence</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Used when you create a new watch. Each watch can override this.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Input
                      type="number"
                      min={1}
                      className="h-9 w-24 rounded-xl bg-card"
                      value={defaultIntervalAmount}
                      onChange={(e) => setDefaultIntervalAmount(Number(e.target.value) || 1)}
                    />
                    <select
                      className="h-9 rounded-xl border border-border bg-card px-3 text-sm"
                      value={defaultIntervalUnit}
                      onChange={(e) =>
                        setDefaultIntervalUnit(e.target.value as typeof defaultIntervalUnit)
                      }
                    >
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="weeks">Weeks</option>
                      <option value="months">Months</option>
                    </select>
                    <Button
                      className="h-9 rounded-xl bg-gradient-primary text-primary-foreground border-0"
                      disabled={!canEdit}
                      onClick={async () => {
                        await saveSettings({
                          ...settings,
                          defaultSearchIntervalAmount: defaultIntervalAmount,
                          defaultSearchIntervalUnit: defaultIntervalUnit,
                        });
                        toast.success("Defaults saved");
                      }}
                    >
                      Save defaults
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Automated checks only hit allowlisted sites (BA, Jet2, TUI, easyJet, Loveholidays,
                    On the Beach, Skyscanner, Kayak, Expedia, Trailfinders, and similar). Many sites
                    block bots — log prices you spot, and you’ll still get alerts when a cheaper deal
                    is recorded.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[min(90vh,calc(100dvh-env(safe-area-inset-top,0px)-env(safe-area-inset-bottom,0px)-1.5rem))] max-w-lg overflow-y-auto mx-4"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              {editing ? "Edit holiday watch" : "New holiday watch"}
            </DialogTitle>
          </DialogHeader>
          <HolidayWatchForm
            settings={settings}
            initial={editing}
            saving={saving}
            onCancel={() => setFormOpen(false)}
            onSave={handleSave}
          />
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Holidays;

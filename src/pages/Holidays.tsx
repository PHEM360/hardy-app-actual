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
  Compass,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import DogLoader from "@/components/DogLoader";
import { HolidayWatchForm, type HolidayWatchFormValue } from "@/components/holidays/HolidayWatchForm";
import { HolidayOptionsPanel } from "@/components/holidays/HolidayOptionsPanel";
import { useHolidays } from "@/hooks/useHolidays";
import { useSharedScope } from "@/hooks/useSharedScope";
import { researchHolidayDestination, runHolidayPriceSearch } from "@/lib/holidaysApi";
import { HOLIDAY_KEY_FEATURES } from "@/lib/holidayCatalog";
import {
  BOARD_BASIS_LABELS,
  DATE_MODE_LABELS,
  DEFAULT_HOLIDAY_SETTINGS,
  FLIGHT_BOOKING_LABELS,
  FLIGHT_CLASS_LABELS,
  HOLIDAY_ACCENT,
  MONTH_LABELS,
  WATCH_KIND_LABELS,
  type HolidayDestinationOverview,
  type HolidayPriceFinding,
  type HolidaySearchOption,
  type HolidaySettings,
  type HolidayWatch,
} from "@/types/holidays";

type RailSection = "watches" | "best" | "explore" | "settings";

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
            {watch.watchKind && watch.watchKind !== "search" && (
              <Badge variant="outline" className="text-[10px] border-primary/30 bg-card">
                {WATCH_KIND_LABELS[watch.watchKind]}
              </Badge>
            )}
            <Badge
              variant="outline"
              className={`text-[10px] ${
                watch.status === "active"
                  ? "border-primary/30 bg-primary/10 text-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {watch.scheduleMode === "once" ? "one-off" : watch.status}
            </Badge>
          </div>
          <p className="mt-0.5 text-sm text-foreground/80">
            {watch.watchKind === "flight" && watch.specificFlight
              ? `${watch.specificFlight.origin} → ${watch.specificFlight.destination}${
                  watch.specificFlight.outboundFlightNumber
                    ? ` · ${watch.specificFlight.outboundFlightNumber}`
                    : ""
                }`
              : watch.watchKind === "hotel" && watch.specificHotel
                ? `${watch.specificHotel.name} · ${watch.specificHotel.location}`
                : watch.destination}
          </p>
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
      <p className="mt-2.5 flex items-center gap-1 text-[11px] font-semibold" style={{ color: accent }}>
        {selected ? (
          <>Hide results <ChevronUp className="h-3.5 w-3.5" /></>
        ) : (
          <>View results <ChevronDown className="h-3.5 w-3.5" /></>
        )}
      </p>
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
  const aiUsage = mockData ? null : live.aiUsage;

  const [section, setSection] = useState<RailSection>("watches");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HolidayWatch | null>(null);
  const [saving, setSaving] = useState(false);
  const [searchingId, setSearchingId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const [defaultIntervalAmount, setDefaultIntervalAmount] = useState(
    String(settings.defaultSearchIntervalAmount),
  );
  const [defaultIntervalUnit, setDefaultIntervalUnit] = useState(settings.defaultSearchIntervalUnit);

  useEffect(() => {
    setDefaultIntervalAmount(String(settings.defaultSearchIntervalAmount));
    setDefaultIntervalUnit(settings.defaultSearchIntervalUnit);
  }, [settings.defaultSearchIntervalAmount, settings.defaultSearchIntervalUnit]);

  const [likedResortsText, setLikedResortsText] = useState(settings.likedResorts.join(", "));
  const [likedAmenities, setLikedAmenities] = useState(settings.likedAmenities);
  const [reviewPrioritiesText, setReviewPrioritiesText] = useState(settings.reviewPriorities.join(", "));
  const [preferenceNotes, setPreferenceNotes] = useState(settings.preferenceNotes);
  const [aiBudgetText, setAiBudgetText] = useState(
    settings.aiMonthlyBudgetGbp == null ? "" : String(settings.aiMonthlyBudgetGbp),
  );

  useEffect(() => {
    setLikedResortsText(settings.likedResorts.join(", "));
    setLikedAmenities(settings.likedAmenities);
    setReviewPrioritiesText(settings.reviewPriorities.join(", "));
    setPreferenceNotes(settings.preferenceNotes);
    setAiBudgetText(settings.aiMonthlyBudgetGbp == null ? "" : String(settings.aiMonthlyBudgetGbp));
  }, [
    settings.likedResorts,
    settings.likedAmenities,
    settings.reviewPriorities,
    settings.preferenceNotes,
    settings.aiMonthlyBudgetGbp,
  ]);

  const [exploreQuery, setExploreQuery] = useState("");
  const [exploring, setExploring] = useState(false);
  const [overview, setOverview] = useState<HolidayDestinationOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const runExplore = async () => {
    const query = exploreQuery.trim();
    if (!query) return;
    setExploring(true);
    setOverviewError(null);
    try {
      const result = await researchHolidayDestination(query);
      setOverview(result);
    } catch (err) {
      setOverviewError((err as Error).message || "Could not research that destination right now.");
    } finally {
      setExploring(false);
    }
  };

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
        const once = value.scheduleMode === "once";
        await updateWatch(editing.id, {
          ...value,
          nextSearchAt: once
            ? null
            : editing.scheduleMode === "once" || !editing.nextSearchAt
              ? new Date().toISOString()
              : editing.nextSearchAt,
          status: once ? editing.status : editing.status === "paused" && editing.scheduleMode === "once" ? "active" : editing.status,
        });
        toast.success(once ? "Saved as one-off search" : "Watch updated");
        if (once && canEdit) {
          setSearchingId(editing.id);
          try {
            const res = await runHolidayPriceSearch(editing.id);
            toast.success(
              res.findings
                ? `${res.findings} options · best ${fmtMoney(res.bestPriceGbp)}`
                : res.message || "One-off search finished",
            );
          } catch (err) {
            toast.error((err as Error).message || "Search failed");
          } finally {
            setSearchingId(null);
          }
        }
      } else {
        const id = await addWatch(value);
        if (value.scheduleMode === "once") {
          toast.success("Running one-off search…");
          setSection("watches");
          if (id && canEdit) {
            setSearchingId(id);
            try {
              const res = await runHolidayPriceSearch(id);
              toast.success(
                res.findings
                  ? `${res.findings} options · best ${fmtMoney(res.bestPriceGbp)}`
                  : res.message || "One-off search finished",
              );
            } catch (err) {
              toast.error((err as Error).message || "Search failed");
            } finally {
              setSearchingId(null);
            }
          }
        } else {
          toast.success("Watching for deals");
          setSection("watches");
        }
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
    { id: "explore" as const, label: "Explore", icon: Compass },
    { id: "settings" as const, label: "Preferences", icon: Settings2 },
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
                            onSelect={() => setSelectedId(selectedId === w.id ? null : (w.id || null))}
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
                          ? ({
                              ...selected,
                              lastOptions: mockData.pricesByWatchId[selected.id] as HolidaySearchOption[],
                            } as HolidayWatch)
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

              {section === "explore" && (
                <div className="space-y-4">
                  <div
                    className="space-y-3 rounded-2xl border border-border/50 bg-card p-5 shadow-card"
                    style={{
                      background: `color-mix(in srgb, ${HOLIDAY_ACCENT} 10%, var(--card))`,
                      borderLeftWidth: 4,
                      borderLeftColor: HOLIDAY_ACCENT,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <h2 className="font-display text-base font-bold">Explore a destination</h2>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Type a country, region, or island group — e.g. "Caribbean" or "Crete" — and the
                      AI will research real, currently-bookable resorts for you, tailored to your
                      saved preferences.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        value={exploreQuery}
                        onChange={(e) => setExploreQuery(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && runExplore()}
                        placeholder="e.g. Caribbean"
                        className="h-9 flex-1 min-w-[10rem] rounded-xl bg-card"
                      />
                      <Button
                        className="h-9 rounded-xl bg-gradient-primary text-primary-foreground border-0"
                        disabled={exploring || !exploreQuery.trim()}
                        onClick={runExplore}
                      >
                        {exploring ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Compass className="mr-1.5 h-4 w-4" />}
                        {exploring ? "Researching…" : "Explore"}
                      </Button>
                    </div>
                  </div>

                  {overviewError && (
                    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                      {overviewError}
                    </div>
                  )}

                  {overview && (
                    <div className="space-y-3">
                      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-card">
                        <h3 className="font-display text-lg font-bold">{overview.query}</h3>
                        <p className="mt-1.5 text-sm text-muted-foreground">{overview.overview}</p>
                      </div>

                      {overview.areas.length > 0 && (
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {overview.areas.map((area) => (
                            <div key={area.name} className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
                              <p className="font-display font-bold">{area.name}</p>
                              <p className="mt-1 text-sm text-muted-foreground">{area.summary}</p>
                              {area.bestFor.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                  {area.bestFor.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="rounded-lg text-[10px]">
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {overview.topPick && (
                        <div
                          className="rounded-2xl border p-4 shadow-card"
                          style={{
                            background: `color-mix(in srgb, ${HOLIDAY_ACCENT} 14%, var(--card))`,
                            borderColor: HOLIDAY_ACCENT,
                          }}
                        >
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            Best fit for your family
                          </p>
                          <p className="font-display text-lg font-bold">{overview.topPick.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{overview.topPick.reason}</p>
                        </div>
                      )}

                      {overview.resorts.length > 0 && (
                        <div className="space-y-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            How the resorts compare
                          </p>
                          {overview.resorts.map((resort) => (
                            <div key={resort.name} className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
                              <div className="flex flex-wrap items-baseline justify-between gap-2">
                                <p className="font-display font-bold">{resort.name}</p>
                                <span className="text-xs text-muted-foreground">{resort.area}</span>
                              </div>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                {resort.starRating != null && <span>{resort.starRating}★</span>}
                                {resort.boardBasis && <span>{resort.boardBasis.replace(/_/g, " ")}</span>}
                                {resort.approxPriceGbpPerPerson != null && (
                                  <span>~{fmtMoney(resort.approxPriceGbpPerPerson)} pp</span>
                                )}
                              </div>
                              {resort.whyItFits.length > 0 && (
                                <ul className="mt-2 list-disc space-y-0.5 pl-4 text-sm">
                                  {resort.whyItFits.map((reason, i) => (
                                    <li key={i}>{reason}</li>
                                  ))}
                                </ul>
                              )}
                              {resort.reviewHighlights.length > 0 && (
                                <p className="mt-2 text-xs text-muted-foreground">
                                  Reviewers say: {resort.reviewHighlights.join(" · ")}
                                </p>
                              )}
                              {resort.sourceUrls.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {resort.sourceUrls.map((url) => (
                                    <a
                                      key={url}
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                                    >
                                      Source <ExternalLink className="h-3 w-3" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {overview.caveats.length > 0 && (
                        <ul className="list-disc space-y-1 pl-4 text-xs text-muted-foreground">
                          {overview.caveats.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      )}
                    </div>
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
                      onChange={(e) => setDefaultIntervalAmount(e.target.value)}
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
                          defaultSearchIntervalAmount: Number(defaultIntervalAmount) || 1,
                          defaultSearchIntervalUnit: defaultIntervalUnit,
                        });
                        toast.success("Defaults saved");
                      }}
                    >
                      Save defaults
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Searches use AI web research across allowlisted sites (BA, Jet2, TUI, easyJet,
                    Loveholidays, On the Beach, Skyscanner, Kayak, Expedia, Trailfinders, and similar)
                    to find real, current prices. If that's ever unavailable, a clearly-labelled
                    modelled estimate is shown instead so a watch never comes back empty.
                  </p>
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
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h2 className="font-display text-base font-bold">What the AI should know about us</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Feeds every search and destination overview, so results are tailored to this
                    family rather than generic.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Resorts / hotels we've liked before</label>
                    <Input
                      value={likedResortsText}
                      onChange={(e) => setLikedResortsText(e.target.value)}
                      placeholder="e.g. Iberostar Selection Anthelia, Sandals Grande St Lucian"
                      className="h-9 rounded-xl bg-card"
                    />
                    <p className="text-[11px] text-muted-foreground">Comma-separated.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Amenities that matter to us</label>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {HOLIDAY_KEY_FEATURES.map((f) => (
                        <label key={f.id} className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-2.5 py-2 text-sm">
                          <Checkbox
                            checked={likedAmenities.includes(f.id)}
                            onCheckedChange={(v) =>
                              setLikedAmenities((prev) =>
                                v === true ? [...prev, f.id] : prev.filter((id) => id !== f.id),
                              )
                            }
                          />
                          {f.label}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">What to look for in reviews</label>
                    <Input
                      value={reviewPrioritiesText}
                      onChange={(e) => setReviewPrioritiesText(e.target.value)}
                      placeholder="e.g. quiet at night, kid-friendly pool, good breakfast"
                      className="h-9 rounded-xl bg-card"
                    />
                    <p className="text-[11px] text-muted-foreground">Comma-separated themes the AI should weigh most.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Anything else the AI should know</label>
                    <Textarea
                      value={preferenceNotes}
                      onChange={(e) => setPreferenceNotes(e.target.value)}
                      placeholder="e.g. we travel with a dog, avoid resorts with lots of stairs, prefer adults-only pool time in the mornings…"
                      className="min-h-[72px] rounded-xl bg-card"
                    />
                  </div>

                  <div className="space-y-1.5 rounded-xl border border-border/40 bg-muted/20 p-3">
                    <label className="text-xs font-semibold text-foreground">Monthly AI research budget (£)</label>
                    <p className="text-[11px] text-muted-foreground">
                      One shared cap across every watch and Explore search. When it's reached, price
                      watches quietly fall back to the free modelled estimate until it resets on the
                      1st — Explore searches pause until then. Leave blank for no cap.
                    </p>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={aiBudgetText}
                      onChange={(e) => setAiBudgetText(e.target.value)}
                      placeholder="No cap"
                      className="h-9 w-32 rounded-xl bg-card"
                    />
                    {(() => {
                      const currentPeriodKey = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, "0")}`;
                      const spend = aiUsage?.periodKey === currentPeriodKey ? aiUsage.spendGbp : 0;
                      const cap = settings.aiMonthlyBudgetGbp;
                      return (
                        <p className="text-xs text-muted-foreground">
                          Spent so far this month: <strong>£{spend.toFixed(2)}</strong>
                          {cap != null ? ` of £${cap.toFixed(2)}` : " (no cap set)"}
                          {cap != null && spend >= cap ? " — budget reached, using free estimates" : ""}
                        </p>
                      );
                    })()}
                  </div>

                  <Button
                    className="h-9 rounded-xl bg-gradient-primary text-primary-foreground border-0"
                    disabled={!canEdit}
                    onClick={async () => {
                      const parsedBudget = aiBudgetText.trim() === "" ? null : Number(aiBudgetText);
                      await saveSettings({
                        ...settings,
                        likedResorts: likedResortsText.split(",").map((s) => s.trim()).filter(Boolean),
                        likedAmenities,
                        reviewPriorities: reviewPrioritiesText.split(",").map((s) => s.trim()).filter(Boolean),
                        preferenceNotes,
                        aiMonthlyBudgetGbp: parsedBudget != null && Number.isFinite(parsedBudget) && parsedBudget >= 0 ? parsedBudget : null,
                      });
                      toast.success("Preferences saved");
                    }}
                  >
                    Save preferences
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="flex max-h-[min(90dvh,calc(100dvh-1.5rem))] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:mx-4"
        >
          <DialogHeader className="shrink-0 border-b border-border/60 px-6 pb-3 pt-14">
            <DialogTitle className="font-display">
              {editing ? "Edit holiday watch" : "New holiday watch"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 [-webkit-overflow-scrolling:touch] touch-pan-y">
            <HolidayWatchForm
              settings={settings}
              initial={editing}
              saving={saving}
              onCancel={() => setFormOpen(false)}
              onSave={handleSave}
            />
          </div>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
};

export default Holidays;

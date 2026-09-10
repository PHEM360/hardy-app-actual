import { useMemo, useState } from "react";
import {
  ExternalLink,
  PoundSterling,
  Star,
  BadgePercent,
  Filter,
  Plane,
  Hotel,
  ClipboardList,
  Lightbulb,
  Sparkles,
  Radar,
  Clock,
  Car,
  Award,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DogLoader from "@/components/DogLoader";
import { useHolidayPrices } from "@/hooks/useHolidays";
import {
  BOOKING_MODE_LABELS,
  HOLIDAY_ACCENT,
  type HolidayBookingMode,
  type HolidayPriceFinding,
  type HolidayWatch,
} from "@/types/holidays";

const INSIGHT_TINT = "hsl(258,55%,52%)";
const TIP_TINT = "hsl(38,92%,50%)";
const SAVING_TINT = "hsl(150,55%,36%)";
const LIVE_TINT = "hsl(150,55%,36%)";
const ESTIMATE_TINT = "hsl(38,92%,45%)";

function fmtMoney(n: number | null | undefined) {
  if (n == null || !Number.isFinite(n)) return "—";
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

function fmtDate(d?: string | null) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return d;
  }
}

function fmtDuration(minutes?: number | null) {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

type SortKey = "suitability" | "price" | "tripadvisor" | "google" | "stars";

function isLiveConfidence(c?: string | null) {
  return c === "ai_researched" || c === "live" || c === "partial";
}

export function HolidayOptionsPanel({
  watch,
  scopeUserId,
  canEdit,
  onLogPrice,
}: {
  watch: HolidayWatch;
  scopeUserId?: string;
  canEdit: boolean;
  onLogPrice: (data: {
    priceGbp: number;
    sourceName: string;
    sourceUrl: string;
    notes?: string;
  }) => Promise<void>;
}) {
  const { prices, loading } = useHolidayPrices(watch.id || null, scopeUserId);
  const [sort, setSort] = useState<SortKey>("suitability");
  const [brandFilter, setBrandFilter] = useState("all");
  const [modeFilter, setModeFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [onlyDiscounts, setOnlyDiscounts] = useState(false);
  const [price, setPrice] = useState("");
  const [source, setSource] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const latestBatch = useMemo(() => {
    const fromWatch = (watch.lastOptions || []) as HolidayPriceFinding[];
    if (fromWatch.length) {
      return fromWatch.map((o, i) => ({
        ...o,
        id: o.id || `opt-${i}`,
        watchId: watch.id || "",
        currency: "GBP" as const,
        foundAt: o.foundAt || watch.lastSearchedAt || new Date().toISOString(),
      }));
    }
    if (!prices.length) return [] as HolidayPriceFinding[];
    const latest = prices[0]?.foundAt;
    const batch = latest ? prices.filter((p) => p.foundAt === latest) : prices.slice(0, 10);
    return batch.length ? batch : prices.slice(0, 10);
  }, [prices, watch.lastOptions, watch.id, watch.lastSearchedAt]);

  const brands = useMemo(
    () => [...new Set(latestBatch.map((p) => p.sourceName).filter(Boolean))],
    [latestBatch],
  );

  const liveCount = useMemo(() => latestBatch.filter((p) => isLiveConfidence(p.priceConfidence)).length, [latestBatch]);

  const filtered = useMemo(() => {
    let rows = [...latestBatch];
    if (brandFilter !== "all") rows = rows.filter((r) => r.sourceName === brandFilter);
    if (modeFilter !== "all") rows = rows.filter((r) => r.bookingMode === modeFilter);
    if (confidenceFilter === "live") rows = rows.filter((r) => isLiveConfidence(r.priceConfidence));
    if (confidenceFilter === "estimated") rows = rows.filter((r) => !isLiveConfidence(r.priceConfidence));
    if (onlyDiscounts) rows = rows.filter((r) => (r.discounts || []).length > 0);
    const cap = Number(maxPrice);
    if (Number.isFinite(cap) && cap > 0) rows = rows.filter((r) => r.priceGbp <= cap);
    rows.sort((a, b) => {
      if (sort === "price") return a.priceGbp - b.priceGbp;
      if (sort === "tripadvisor") return (b.tripadvisorScore || 0) - (a.tripadvisorScore || 0);
      if (sort === "google") return (b.googleScore || 0) - (a.googleScore || 0);
      if (sort === "stars") return (b.officialStars || 0) - (a.officialStars || 0);
      return (b.suitabilityScore || 0) - (a.suitabilityScore || 0) || a.priceGbp - b.priceGbp;
    });
    return rows.slice(0, 10);
  }, [latestBatch, brandFilter, modeFilter, confidenceFilter, onlyDiscounts, maxPrice, sort]);

  const summary = watch.lastSearchSummary;

  const submit = async () => {
    const n = Number(price);
    if (!Number.isFinite(n) || n <= 0 || !source.trim()) return;
    setSaving(true);
    try {
      await onLogPrice({
        priceGbp: n,
        sourceName: source.trim(),
        sourceUrl: url.trim() || `https://www.google.com/search?q=${encodeURIComponent(source)}`,
        notes: "Logged manually",
      });
      setPrice("");
      setSource("");
      setUrl("");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl border-2 bg-card p-4 shadow-elevated"
      style={{ borderColor: `color-mix(in srgb, ${HOLIDAY_ACCENT} 45%, var(--border))` }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold">{watch.title}</h3>
          <p className="text-xs text-muted-foreground">
            {latestBatch.length} option{latestBatch.length === 1 ? "" : "s"} · {liveCount} live-researched, {latestBatch.length - liveCount} modelled
            {watch.scheduleMode === "once"
              ? " · one-off"
              : ` · every ${watch.searchIntervalAmount} ${watch.searchIntervalUnit}`}
            {watch.lastSearchedAt ? ` · last ${fmtDate(watch.lastSearchedAt)}` : ""}
          </p>
        </div>
        {watch.bestPriceUrl && (
          <a
            href={watch.bestPriceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:brightness-110"
            style={{ background: `linear-gradient(135deg, ${HOLIDAY_ACCENT}, color-mix(in srgb, ${HOLIDAY_ACCENT} 70%, black))` }}
          >
            Open best deal <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>

      {summary && (summary.comparisonSummary || summary.otherWorthChecking || (summary.tips || []).length > 0) && (
        <div className="mb-3 space-y-2.5">
          {summary.comparisonSummary && (
            <div
              className="rounded-2xl border-2 p-3.5 shadow-sm"
              style={{
                borderColor: `color-mix(in srgb, ${INSIGHT_TINT} 45%, var(--border))`,
                background: `color-mix(in srgb, ${INSIGHT_TINT} 12%, var(--card))`,
              }}
            >
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: INSIGHT_TINT }}>
                <Sparkles className="h-3.5 w-3.5" /> How the top options compare
              </p>
              <p className="text-sm leading-relaxed">{summary.comparisonSummary}</p>
            </div>
          )}
          {summary.otherWorthChecking && (
            <div
              className="rounded-2xl border-2 p-3.5 shadow-sm"
              style={{
                borderColor: `color-mix(in srgb, ${HOLIDAY_ACCENT} 45%, var(--border))`,
                background: `color-mix(in srgb, ${HOLIDAY_ACCENT} 12%, var(--card))`,
              }}
            >
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: HOLIDAY_ACCENT }}>
                <Radar className="h-3.5 w-3.5" /> Also worth a look
              </p>
              <p className="text-sm leading-relaxed">{summary.otherWorthChecking}</p>
            </div>
          )}
          {(summary.tips || []).length > 0 && (
            <div
              className="rounded-2xl border-2 p-3.5 shadow-sm"
              style={{
                borderColor: `color-mix(in srgb, ${TIP_TINT} 50%, var(--border))`,
                background: `color-mix(in srgb, ${TIP_TINT} 14%, var(--card))`,
              }}
            >
              <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: TIP_TINT }}>
                <Lightbulb className="h-3.5 w-3.5" /> Tips & tricks for this search
              </p>
              <ul className="space-y-1">
                {(summary.tips || []).map((tip, i) => (
                  <li key={i} className="flex gap-1.5 text-sm leading-relaxed">
                    <span style={{ color: TIP_TINT }}>•</span> {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div
        className="mb-3 flex flex-wrap items-end gap-2 rounded-2xl border-2 border-border p-3"
        style={{ background: `color-mix(in srgb, ${HOLIDAY_ACCENT} 8%, var(--muted))` }}
      >
        <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
          <Filter className="h-3.5 w-3.5" /> Sort & filter
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase">Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-[9.5rem] rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="suitability">Suitability</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="tripadvisor">TripAdvisor score</SelectItem>
              <SelectItem value="google">Google score</SelectItem>
              <SelectItem value="stars">Hotel stars</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase">Pricing</Label>
          <Select value={confidenceFilter} onValueChange={setConfidenceFilter}>
            <SelectTrigger className="h-8 w-[9.5rem] rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Live + estimated</SelectItem>
              <SelectItem value="live">Live-researched only</SelectItem>
              <SelectItem value="estimated">Modelled estimate only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase">Book as</Label>
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="h-8 w-[11rem] rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All booking paths</SelectItem>
              <SelectItem value="package">Package</SelectItem>
              <SelectItem value="airline_holiday">Airline holiday</SelectItem>
              <SelectItem value="flights_hotel_separate">Flights + hotel</SelectItem>
              <SelectItem value="hotel_only">Hotel only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase">Brand</Label>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="h-8 w-[10rem] rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {brands.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] font-bold uppercase">Max £</Label>
          <Input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="h-8 w-24 rounded-xl bg-card text-xs"
            placeholder="Any"
          />
        </div>
        <label className="flex h-8 items-center gap-2 rounded-xl border-2 border-border bg-card px-2.5 text-xs font-semibold">
          <input
            type="checkbox"
            checked={onlyDiscounts}
            onChange={(e) => setOnlyDiscounts(e.target.checked)}
          />
          Discounts only
        </label>
      </div>

      {canEdit && (
        <div className="mb-4 grid gap-2 rounded-2xl border-2 border-border p-3 sm:grid-cols-3" style={{ background: `color-mix(in srgb, ${HOLIDAY_ACCENT} 6%, var(--muted))` }}>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wide">Log price £</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 rounded-xl bg-card" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wide">Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} className="h-9 rounded-xl bg-card" placeholder="Jet2Holidays" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold uppercase tracking-wide">Link</Label>
            <div className="flex gap-1.5">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} className="h-9 rounded-xl bg-card" placeholder="https://…" />
              <Button type="button" className="h-9 shrink-0 rounded-xl bg-gradient-primary text-primary-foreground border-0" disabled={saving} onClick={submit}>
                Log
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading && !latestBatch.length ? (
        <DogLoader />
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No matching options yet. Tap Search now, or loosen filters.
        </p>
      ) : (
        <ul className="space-y-3">
          {filtered.map((p, i) => {
            const id = p.id || `${p.sourceName}-${i}`;
            const open = expanded === id;
            const mode = p.bookingMode as HolidayBookingMode | null | undefined;
            const isTop = i === 0;
            const live = isLiveConfidence(p.priceConfidence);
            const outboundDuration = fmtDuration(p.flightDurationMinutes);
            const transferDuration = fmtDuration(p.transferDurationMinutes);
            const hasFlightTimes = p.outboundDepartTime || p.outboundArriveTime;
            return (
              <li
                key={id}
                className="overflow-hidden rounded-2xl border-2 shadow-md"
                style={{
                  borderColor: isTop
                    ? HOLIDAY_ACCENT
                    : `color-mix(in srgb, ${HOLIDAY_ACCENT} 20%, var(--border))`,
                  background: isTop
                    ? `color-mix(in srgb, ${HOLIDAY_ACCENT} 16%, var(--card))`
                    : "var(--card)",
                }}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
                  onClick={() => setExpanded(open ? null : id)}
                >
                  <div
                    className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm"
                    style={{ background: isTop ? HOLIDAY_ACCENT : "color-mix(in srgb, var(--foreground) 35%, var(--muted))" }}
                  >
                    #{p.rank || i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-bold">
                        {p.hotelName || p.packageLabel || p.sourceName}
                      </p>
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white"
                        style={{ background: live ? LIVE_TINT : ESTIMATE_TINT }}
                      >
                        {live ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                        {live ? "Live researched" : "Modelled estimate"}
                      </span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.sourceName}
                      {mode ? ` · ${BOOKING_MODE_LABELS[mode]}` : ""}
                      {p.officialStars != null ? ` · ${p.officialStars}★` : ""}
                      {p.tripadvisorScore != null ? ` · TA ${p.tripadvisorScore}` : ""}
                      {p.googleScore != null ? ` · Google ${p.googleScore}` : ""}
                      {p.suitabilityScore != null ? ` · fit ${p.suitabilityScore}` : ""}
                    </p>
                    {(p.discounts || []).length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-bold" style={{ color: SAVING_TINT }}>
                        <BadgePercent className="h-3 w-3" />
                        {(p.discounts || []).map((d) => d.label).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-lg font-extrabold">{fmtMoney(p.priceGbp)}</p>
                    {p.sourceUrl && (
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold hover:underline"
                        style={{ color: HOLIDAY_ACCENT }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </button>
                {open && (
                  <div className="space-y-3 border-t-2 p-3.5" style={{ borderColor: `color-mix(in srgb, ${HOLIDAY_ACCENT} 20%, var(--border))`, background: "var(--muted)" }}>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {mode && (
                        <span className="rounded-lg border-2 border-border bg-card px-2 py-1 font-semibold">
                          {BOOKING_MODE_LABELS[mode]}
                        </span>
                      )}
                      {p.officialStars != null && (
                        <span className="inline-flex items-center gap-1 rounded-lg border-2 border-border bg-card px-2 py-1 font-semibold">
                          <Star className="h-3 w-3" /> Official {p.officialStars}★
                        </span>
                      )}
                      {p.tripadvisorScore != null && (
                        <span className="rounded-lg border-2 border-border bg-card px-2 py-1 font-semibold">
                          TripAdvisor {p.tripadvisorScore}
                        </span>
                      )}
                      {p.googleScore != null && (
                        <span className="rounded-lg border-2 border-border bg-card px-2 py-1 font-semibold">
                          Google {p.googleScore}
                        </span>
                      )}
                      {p.nights != null && (
                        <span className="rounded-lg border-2 border-border bg-card px-2 py-1 font-semibold">{p.nights} nights</span>
                      )}
                      {p.boardBasis && (
                        <span className="rounded-lg border-2 border-border bg-card px-2 py-1 font-semibold capitalize">
                          {p.boardBasis.replace(/_/g, " ")}
                        </span>
                      )}
                      {p.departureAirport && (
                        <span className="rounded-lg border-2 border-border bg-card px-2 py-1 font-semibold">
                          From {p.departureAirport}
                        </span>
                      )}
                    </div>

                    {(hasFlightTimes || outboundDuration || transferDuration) ? (
                      <div className="rounded-xl border-2 border-border bg-card p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> Flight & transfer times (real, researched)
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {hasFlightTimes && (
                            <div className="flex items-center gap-2 text-xs">
                              <Plane className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span>
                                Out {p.outboundDepartTime || "?"} → {p.outboundArriveTime || "?"}
                                {p.returnDepartTime ? ` · Back ${p.returnDepartTime} → ${p.returnArriveTime || "?"}` : ""}
                                {outboundDuration ? ` (${outboundDuration} flight)` : ""}
                              </span>
                            </div>
                          )}
                          {transferDuration && (
                            <div className="flex items-center gap-2 text-xs">
                              <Car className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              <span>~{transferDuration} airport transfer</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-[11px] italic text-muted-foreground">
                        No real flight schedule found for this option — times aren't guessed.
                      </p>
                    )}

                    {p.loyaltyNote && (
                      <div
                        className="flex items-start gap-2 rounded-xl border-2 p-3"
                        style={{ borderColor: `color-mix(in srgb, ${TIP_TINT} 45%, var(--border))`, background: `color-mix(in srgb, ${TIP_TINT} 12%, var(--card))` }}
                      >
                        <Award className="mt-0.5 h-4 w-4 shrink-0" style={{ color: TIP_TINT }} />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: TIP_TINT }}>Loyalty scheme</p>
                          <p className="mt-0.5 text-xs leading-relaxed">{p.loyaltyNote}</p>
                        </div>
                      </div>
                    )}

                    {p.costBreakdown && (
                      <div className="rounded-xl border-2 border-border bg-card p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          <PoundSterling className="h-3.5 w-3.5" /> Cost breakdown
                          {p.costBreakdown.confidence ? ` · ${p.costBreakdown.confidence}` : ""}
                        </p>
                        <ul className="space-y-1.5">
                          {p.costBreakdown.lines.map((line) => (
                            <li key={`${line.kind}-${line.label}`} className="flex items-start justify-between gap-3 text-xs">
                              <span className="min-w-0 text-foreground/90">
                                <span className="mr-1.5 inline-flex text-muted-foreground">
                                  {line.kind === "flights" ? (
                                    <Plane className="h-3.5 w-3.5" />
                                  ) : line.kind === "hotel" || line.kind === "package" || line.kind === "airport_hotel" ? (
                                    <Hotel className="h-3.5 w-3.5" />
                                  ) : null}
                                </span>
                                {line.label}
                                {line.estimated ? (
                                  <span className="ml-1 text-[10px] text-muted-foreground">(est.)</span>
                                ) : null}
                              </span>
                              <span className={`shrink-0 font-bold ${line.amountGbp < 0 ? "" : ""}`} style={line.amountGbp < 0 ? { color: SAVING_TINT } : undefined}>
                                {fmtMoney(line.amountGbp)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex items-center justify-between border-t-2 border-border pt-2 text-sm font-extrabold">
                          <span>Total for party</span>
                          <span>{fmtMoney(p.costBreakdown.totalGbp || p.priceGbp)}</span>
                        </div>
                      </div>
                    )}

                    {p.independentSummary && (
                      <div className="rounded-xl border-2 border-border bg-card p-3">
                        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          <ClipboardList className="h-3.5 w-3.5" /> Independent review summary
                        </p>
                        <p className="text-xs leading-relaxed text-foreground/90">{p.independentSummary}</p>
                      </div>
                    )}

                    {(p.reviewSummaries || []).map((r) => (
                      <div key={r.source} className="rounded-xl border-2 border-border bg-card px-3 py-2.5">
                        <p className="text-[11px] font-bold">
                          {r.source}
                          {r.score != null ? ` · ${r.score}` : ""}
                          {r.sampleSize ? ` · ${r.sampleSize}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.summary}</p>
                        {!!(r.pros || []).length && (
                          <p className="mt-1 text-[11px] text-foreground/80">
                            <span className="font-bold" style={{ color: SAVING_TINT }}>Pros:</span> {(r.pros || []).join("; ")}
                          </p>
                        )}
                        {!!(r.cons || []).length && (
                          <p className="mt-0.5 text-[11px] text-foreground/80">
                            <span className="font-bold">Watch-outs:</span> {(r.cons || []).join("; ")}
                          </p>
                        )}
                        {!!(r.themes || []).length && (
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Themes: {(r.themes || []).join(" · ")}
                          </p>
                        )}
                      </div>
                    ))}

                    {(p.discounts || []).length > 0 && (
                      <div
                        className="space-y-1 rounded-xl border-2 p-3"
                        style={{ borderColor: `color-mix(in srgb, ${SAVING_TINT} 40%, var(--border))`, background: `color-mix(in srgb, ${SAVING_TINT} 10%, var(--card))` }}
                      >
                        <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: SAVING_TINT }}>
                          Discounts to check
                        </p>
                        {(p.discounts || []).map((d) => (
                          <p key={d.label} className="text-xs">
                            <span className="font-bold">{d.label}</span> — {d.detail}
                            {d.estimatedSavingPct != null ? ` (~${d.estimatedSavingPct}%)` : ""}
                          </p>
                        ))}
                      </div>
                    )}

                    {(p.researchNotes || []).length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Research steps: {(p.researchNotes || []).join(" · ")}
                      </p>
                    )}
                    {(p.whySuitable || []).length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Why it ranked: {(p.whySuitable || []).join(" · ")}
                      </p>
                    )}
                    {p.notes && (
                      <p className="text-[11px] text-muted-foreground">{p.notes}</p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-xl border-2 border-border bg-muted p-2.5 text-[11px] leading-relaxed text-muted-foreground">
        <PoundSterling className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Options are capped at 10 and ranked by fit. Totals are for the whole party. "Live researched" options
        come from an AI web search of real travel sites; "Modelled estimate" options are a structured
        flights + hotel calculation used only when live research isn't available, and are always labelled as such.
      </div>
    </div>
  );
}

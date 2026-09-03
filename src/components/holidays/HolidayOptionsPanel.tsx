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

type SortKey = "suitability" | "price" | "tripadvisor" | "stars";

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

  const filtered = useMemo(() => {
    let rows = [...latestBatch];
    if (brandFilter !== "all") rows = rows.filter((r) => r.sourceName === brandFilter);
    if (modeFilter !== "all") rows = rows.filter((r) => r.bookingMode === modeFilter);
    if (onlyDiscounts) rows = rows.filter((r) => (r.discounts || []).length > 0);
    const cap = Number(maxPrice);
    if (Number.isFinite(cap) && cap > 0) rows = rows.filter((r) => r.priceGbp <= cap);
    rows.sort((a, b) => {
      if (sort === "price") return a.priceGbp - b.priceGbp;
      if (sort === "tripadvisor") return (b.tripadvisorScore || 0) - (a.tripadvisorScore || 0);
      if (sort === "stars") return (b.officialStars || 0) - (a.officialStars || 0);
      return (b.suitabilityScore || 0) - (a.suitabilityScore || 0) || a.priceGbp - b.priceGbp;
    });
    return rows.slice(0, 10);
  }, [latestBatch, brandFilter, modeFilter, onlyDiscounts, maxPrice, sort]);

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
      className="rounded-2xl border border-border/50 bg-card p-4 shadow-card"
      style={{ borderLeftWidth: 4, borderLeftColor: HOLIDAY_ACCENT }}
    >
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-base font-bold">{watch.title}</h3>
          <p className="text-xs text-muted-foreground">
            Ranked research · flights + hotels · package & separate paths
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
            className="inline-flex items-center gap-1 rounded-xl bg-gradient-primary px-3 py-2 text-xs font-semibold text-primary-foreground"
          >
            Open best deal <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2 rounded-xl border border-border/50 bg-muted/25 p-2.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Filter className="h-3.5 w-3.5" /> Filters
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase">Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="h-8 w-[9.5rem] rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="suitability">Suitability</SelectItem>
              <SelectItem value="price">Price</SelectItem>
              <SelectItem value="tripadvisor">TripAdvisor</SelectItem>
              <SelectItem value="stars">Hotel stars</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase">Book as</Label>
          <Select value={modeFilter} onValueChange={setModeFilter}>
            <SelectTrigger className="h-8 w-[11rem] rounded-xl bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All booking paths</SelectItem>
              <SelectItem value="package">Package</SelectItem>
              <SelectItem value="airline_holiday">Airline holiday</SelectItem>
              <SelectItem value="flights_hotel_separate">Flights + hotel</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase">Brand</Label>
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
          <Label className="text-[10px] uppercase">Max £</Label>
          <Input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="h-8 w-24 rounded-xl bg-card text-xs"
            placeholder="Any"
          />
        </div>
        <label className="flex h-8 items-center gap-2 rounded-xl border border-border/50 bg-card px-2.5 text-xs">
          <input
            type="checkbox"
            checked={onlyDiscounts}
            onChange={(e) => setOnlyDiscounts(e.target.checked)}
          />
          Discounts only
        </label>
      </div>

      {canEdit && (
        <div className="mb-4 grid gap-2 rounded-xl border border-border/50 bg-muted/25 p-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide">Log price £</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} className="h-9 rounded-xl bg-card" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide">Source</Label>
            <Input value={source} onChange={(e) => setSource(e.target.value)} className="h-9 rounded-xl bg-card" placeholder="Jet2Holidays" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide">Link</Label>
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
        <ul className="space-y-2.5">
          {filtered.map((p, i) => {
            const id = p.id || `${p.sourceName}-${i}`;
            const open = expanded === id;
            const mode = p.bookingMode as HolidayBookingMode | null | undefined;
            return (
              <li
                key={id}
                className="rounded-xl border border-border/40 bg-card overflow-hidden"
                style={{
                  background:
                    i === 0
                      ? `color-mix(in srgb, ${HOLIDAY_ACCENT} 12%, var(--card))`
                      : undefined,
                }}
              >
                <button
                  type="button"
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
                  onClick={() => setExpanded(open ? null : id)}
                >
                  <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-primary/10 text-[10px] font-bold text-primary">
                    #{p.rank || i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {p.hotelName || p.packageLabel || p.sourceName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {p.sourceName}
                      {mode ? ` · ${BOOKING_MODE_LABELS[mode]}` : ""}
                      {p.officialStars != null ? ` · ${p.officialStars}★` : ""}
                      {p.tripadvisorScore != null ? ` · TA ${p.tripadvisorScore}` : ""}
                      {p.suitabilityScore != null ? ` · fit ${p.suitabilityScore}` : ""}
                    </p>
                    {(p.discounts || []).length > 0 && (
                      <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-primary">
                        <BadgePercent className="h-3 w-3" />
                        {(p.discounts || []).map((d) => d.label).join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-base font-bold">{fmtMoney(p.priceGbp)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.priceConfidence === "estimated"
                        ? "Structured estimate"
                        : p.priceConfidence === "partial"
                          ? "Live + checked"
                          : "Total for party"}
                    </p>
                    {p.sourceUrl && (
                      <a
                        href={p.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex text-muted-foreground hover:text-primary"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                </button>
                {open && (
                  <div className="space-y-3 border-t border-border/40 bg-muted/20 px-3 py-3">
                    <div className="flex flex-wrap gap-2 text-[11px]">
                      {mode && (
                        <span className="rounded-lg bg-card px-2 py-1 font-medium">
                          {BOOKING_MODE_LABELS[mode]}
                        </span>
                      )}
                      {p.officialStars != null && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-card px-2 py-1 font-medium">
                          <Star className="h-3 w-3" /> Official {p.officialStars}★
                        </span>
                      )}
                      {p.tripadvisorScore != null && (
                        <span className="rounded-lg bg-card px-2 py-1 font-medium">
                          TripAdvisor {p.tripadvisorScore}
                        </span>
                      )}
                      {p.nights != null && (
                        <span className="rounded-lg bg-card px-2 py-1 font-medium">{p.nights} nights</span>
                      )}
                      {p.boardBasis && (
                        <span className="rounded-lg bg-card px-2 py-1 font-medium capitalize">
                          {p.boardBasis.replace(/_/g, " ")}
                        </span>
                      )}
                      {p.departureAirport && (
                        <span className="rounded-lg bg-card px-2 py-1 font-medium">
                          From {p.departureAirport}
                        </span>
                      )}
                    </div>

                    {p.costBreakdown && (
                      <div className="rounded-xl border border-border/40 bg-card p-3">
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
                                  ) : line.kind === "hotel" || line.kind === "package" ? (
                                    <Hotel className="h-3.5 w-3.5" />
                                  ) : null}
                                </span>
                                {line.label}
                                {line.estimated ? (
                                  <span className="ml-1 text-[10px] text-muted-foreground">(est.)</span>
                                ) : null}
                              </span>
                              <span className={`shrink-0 font-semibold ${line.amountGbp < 0 ? "text-primary" : ""}`}>
                                {fmtMoney(line.amountGbp)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2 text-sm font-bold">
                          <span>Total for party</span>
                          <span>{fmtMoney(p.costBreakdown.totalGbp || p.priceGbp)}</span>
                        </div>
                      </div>
                    )}

                    {p.independentSummary && (
                      <div className="rounded-xl border border-border/40 bg-card p-3">
                        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          <ClipboardList className="h-3.5 w-3.5" /> Independent review summary
                        </p>
                        <p className="text-xs leading-relaxed text-foreground/90">{p.independentSummary}</p>
                      </div>
                    )}

                    {(p.reviewSummaries || []).map((r) => (
                      <div key={r.source} className="rounded-lg border border-border/40 bg-card px-2.5 py-2">
                        <p className="text-[11px] font-bold">
                          {r.source}
                          {r.score != null ? ` · ${r.score}` : ""}
                          {r.sampleSize ? ` · ${r.sampleSize}` : ""}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.summary}</p>
                        {!!(r.pros || []).length && (
                          <p className="mt-1 text-[11px] text-foreground/80">
                            <span className="font-semibold text-primary">Pros:</span> {(r.pros || []).join("; ")}
                          </p>
                        )}
                        {!!(r.cons || []).length && (
                          <p className="mt-0.5 text-[11px] text-foreground/80">
                            <span className="font-semibold">Watch-outs:</span> {(r.cons || []).join("; ")}
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
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          Discounts to check
                        </p>
                        {(p.discounts || []).map((d) => (
                          <p key={d.label} className="text-xs">
                            <span className="font-semibold">{d.label}</span> — {d.detail}
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

      <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
        <PoundSterling className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Options are capped at 10 and ranked by fit. Totals are for the whole party. Live site numbers
        that look like deposits or fragments are discarded; structured flight + hotel estimates are used instead.
      </div>
    </div>
  );
}

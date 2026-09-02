import { useEffect, useState } from "react";
import { GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreatableMultiSelect } from "@/components/ui/creatable-multi-select";
import {
  BOARD_BASIS_LABELS,
  DATE_MODE_LABELS,
  FLIGHT_BOOKING_LABELS,
  FLIGHT_CLASS_LABELS,
  HOLIDAY_BRAND_OPTIONS,
  MONTH_LABELS,
  type HolidayAlertChannel,
  type HolidayBoardBasis,
  type HolidayBrandPref,
  type HolidayDateMode,
  type HolidayFlightBooking,
  type HolidayFlightClass,
  type HolidaySearchUnit,
  type HolidaySettings,
  type HolidayWatch,
} from "@/types/holidays";

export type HolidayWatchFormValue = Omit<
  HolidayWatch,
  | "id"
  | "createdAt"
  | "updatedAt"
  | "bestPriceGbp"
  | "bestPriceSource"
  | "bestPriceUrl"
  | "bestPriceFoundAt"
  | "lastSearchedAt"
  | "nextSearchAt"
>;

function blankForm(settings: HolidaySettings): HolidayWatchFormValue {
  return {
    title: "",
    destination: "",
    departureAirports: settings.preferredDepartureAirports.slice(0, 2),
    dates: {
      mode: "flexible_days",
      startDate: "",
      endDate: "",
      nights: 7,
      flexDays: 3,
      months: [],
      year: new Date().getFullYear(),
    },
    travellers: { adults: 2, children: 0, infants: 0 },
    brands: settings.preferredBrands.slice(0, 4).map((name, i) => ({ name, rank: i + 1 })),
    flightBooking: "no_preference",
    flightClass: "economy",
    boardBasis: "no_preference",
    directFlightsOnly: false,
    maxStops: undefined,
    hotelStarsMin: undefined,
    maxBudgetGbp: null,
    targetPriceGbp: null,
    includeTransfers: false,
    kidsClub: false,
    poolRequired: false,
    notes: "",
    searchIntervalAmount: settings.defaultSearchIntervalAmount,
    searchIntervalUnit: settings.defaultSearchIntervalUnit,
    alertChannels: [...settings.defaultAlertChannels],
    status: "active",
  };
}

function fromWatch(w: HolidayWatch): HolidayWatchFormValue {
  return {
    title: w.title,
    destination: w.destination,
    departureAirports: w.departureAirports || [],
    dates: {
      mode: w.dates?.mode || "fixed",
      startDate: w.dates?.startDate || "",
      endDate: w.dates?.endDate || "",
      nights: w.dates?.nights ?? 7,
      flexDays: w.dates?.flexDays ?? 3,
      months: w.dates?.months || [],
      year: w.dates?.year || new Date().getFullYear(),
    },
    travellers: {
      adults: w.travellers?.adults ?? 2,
      children: w.travellers?.children ?? 0,
      infants: w.travellers?.infants ?? 0,
    },
    brands: [...(w.brands || [])].sort((a, b) => a.rank - b.rank),
    flightBooking: w.flightBooking || "no_preference",
    flightClass: w.flightClass || "economy",
    boardBasis: w.boardBasis || "no_preference",
    directFlightsOnly: !!w.directFlightsOnly,
    maxStops: w.maxStops,
    hotelStarsMin: w.hotelStarsMin,
    maxBudgetGbp: w.maxBudgetGbp ?? null,
    targetPriceGbp: w.targetPriceGbp ?? null,
    includeTransfers: !!w.includeTransfers,
    kidsClub: !!w.kidsClub,
    poolRequired: !!w.poolRequired,
    notes: w.notes || "",
    searchIntervalAmount: w.searchIntervalAmount || 1,
    searchIntervalUnit: w.searchIntervalUnit || "days",
    alertChannels: w.alertChannels?.length ? [...w.alertChannels] : ["push"],
    status: w.status || "active",
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      {children}
    </div>
  );
}

function BrandRankList({
  brands,
  onChange,
}: {
  brands: HolidayBrandPref[];
  onChange: (b: HolidayBrandPref[]) => void;
}) {
  const names = brands.map((b) => b.name);

  const setNames = (next: string[]) => {
    onChange(next.map((name, i) => ({ name, rank: i + 1 })));
  };

  const move = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= brands.length) return;
    const copy = [...brands];
    const tmp = copy[index];
    copy[index] = copy[j];
    copy[j] = tmp;
    onChange(copy.map((b, i) => ({ ...b, rank: i + 1 })));
  };

  return (
    <div className="space-y-2">
      <CreatableMultiSelect
        value={names}
        onChange={setNames}
        options={HOLIDAY_BRAND_OPTIONS}
        placeholder="Add preferred brands…"
      />
      {brands.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-border/60 bg-muted/30 p-2">
          {brands.map((b, i) => (
            <li
              key={b.name}
              className="flex items-center gap-2 rounded-lg bg-card px-2 py-1.5 text-sm shadow-sm"
            >
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{b.name}</span>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => move(i, -1)}
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground"
                onClick={() => move(i, 1)}
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setNames(names.filter((n) => n !== b.name))}
                aria-label="Remove"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted-foreground">Higher in the list = preferred when comparing deals.</p>
    </div>
  );
}

export function HolidayWatchForm({
  settings,
  initial,
  saving,
  onCancel,
  onSave,
}: {
  settings: HolidaySettings;
  initial?: HolidayWatch | null;
  saving?: boolean;
  onCancel: () => void;
  onSave: (value: HolidayWatchFormValue) => Promise<void>;
}) {
  const [form, setForm] = useState<HolidayWatchFormValue>(() =>
    initial ? fromWatch(initial) : blankForm(settings),
  );

  useEffect(() => {
    setForm(initial ? fromWatch(initial) : blankForm(settings));
  }, [initial, settings]);

  const patch = (p: Partial<HolidayWatchFormValue>) => setForm((f) => ({ ...f, ...p }));
  const patchDates = (p: Partial<HolidayWatchFormValue["dates"]>) =>
    setForm((f) => ({ ...f, dates: { ...f.dates, ...p } }));
  const patchTravellers = (p: Partial<HolidayWatchFormValue["travellers"]>) =>
    setForm((f) => ({ ...f, travellers: { ...f.travellers, ...p } }));

  const toggleAlert = (ch: HolidayAlertChannel, on: boolean) => {
    const set = new Set(form.alertChannels);
    if (on) set.add(ch);
    else set.delete(ch);
    patch({ alertChannels: [...set] });
  };

  const toggleMonth = (month: number) => {
    const set = new Set(form.dates.months || []);
    if (set.has(month)) set.delete(month);
    else set.add(month);
    patchDates({ months: [...set].sort((a, b) => a - b) });
  };

  const mode = form.dates.mode;
  const valid =
    form.destination.trim().length > 0 &&
    form.searchIntervalAmount >= 1 &&
    form.alertChannels.length > 0 &&
    (mode === "no_preference" ||
      mode === "months"
        ? (form.dates.months?.length || 0) > 0
        : Boolean(form.dates.startDate) &&
          (Boolean(form.dates.endDate) || (form.dates.nights || 0) > 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    const title =
      form.title.trim() ||
      `${form.destination.trim()}${form.dates.startDate ? ` · ${form.dates.startDate}` : ""}`;
    await onSave({
      ...form,
      title,
      destination: form.destination.trim(),
      maxBudgetGbp: form.maxBudgetGbp === null || form.maxBudgetGbp === undefined
        ? null
        : Number(form.maxBudgetGbp),
      targetPriceGbp:
        form.targetPriceGbp === null || form.targetPriceGbp === undefined
          ? null
          : Number(form.targetPriceGbp),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Trip name">
        <Input
          value={form.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder="e.g. Crete half-term"
          className="h-9 rounded-xl"
        />
      </Field>

      <Field label="Destination *">
        <Input
          value={form.destination}
          onChange={(e) => patch({ destination: e.target.value })}
          placeholder="City, region or country"
          className="h-9 rounded-xl"
          required
        />
      </Field>

      <Field label="Fly from">
        <CreatableMultiSelect
          value={form.departureAirports}
          onChange={(departureAirports) => patch({ departureAirports })}
          options={settings.preferredDepartureAirports}
          placeholder="Airport codes e.g. LHR"
        />
      </Field>

      <Field label="When">
        <Select
          value={mode}
          onValueChange={(v) => patchDates({ mode: v as HolidayDateMode })}
        >
          <SelectTrigger className="h-9 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(DATE_MODE_LABELS) as HolidayDateMode[]).map((k) => (
              <SelectItem key={k} value={k}>
                {DATE_MODE_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {(mode === "fixed" || mode === "flexible_days") && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Start">
            <Input
              type="date"
              value={form.dates.startDate || ""}
              onChange={(e) => patchDates({ startDate: e.target.value })}
              className="h-9 rounded-xl"
            />
          </Field>
          <Field label="End">
            <Input
              type="date"
              value={form.dates.endDate || ""}
              onChange={(e) => patchDates({ endDate: e.target.value })}
              className="h-9 rounded-xl"
            />
          </Field>
          <Field label="Or nights">
            <Input
              type="number"
              min={1}
              max={60}
              value={form.dates.nights ?? ""}
              onChange={(e) =>
                patchDates({ nights: e.target.value ? Number(e.target.value) : undefined })
              }
              className="h-9 rounded-xl"
            />
          </Field>
          {mode === "flexible_days" && (
            <Field label="± flexible days">
              <Input
                type="number"
                min={0}
                max={30}
                value={form.dates.flexDays ?? 0}
                onChange={(e) => patchDates({ flexDays: Number(e.target.value) || 0 })}
                className="h-9 rounded-xl"
              />
            </Field>
          )}
        </div>
      )}

      {mode === "months" && (
        <div className="space-y-2">
          <Field label="Year">
            <Input
              type="number"
              min={new Date().getFullYear()}
              max={new Date().getFullYear() + 3}
              value={form.dates.year || new Date().getFullYear()}
              onChange={(e) => patchDates({ year: Number(e.target.value) })}
              className="h-9 rounded-xl"
            />
          </Field>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
            {MONTH_LABELS.map((label, i) => {
              const month = i + 1;
              const on = (form.dates.months || []).includes(month);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggleMonth(month)}
                  className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                    on
                      ? "border-primary/45 bg-primary/10 text-foreground"
                      : "border-border/60 bg-card text-muted-foreground hover:bg-muted/40"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <Field label="Nights">
            <Input
              type="number"
              min={1}
              max={60}
              value={form.dates.nights ?? 7}
              onChange={(e) => patchDates({ nights: Number(e.target.value) || 7 })}
              className="h-9 rounded-xl"
            />
          </Field>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2">
        <Field label="Adults">
          <Input
            type="number"
            min={1}
            max={9}
            value={form.travellers.adults}
            onChange={(e) => patchTravellers({ adults: Number(e.target.value) || 1 })}
            className="h-9 rounded-xl"
          />
        </Field>
        <Field label="Children">
          <Input
            type="number"
            min={0}
            max={9}
            value={form.travellers.children}
            onChange={(e) => patchTravellers({ children: Number(e.target.value) || 0 })}
            className="h-9 rounded-xl"
          />
        </Field>
        <Field label="Infants">
          <Input
            type="number"
            min={0}
            max={9}
            value={form.travellers.infants}
            onChange={(e) => patchTravellers({ infants: Number(e.target.value) || 0 })}
            className="h-9 rounded-xl"
          />
        </Field>
      </div>

      <Field label="Preferred brands (ranked)">
        <BrandRankList brands={form.brands} onChange={(brands) => patch({ brands })} />
      </Field>

      <Field label="How to book flights">
        <Select
          value={form.flightBooking}
          onValueChange={(v) => patch({ flightBooking: v as HolidayFlightBooking })}
        >
          <SelectTrigger className="h-9 rounded-xl">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(FLIGHT_BOOKING_LABELS) as HolidayFlightBooking[]).map((k) => (
              <SelectItem key={k} value={k}>
                {FLIGHT_BOOKING_LABELS[k]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Cabin class">
          <Select
            value={form.flightClass}
            onValueChange={(v) => patch({ flightClass: v as HolidayFlightClass })}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FLIGHT_CLASS_LABELS) as HolidayFlightClass[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {FLIGHT_CLASS_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Board basis">
          <Select
            value={form.boardBasis}
            onValueChange={(v) => patch({ boardBasis: v as HolidayBoardBasis })}
          >
            <SelectTrigger className="h-9 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BOARD_BASIS_LABELS) as HolidayBoardBasis[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {BOARD_BASIS_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Max budget £">
          <Input
            type="number"
            min={0}
            placeholder="Optional"
            value={form.maxBudgetGbp ?? ""}
            onChange={(e) =>
              patch({ maxBudgetGbp: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="h-9 rounded-xl"
          />
        </Field>
        <Field label="Alert under £">
          <Input
            type="number"
            min={0}
            placeholder="Target price"
            value={form.targetPriceGbp ?? ""}
            onChange={(e) =>
              patch({ targetPriceGbp: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="h-9 rounded-xl"
          />
        </Field>
      </div>

      <div className="space-y-2 rounded-xl border border-border/60 bg-card p-3">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Direct flights only</span>
          <Switch
            checked={form.directFlightsOnly}
            onCheckedChange={(v) => patch({ directFlightsOnly: v })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Transfers included</span>
          <Switch
            checked={form.includeTransfers}
            onCheckedChange={(v) => patch({ includeTransfers: v })}
          />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Kids club</span>
          <Switch checked={form.kidsClub} onCheckedChange={(v) => patch({ kidsClub: v })} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>Pool required</span>
          <Switch
            checked={form.poolRequired}
            onCheckedChange={(v) => patch({ poolRequired: v })}
          />
        </label>
      </div>

      <Field label="Search every">
        <div className="flex gap-2">
          <Input
            type="number"
            min={1}
            max={90}
            value={form.searchIntervalAmount}
            onChange={(e) => patch({ searchIntervalAmount: Number(e.target.value) || 1 })}
            className="h-9 w-24 rounded-xl"
          />
          <Select
            value={form.searchIntervalUnit}
            onValueChange={(v) => patch({ searchIntervalUnit: v as HolidaySearchUnit })}
          >
            <SelectTrigger className="h-9 flex-1 rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
              <SelectItem value="weeks">Weeks</SelectItem>
              <SelectItem value="months">Months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Field>

      <Field label="Alert me via">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.alertChannels.includes("push")}
              onCheckedChange={(v) => toggleAlert("push", v === true)}
            />
            Push
          </label>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={form.alertChannels.includes("email")}
              onCheckedChange={(v) => toggleAlert("email", v === true)}
            />
            Email
          </label>
        </div>
      </Field>

      <Field label="Notes">
        <Textarea
          value={form.notes || ""}
          onChange={(e) => patch({ notes: e.target.value })}
          placeholder="Anything else — near beach, quiet hotel…"
          className="min-h-[72px] rounded-xl"
        />
      </Field>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1 rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!valid || saving}
          className="flex-1 rounded-xl bg-gradient-primary text-primary-foreground border-0"
        >
          {saving ? "Saving…" : initial ? "Save changes" : "Start watching"}
        </Button>
      </div>
    </form>
  );
}

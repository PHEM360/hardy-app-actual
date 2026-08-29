export type WearableSourceId = "apple_health" | "ringconn";

export interface WearableDaily {
  date: string;
  source: WearableSourceId;
  restingHr?: number;
  avgHr?: number;
  minHr?: number;
  maxHr?: number;
  hrvMs?: number;
  spo2?: number;
  steps?: number;
  sleepMinutes?: number;
  activeCalories?: number;
  vo2max?: number;
}

const KEEP_DAYS = 90;

const APPLE_TYPES = {
  heartRate: "HKQuantityTypeIdentifierHeartRate",
  restingHr: "HKQuantityTypeIdentifierRestingHeartRate",
  hrv: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  steps: "HKQuantityTypeIdentifierStepCount",
  spo2: "HKQuantityTypeIdentifierOxygenSaturation",
  energy: "HKQuantityTypeIdentifierActiveEnergyBurned",
  vo2: "HKQuantityTypeIdentifierVO2Max",
  sleep: "HKCategoryTypeIdentifierSleepAnalysis",
} as const;

function dayKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function parseAppleDate(raw: string): Date | null {
  const parsed = new Date(raw.replace(" +0000", "Z").replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function cutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  cutoff.setHours(0, 0, 0, 0);
  return cutoff;
}

function attrs(tag: string): Record<string, string> {
  const found: Record<string, string> = {};
  const re = /([A-Za-z]+)="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(tag))) found[match[1]] = match[2];
  return found;
}

interface DayBucket {
  hrs: number[];
  resting: number[];
  hrv: number[];
  spo2: number[];
  steps: number;
  sleepMin: number;
  calories: number;
  vo2: number[];
}

function emptyBucket(): DayBucket {
  return { hrs: [], resting: [], hrv: [], spo2: [], steps: 0, sleepMin: 0, calories: 0, vo2: [] };
}

function average(values: number[]): number | undefined {
  if (!values.length) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function toDaily(source: WearableSourceId, buckets: Map<string, DayBucket>): WearableDaily[] {
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, bucket]) => ({
      date,
      source,
      restingHr: average(bucket.resting) ?? average(bucket.hrs.filter((hr) => hr >= 40 && hr <= 80)),
      avgHr: average(bucket.hrs),
      minHr: bucket.hrs.length ? Math.min(...bucket.hrs) : undefined,
      maxHr: bucket.hrs.length ? Math.max(...bucket.hrs) : undefined,
      hrvMs: average(bucket.hrv),
      spo2: average(bucket.spo2),
      steps: bucket.steps || undefined,
      sleepMinutes: bucket.sleepMin || undefined,
      activeCalories: bucket.calories || undefined,
      vo2max: average(bucket.vo2),
    }))
    .filter((day) =>
      day.restingHr || day.avgHr || day.hrvMs || day.spo2 || day.steps || day.sleepMinutes || day.activeCalories || day.vo2max,
    );
}

export function parseAppleHealthExport(xml: string): WearableDaily[] {
  const cutoff = cutoffDate();
  const buckets = new Map<string, DayBucket>();
  const recordRe = /<Record\b([^>]*?)\/?>/g;
  let match: RegExpExecArray | null;

  while ((match = recordRe.exec(xml))) {
    const a = attrs(match[1]);
    const type = a.type || "";
    const start = parseAppleDate(a.startDate || "");
    if (!start || start < cutoff) continue;
    const date = dayKey(start);
    const bucket = buckets.get(date) ?? emptyBucket();
    const value = Number.parseFloat(a.value || "");

    if (type === APPLE_TYPES.heartRate && Number.isFinite(value)) bucket.hrs.push(value);
    else if (type === APPLE_TYPES.restingHr && Number.isFinite(value)) bucket.resting.push(value);
    else if (type === APPLE_TYPES.hrv && Number.isFinite(value)) bucket.hrv.push(value);
    else if (type === APPLE_TYPES.steps && Number.isFinite(value)) bucket.steps += value;
    else if (type === APPLE_TYPES.spo2 && Number.isFinite(value)) bucket.spo2.push(value <= 1 ? value * 100 : value);
    else if (type === APPLE_TYPES.energy && Number.isFinite(value)) bucket.calories += value;
    else if (type === APPLE_TYPES.vo2 && Number.isFinite(value)) bucket.vo2.push(value);
    else if (type === APPLE_TYPES.sleep) {
      const asleep = /Asleep|Core|Deep|REM/i.test(a.value || "");
      const end = parseAppleDate(a.endDate || "");
      if (asleep && end) bucket.sleepMin += Math.max(0, (end.getTime() - start.getTime()) / 60000);
    } else {
      continue;
    }
    buckets.set(date, bucket);
  }

  return toDaily("apple_health", buckets);
}

function headerKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

const CSV_MAP: Record<string, keyof DayBucket | "date"> = {
  date: "date",
  day: "date",
  datetime: "date",
  time: "date",
  resting_hr: "resting",
  resting_heart_rate: "resting",
  rhr: "resting",
  heart_rate: "hrs",
  hr: "hrs",
  avg_hr: "hrs",
  average_hr: "hrs",
  hrv: "hrv",
  hrv_ms: "hrv",
  sdnn: "hrv",
  spo2: "spo2",
  spo2_percent: "spo2",
  oxygen: "spo2",
  steps: "steps",
  step_count: "steps",
  sleep: "sleepMin",
  sleep_min: "sleepMin",
  sleep_minutes: "sleepMin",
  sleep_duration: "sleepMin",
  sleep_hours: "sleepMin",
  calories: "calories",
  active_calories: "calories",
  calorie: "calories",
  vo2: "vo2",
  vo2max: "vo2",
  vo2_max: "vo2",
};

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if ((char === "," || char === ";" || char === "\t") && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseCsvDate(raw: string): string | null {
  if (!raw) return null;
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const uk = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (uk) return `${uk[3]}-${uk[2].padStart(2, "0")}-${uk[1].padStart(2, "0")}`;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : dayKey(parsed);
}

export function parseRingConnCsv(text: string): WearableDaily[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(headerKey);
  const mapped = headers.map((header) => CSV_MAP[header]);
  if (!mapped.includes("date")) return [];

  const cutoff = cutoffDate();
  const buckets = new Map<string, DayBucket>();

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const row: Partial<Record<keyof DayBucket | "date", string>> = {};
    headers.forEach((_, index) => {
      const key = mapped[index];
      if (key) row[key] = cells[index];
    });
    const date = parseCsvDate(row.date || "");
    if (!date) continue;
    const when = new Date(`${date}T12:00:00`);
    if (when < cutoff) continue;
    const bucket = buckets.get(date) ?? emptyBucket();
    const num = (value?: string) => {
      const parsed = Number.parseFloat(value || "");
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const hr = num(row.hrs as string | undefined);
    const resting = num(row.resting as string | undefined);
    const hrv = num(row.hrv as string | undefined);
    const spo2 = num(row.spo2 as string | undefined);
    const steps = num(row.steps as string | undefined);
    const sleep = num(row.sleepMin as string | undefined);
    const calories = num(row.calories as string | undefined);
    const vo2 = num(row.vo2 as string | undefined);
    if (hr !== undefined) bucket.hrs.push(hr);
    if (resting !== undefined) bucket.resting.push(resting);
    if (hrv !== undefined) bucket.hrv.push(hrv);
    if (spo2 !== undefined) bucket.spo2.push(spo2 <= 1 ? spo2 * 100 : spo2);
    if (steps !== undefined) bucket.steps += steps;
    if (sleep !== undefined) bucket.sleepMin += sleep > 24 ? sleep : sleep * 60;
    if (calories !== undefined) bucket.calories += calories;
    if (vo2 !== undefined) bucket.vo2.push(vo2);
    buckets.set(date, bucket);
  }

  return toDaily("ringconn", buckets);
}

export function detectWearableImport(name: string, text: string): WearableDaily[] {
  const lower = name.toLowerCase();
  if (lower.endsWith(".xml") || text.includes("<HealthData") || text.includes("HKQuantityTypeIdentifier")) {
    return parseAppleHealthExport(text);
  }
  return parseRingConnCsv(text);
}

export function summarizeWearableDays(days: WearableDaily[], limit = 14): string {
  const recent = [...days].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  if (!recent.length) return "";
  const lines = recent.map((day) => {
    const bits: string[] = [];
    if (day.restingHr) bits.push(`RHR ${Math.round(day.restingHr)} bpm`);
    if (day.avgHr) bits.push(`avg HR ${Math.round(day.avgHr)} bpm`);
    if (day.hrvMs) bits.push(`HRV ${Math.round(day.hrvMs)} ms`);
    if (day.sleepMinutes) bits.push(`sleep ${(day.sleepMinutes / 60).toFixed(1)} h`);
    if (day.steps) bits.push(`${Math.round(day.steps).toLocaleString("en-GB")} steps`);
    if (day.spo2) bits.push(`SpO2 ${Math.round(day.spo2)}%`);
    if (day.activeCalories) bits.push(`${Math.round(day.activeCalories)} kcal`);
    if (day.vo2max) bits.push(`VO2 ${day.vo2max.toFixed(1)}`);
    return `${day.date} (${day.source === "ringconn" ? "RingConn" : "Apple Health"}): ${bits.join(", ") || "no metrics"}`;
  });
  const withHr = recent.filter((day) => day.restingHr);
  const withSleep = recent.filter((day) => day.sleepMinutes);
  const withSteps = recent.filter((day) => day.steps);
  const avgs: string[] = [];
  if (withHr.length) avgs.push(`avg RHR ${Math.round(average(withHr.map((d) => d.restingHr!))!)} bpm`);
  if (withSleep.length) avgs.push(`avg sleep ${(average(withSleep.map((d) => d.sleepMinutes!))! / 60).toFixed(1)} h`);
  if (withSteps.length) avgs.push(`avg steps ${Math.round(average(withSteps.map((d) => d.steps!))!).toLocaleString("en-GB")}`);
  if (avgs.length) lines.push(`Averages over ${recent.length} days: ${avgs.join("; ")}`);
  return `Wearable data from Apple Watch / Apple Health and RingConn:\n${lines.join("\n")}`;
}

import { useRef, useState } from "react";
import { Activity, Heart, Moon, Smartphone, Upload, Watch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useWearableHealth } from "@/hooks/useWearableHealth";
import { detectWearableImport, type WearableSourceId } from "@/lib/wearableImport";

function latestMetric(days: { date: string }[], pick: (day: typeof days[number]) => number | undefined) {
  const found = days.find((day) => pick(day) != null);
  return found ? { date: found.date, value: pick(found)! } : null;
}

export default function HealthWearables({ scopeUserId }: { scopeUserId?: string }) {
  const { days, sources, importDays } = useWearableHealth(scopeUserId);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingSource, setPendingSource] = useState<WearableSourceId>("apple_health");
  const [busy, setBusy] = useState(false);

  const apple = sources.find((source) => source.id === "apple_health");
  const ring = sources.find((source) => source.id === "ringconn");
  const rhr = latestMetric(days, (day) => (day as { restingHr?: number }).restingHr);
  const hrv = latestMetric(days, (day) => (day as { hrvMs?: number }).hrvMs);
  const sleep = latestMetric(days, (day) => (day as { sleepMinutes?: number }).sleepMinutes);
  const steps = latestMetric(days, (day) => (day as { steps?: number }).steps);

  const pickFile = (source: WearableSourceId) => {
    setPendingSource(source);
    fileRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.name.toLowerCase().endsWith(".zip")) {
      toast.error("Unzip the Apple Health export first, then upload export.xml");
      return;
    }
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = detectWearableImport(file.name, text);
      if (!parsed.length) {
        toast.error("No recent heart rate, sleep or step data found in that file.");
        return;
      }
      const source = parsed[0].source || pendingSource;
      const count = await importDays(source, parsed);
      toast.success(`Imported ${count} day${count === 1 ? "" : "s"} from ${source === "ringconn" ? "RingConn" : "Apple Health"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import that file");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div className="space-y-4 pb-6">
      <input
        ref={fileRef}
        type="file"
        accept=".xml,.csv,text/xml,text/csv"
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          className="rounded-2xl border border-border/40 p-4 shadow-card"
          style={{ background: "color-mix(in srgb, hsl(0,65%,50%) 12%, hsl(var(--card)))", borderLeftWidth: 4, borderLeftColor: "hsl(0,65%,50%)" }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Watch className="h-5 w-5" />
          </span>
          <p className="mt-3 font-display text-base font-bold">Apple Health / Watch</p>
          <p className="mt-1 text-sm text-muted-foreground">
            On iPhone: Health → your picture → Export All Health Data. Unzip the file, then upload <strong>export.xml</strong>.
            Watch and RingConn data already synced to Apple Health come through here.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {apple?.lastImportCount ? `Last import: ${apple.lastImportCount} days` : "Not imported yet"}
          </p>
          <Button className="mt-3 h-9 rounded-xl bg-gradient-primary" disabled={busy} onClick={() => pickFile("apple_health")}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> {busy ? "Importing…" : "Import export.xml"}
          </Button>
        </div>

        <div
          className="rounded-2xl border border-border/40 p-4 shadow-card"
          style={{ background: "color-mix(in srgb, hsl(220,60%,50%) 12%, hsl(var(--card)))", borderLeftWidth: 4, borderLeftColor: "hsl(220,60%,50%)" }}
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
            <Smartphone className="h-5 w-5" />
          </span>
          <p className="mt-3 font-display text-base font-bold">RingConn</p>
          <p className="mt-1 text-sm text-muted-foreground">
            RingConn has no public API. Best path: sync the ring to Apple Health, then import that export.
            Or in the RingConn app use Me → Data Management → Data Export and upload the CSV.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {ring?.lastImportCount ? `Last import: ${ring.lastImportCount} days` : "Not imported yet"}
          </p>
          <Button variant="outline" className="mt-3 h-9 rounded-xl" disabled={busy} onClick={() => pickFile("ringconn")}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> {busy ? "Importing…" : "Import CSV"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          { label: "Resting HR", value: rhr ? `${Math.round(rhr.value)} bpm` : "—", icon: Heart, accent: "hsl(0,65%,50%)" },
          { label: "HRV", value: hrv ? `${Math.round(hrv.value)} ms` : "—", icon: Activity, accent: "hsl(260,55%,55%)" },
          { label: "Sleep", value: sleep ? `${(sleep.value / 60).toFixed(1)} h` : "—", icon: Moon, accent: "hsl(220,60%,50%)" },
          { label: "Steps", value: steps ? Math.round(steps.value).toLocaleString("en-GB") : "—", icon: Activity, accent: "hsl(152,55%,40%)" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-border/40 px-3 py-3 shadow-card"
            style={{ background: `color-mix(in srgb, ${stat.accent} 14%, hsl(var(--card)))`, borderLeftWidth: 4, borderLeftColor: stat.accent }}
          >
            <stat.icon className="mb-1.5 h-4 w-4" style={{ color: stat.accent }} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
            <p className="font-display text-lg font-bold">{stat.value}</p>
          </div>
        ))}
      </div>

      {days.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card shadow-card">
          <p className="border-b border-border/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent wearable days
          </p>
          <div className="divide-y divide-border/40">
            {days.slice(0, 10).map((day) => (
              <div key={`${day.date}_${day.source}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <div>
                  <p className="font-semibold">{day.date}</p>
                  <p className="text-[11px] text-muted-foreground">{day.source === "ringconn" ? "RingConn" : "Apple Health"}</p>
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  {day.restingHr ? `RHR ${Math.round(day.restingHr)}` : ""}
                  {day.sleepMinutes ? ` · ${(day.sleepMinutes / 60).toFixed(1)}h sleep` : ""}
                  {day.steps ? ` · ${Math.round(day.steps).toLocaleString("en-GB")} steps` : ""}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

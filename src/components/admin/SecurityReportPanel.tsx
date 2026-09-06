import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Play,
  RefreshCw,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import DogLoader from "@/components/DogLoader";
import { useSecurityReports } from "@/hooks/useSecurityReports";
import { runSecurityScan, saveSecurityScanPrefs } from "@/lib/securityScanApi";
import type {
  SecurityFinding,
  SecurityFindingSeverity,
  SecurityReport,
  SecurityScanCadence,
} from "@/types/securityReport";
import { explainFinding, explainScore, scoreHeadline } from "@/lib/securityReportCopy";

const ACCENT = "hsl(205,55%,45%)";

const SEVERITY_STYLE: Record<SecurityFindingSeverity, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/30",
  low: "bg-sky-500/15 text-sky-800 dark:text-sky-200 border-sky-500/30",
  info: "bg-muted text-muted-foreground border-border",
};

function scoreColor(score: number) {
  if (score >= 90) return "hsl(152,55%,38%)";
  if (score >= 75) return "hsl(178,55%,36%)";
  if (score >= 60) return "hsl(42,85%,42%)";
  if (score >= 40) return "hsl(25,80%,48%)";
  return "hsl(0,65%,48%)";
}

function fmtWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (score / 100) * c;
  const color = scoreColor(score);
  return (
    <div className="relative mx-auto h-36 w-36">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="10" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-3xl font-bold text-foreground">{score}</span>
        <span className="text-xs font-semibold text-muted-foreground">Grade {grade}</span>
      </div>
    </div>
  );
}

function FindingRow({ finding }: { finding: SecurityFinding }) {
  const plain = explainFinding(finding);
  const [open, setOpen] = useState(finding.severity === "critical" || finding.severity === "high");
  const navigate = useNavigate();
  return (
    <div
      className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card"
      style={{ borderLeftWidth: 4, borderLeftColor: ACCENT }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 p-3.5 text-left"
      >
        <span
          className={`mt-0.5 shrink-0 rounded-lg border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${SEVERITY_STYLE[finding.severity]}`}
        >
          {plain.dealLabel}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{plain.summary}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{plain.impact}</p>
        </div>
        {open ? (
          <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <div className="space-y-2.5 border-t border-border/40 bg-[color-mix(in_srgb,hsl(var(--card))_88%,hsl(var(--background)))] px-3.5 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What this means</p>
            <p className="mt-1 text-sm text-foreground">{plain.meaning}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">How big a deal</p>
            <p className="mt-1 text-sm text-foreground">{plain.impact}</p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">What to do</p>
            <p className="mt-1 text-sm text-foreground">{plain.fix}</p>
          </div>
          {finding.evidence && (
            <p className="text-[11px] text-muted-foreground">Detail: {finding.evidence}</p>
          )}
          {finding.actionPath && (
            <Button
              size="sm"
              variant="outline"
              className="h-8 rounded-xl text-xs"
              onClick={() => navigate(finding.actionPath!)}
            >
              Open that page
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ReportBody({ report }: { report: SecurityReport }) {
  const actionable = useMemo(
    () => report.findings.filter((f) => f.severity !== "info"),
    [report.findings],
  );
  const info = useMemo(
    () => report.findings.filter((f) => f.severity === "info"),
    [report.findings],
  );

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border border-border/50 bg-card p-5 shadow-card"
        style={{
          background: `color-mix(in srgb, ${ACCENT} 12%, var(--card))`,
          borderLeftWidth: 4,
          borderLeftColor: ACCENT,
        }}
      >
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
          <ScoreRing score={report.score} grade={report.grade} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h2 className="font-display text-lg font-bold text-foreground">
                {report.scoreHeadline || scoreHeadline(report.score)}
              </h2>
              <p className="text-xs text-muted-foreground">
                Last scan {fmtWhen(report.createdAtIso)} · {report.triggeredBy}
                {report.durationMs ? ` · ${(report.durationMs / 1000).toFixed(1)}s` : ""}
              </p>
              <p className="mt-2 text-sm text-foreground">
                {report.scoreWhy || explainScore(report)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  ["Critical", report.summary.critical, "critical"],
                  ["High", report.summary.high, "high"],
                  ["Medium", report.summary.medium, "medium"],
                  ["Low", report.summary.low, "low"],
                ] as const
              ).map(([label, n, sev]) => (
                <div key={label} className={`rounded-xl border px-2.5 py-2 ${SEVERITY_STYLE[sev]}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
                  <p className="font-display text-xl font-bold">{n}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Passkeys: {report.summary.passkeyEnrolled} enrolled · {report.summary.passkeyMissing} missing ·{" "}
              {report.summary.usersChecked} profiles checked
            </p>
          </div>
        </div>
      </div>

      {report.recommendations.length > 0 && (
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-bold">Do these first</h3>
          </div>
          <ol className="list-decimal space-y-1.5 pl-4">
            {report.recommendations.map((r) => (
              <li key={r} className="text-xs text-foreground/90">
                {r}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="space-y-2">
        <h3 className="font-display text-sm font-bold">
          What we found ({actionable.length})
        </h3>
        {actionable.length === 0 ? (
          <p className="rounded-2xl border border-border/50 bg-card p-4 text-sm text-muted-foreground shadow-card">
            Nothing here needs a fix. The notes below are strengths.
          </p>
        ) : (
          actionable.map((f) => <FindingRow key={f.id} finding={f} />)
        )}
      </div>

      {info.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Looking good ({info.length})
          </h3>
          {info.map((f) => (
            <FindingRow key={f.id} finding={f} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SecurityReportPanel() {
  const { latest, history, prefs, loading, error } = useSecurityReports(true);
  const [scanning, setScanning] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [cadence, setCadence] = useState<SecurityScanCadence>(prefs.cadence);
  const [enabled, setEnabled] = useState(prefs.enabled);
  const [hourLocal, setHourLocal] = useState(String(prefs.hourLocal ?? 9));
  const [weekday, setWeekday] = useState(String(prefs.weekday ?? 1));
  const [notifyEmail, setNotifyEmail] = useState(prefs.notifyEmail !== false);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    setCadence(prefs.cadence);
    setEnabled(prefs.enabled);
    setHourLocal(String(prefs.hourLocal ?? 9));
    setWeekday(String(prefs.weekday ?? 1));
    setNotifyEmail(prefs.notifyEmail !== false);
  }, [prefs]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const report = await runSecurityScan();
      toast.success(`Scan complete — grade ${report.grade} (${report.score}/100)`);
    } catch (err) {
      toast.error((err as Error)?.message || "Security scan failed");
    } finally {
      setScanning(false);
    }
  };

  const handleSaveSchedule = async () => {
    setSavingPrefs(true);
    try {
      const saved = await saveSecurityScanPrefs({
        cadence: enabled ? cadence : "off",
        enabled,
        hourLocal: Number(hourLocal) || 9,
        weekday: Number(weekday) || 1,
        monthDay: 1,
        notifyEmail,
      });
      toast.success(
        saved.enabled
          ? `Scheduled ${saved.cadence} · next ${fmtWhen(saved.nextRunAt)}`
          : "Scheduled scanning turned off",
      );
    } catch (err) {
      toast.error((err as Error)?.message || "Could not save schedule");
    } finally {
      setSavingPrefs(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="rounded-xl bg-gradient-primary text-primary-foreground border-0"
          disabled={scanning}
          onClick={handleScan}
        >
          {scanning ? (
            <>
              <RefreshCw className="mr-1.5 h-4 w-4 animate-spin" />
              Scanning…
            </>
          ) : (
            <>
              <Play className="mr-1.5 h-4 w-4" />
              Run security scan
            </>
          )}
        </Button>
        {latest && (
          <span className="text-xs text-muted-foreground">
            Last: {fmtWhen(latest.createdAtIso)} · {latest.grade}
          </span>
        )}
      </div>

      <div
        className="space-y-3 rounded-2xl border border-border/50 bg-card p-4 shadow-card"
        style={{
          background: `color-mix(in srgb, ${ACCENT} 10%, var(--card))`,
          borderLeftWidth: 4,
          borderLeftColor: ACCENT,
        }}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="font-display text-sm font-bold">Scheduled scans</h3>
        </div>
        <p className="text-xs text-muted-foreground">
          Run a full posture scan automatically. Emails go to the owner account when enabled.
        </p>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5">
          <Label className="text-sm">Enable schedule</Label>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide">Cadence</Label>
            <Select
              value={cadence}
              onValueChange={(v) => setCadence(v as SecurityScanCadence)}
              disabled={!enabled}
            >
              <SelectTrigger className="h-9 rounded-xl bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide">Hour (local)</Label>
            <Select value={hourLocal} onValueChange={setHourLocal} disabled={!enabled}>
              <SelectTrigger className="h-9 rounded-xl bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {String(i).padStart(2, "0")}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {cadence === "weekly" && (
            <div className="space-y-1">
              <Label className="text-[10px] uppercase tracking-wide">Weekday</Label>
              <Select value={weekday} onValueChange={setWeekday} disabled={!enabled}>
                <SelectTrigger className="h-9 rounded-xl bg-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Monday</SelectItem>
                  <SelectItem value="2">Tuesday</SelectItem>
                  <SelectItem value="3">Wednesday</SelectItem>
                  <SelectItem value="4">Thursday</SelectItem>
                  <SelectItem value="5">Friday</SelectItem>
                  <SelectItem value="6">Saturday</SelectItem>
                  <SelectItem value="0">Sunday</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-3 py-2.5">
          <Label className="text-sm">Email report to owner</Label>
          <Switch checked={notifyEmail} onCheckedChange={setNotifyEmail} disabled={!enabled} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="h-9 rounded-xl bg-gradient-primary text-primary-foreground border-0"
            disabled={savingPrefs}
            onClick={handleSaveSchedule}
          >
            {savingPrefs ? "Saving…" : "Save schedule"}
          </Button>
          <span className="text-[11px] text-muted-foreground">
            {prefs.enabled ? `Next run ${fmtWhen(prefs.nextRunAt)}` : "Not scheduled"}
          </span>
        </div>
      </div>

      {loading && !latest ? (
        <div className="flex justify-center py-12">
          <DogLoader />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-card p-4 text-sm text-destructive shadow-card">
          {error}
        </div>
      ) : !latest ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card"
          style={{
            background: `color-mix(in srgb, ${ACCENT} 12%, var(--card))`,
            borderLeftWidth: 4,
            borderLeftColor: ACCENT,
          }}
        >
          <div
            className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl text-primary-foreground"
            style={{ background: ACCENT }}
          >
            <Shield className="h-6 w-6" />
          </div>
          <h2 className="font-display text-lg font-bold">No scan yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Run a comprehensive scan to score authentication, authorisation, rules posture, hosting headers, and
            account hygiene — with concrete fixes ranked by severity.
          </p>
          <Button
            className="mt-4 rounded-xl bg-gradient-primary text-primary-foreground border-0"
            disabled={scanning}
            onClick={handleScan}
          >
            <Play className="mr-1 h-4 w-4" />
            Run first scan
          </Button>
        </motion.div>
      ) : (
        <ReportBody report={latest} />
      )}

      {history.length > 1 && (
        <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setShowHistory((v) => !v)}
          >
            <span className="font-display text-sm font-bold">Scan history ({history.length})</span>
            {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showHistory && (
            <ul className="mt-3 space-y-2">
              {history.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border border-border/40 bg-muted/20 px-3 py-2 text-xs"
                >
                  <span>
                    {fmtWhen(r.createdAtIso)} · {r.triggeredBy}
                  </span>
                  <span className="font-semibold" style={{ color: scoreColor(r.score) }}>
                    {r.grade} · {r.score}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        This is a family-app health check, not a hacker test. A score in the 60s or 70s usually means tidy-ups,
        not that someone is in. Run a new scan after you deploy so the number matches the current code.
      </p>
    </div>
  );
}

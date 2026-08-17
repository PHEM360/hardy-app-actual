import { useEffect, useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Plane, Plus, Pencil, Trash2, RotateCcw, History, CalendarClock } from "lucide-react";
import { motion } from "framer-motion";
import { format, parseISO } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import DogLoader from "@/components/DogLoader";
import {
  useAnnualLeave,
  calculateEntitlement,
  weekdayCount,
  type EntitlementBreakdown,
} from "@/hooks/useAnnualLeave";
import { useSharedScope } from "@/hooks/useSharedScope";
import type {
  AnnualLeaveEntry,
  AnnualLeavePeriod,
  AnnualLeavePool,
  AnnualLeaveStatus,
  NhsServiceBand,
} from "@/types/app";

const STATUS_META: Record<AnnualLeaveStatus, { label: string; className: string }> = {
  planned: { label: "Planned", className: "bg-muted text-muted-foreground border-border" },
  requested: { label: "Requested", className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900" },
  approved: { label: "Approved", className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-900" },
  rejected: { label: "Rejected", className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900" },
  taken: { label: "Taken", className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900" },
};

const POOL_LABEL: Record<AnnualLeavePool, string> = {
  annual: "Annual Leave",
  bank_holiday: "Bank Holiday",
};

function fmtDays(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

function fmtDate(d: string): string {
  try {
    return format(parseISO(d), "d MMM yyyy");
  } catch {
    return d;
  }
}

const todayISO = () => new Date().toISOString().split("T")[0];

// ── Period form (used for both "start new" and "edit current") ────────────────

interface PeriodFormState {
  label: string;
  startDate: string;
  endDate: string;
  yearsOfService: NhsServiceBand;
  baseDaysOverride: string;
  ltftPercentage: string;
  bankHolidayDaysPerYear: string;
  includeBankHolidays: boolean;
  carriedForwardDays: string;
  daysInLieu: string;
}

function periodToFormState(p?: AnnualLeavePeriod | null, suggestedCarry?: number): PeriodFormState {
  return {
    label: p?.label ?? "",
    startDate: p?.startDate ?? todayISO(),
    endDate: p?.endDate ?? "",
    yearsOfService: p?.yearsOfService ?? "under5",
    baseDaysOverride: p?.baseDaysOverride != null ? String(p.baseDaysOverride) : "",
    ltftPercentage: String(p?.ltftPercentage ?? 100),
    bankHolidayDaysPerYear: String(p?.bankHolidayDaysPerYear ?? 8),
    includeBankHolidays: p?.includeBankHolidays ?? true,
    carriedForwardDays: String(p?.carriedForwardDays ?? (suggestedCarry ? Math.max(0, Math.round(suggestedCarry * 10) / 10) : 0)),
    daysInLieu: String(p?.daysInLieu ?? 0),
  };
}

function formStateToPeriod(f: PeriodFormState): Omit<AnnualLeavePeriod, "id" | "isActive" | "createdAt" | "updatedAt"> {
  return {
    label: f.label.trim() || undefined,
    startDate: f.startDate,
    endDate: f.endDate,
    yearsOfService: f.yearsOfService,
    baseDaysOverride: f.baseDaysOverride.trim() ? Number(f.baseDaysOverride) : undefined,
    ltftPercentage: Number(f.ltftPercentage) || 100,
    bankHolidayDaysPerYear: Number(f.bankHolidayDaysPerYear) || 0,
    includeBankHolidays: f.includeBankHolidays,
    carriedForwardDays: Number(f.carriedForwardDays) || 0,
    daysInLieu: Number(f.daysInLieu) || 0,
  };
}

function PeriodDialog({
  open,
  onOpenChange,
  initial,
  suggestedCarry,
  title,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AnnualLeavePeriod | null;
  suggestedCarry?: number;
  title: string;
  onSave: (data: Omit<AnnualLeavePeriod, "id" | "isActive" | "createdAt" | "updatedAt">) => Promise<void>;
}) {
  const [form, setForm] = useState<PeriodFormState>(() => periodToFormState(initial, suggestedCarry));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setForm(periodToFormState(initial, suggestedCarry));
  }, [open, initial, suggestedCarry]);

  const valid = form.startDate && form.endDate && form.endDate >= form.startDate;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onSave(formStateToPeriod(form));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{title}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1">
            <Label>Rotation / period label</Label>
            <Input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. ST4 Cardiology" className="h-9 rounded-xl" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Start date *</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>End date *</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>NHS service (for base entitlement)</Label>
            <Select value={form.yearsOfService} onValueChange={(v: NhsServiceBand) => setForm((f) => ({ ...f, yearsOfService: v }))}>
              <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="under5">Under 5 years — 27 days/yr</SelectItem>
                <SelectItem value="5plus">5+ years — 32 days/yr</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Override base days/year <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input type="number" step="0.5" value={form.baseDaysOverride} onChange={(e) => setForm((f) => ({ ...f, baseDaysOverride: e.target.value }))} placeholder="Leave blank to use the band above" className="h-9 rounded-xl" />
          </div>
          <div className="space-y-1">
            <Label>Whole-time equivalent (LTFT %) *</Label>
            <Input type="number" min={1} max={100} value={form.ltftPercentage} onChange={(e) => setForm((f) => ({ ...f, ltftPercentage: e.target.value }))} className="h-9 rounded-xl" />
          </div>
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
            <div>
              <p className="text-sm font-medium text-foreground">Include bank holidays</p>
              <p className="text-[11px] text-muted-foreground">Tracked as a separate pot</p>
            </div>
            <Switch checked={form.includeBankHolidays} onCheckedChange={(v) => setForm((f) => ({ ...f, includeBankHolidays: v }))} />
          </div>
          {form.includeBankHolidays && (
            <div className="space-y-1">
              <Label>Bank holiday days/year</Label>
              <Input type="number" step="0.5" value={form.bankHolidayDaysPerYear} onChange={(e) => setForm((f) => ({ ...f, bankHolidayDaysPerYear: e.target.value }))} className="h-9 rounded-xl" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Carried forward</Label>
              <Input type="number" step="0.5" value={form.carriedForwardDays} onChange={(e) => setForm((f) => ({ ...f, carriedForwardDays: e.target.value }))} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>Days in lieu</Label>
              <Input type="number" step="0.5" value={form.daysInLieu} onChange={(e) => setForm((f) => ({ ...f, daysInLieu: e.target.value }))} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-9 rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={!valid || saving} className="flex-1 h-9 rounded-xl bg-gradient-primary">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Entry form ──────────────────────────────────────────────────────────────

interface EntryFormState {
  startDate: string;
  endDate: string;
  days: string;
  pool: AnnualLeavePool;
  status: AnnualLeaveStatus;
  requestedDate: string;
  requestMethod: string;
  notes: string;
}

function entryToFormState(e?: AnnualLeaveEntry | null): EntryFormState {
  const startDate = e?.startDate ?? todayISO();
  const endDate = e?.endDate ?? startDate;
  return {
    startDate,
    endDate,
    days: e ? String(e.days) : String(weekdayCount(startDate, endDate) || 1),
    pool: e?.pool ?? "annual",
    status: e?.status ?? "requested",
    requestedDate: e?.requestedDate ?? todayISO(),
    requestMethod: e?.requestMethod ?? "",
    notes: e?.notes ?? "",
  };
}

function EntryDialog({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: AnnualLeaveEntry | null;
  onSave: (data: EntryFormState) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [form, setForm] = useState<EntryFormState>(() => entryToFormState(initial));
  const [daysTouched, setDaysTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(entryToFormState(initial));
      setDaysTouched(false);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!daysTouched && form.startDate && form.endDate && form.endDate >= form.startDate) {
      const suggested = weekdayCount(form.startDate, form.endDate);
      setForm((f) => ({ ...f, days: String(suggested) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.startDate, form.endDate]);

  const valid = form.startDate && form.endDate && form.endDate >= form.startDate && Number(form.days) > 0;
  const showRequestFields = form.status !== "planned";

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onSave(form);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{initial ? "Edit Leave" : "Add Leave"}</DialogTitle></DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Start date *</Label>
              <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-1">
              <Label>End date *</Label>
              <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} className="h-9 rounded-xl" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Days *</Label>
            <Input type="number" step="0.5" min="0.5" value={form.days} onChange={(e) => { setDaysTouched(true); setForm((f) => ({ ...f, days: e.target.value })); }} className="h-9 rounded-xl" />
            <p className="text-[11px] text-muted-foreground">Defaults to weekdays in range — edit for part-days or non-standard rotas.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Pool</Label>
              <Select value={form.pool} onValueChange={(v: AnnualLeavePool) => setForm((f) => ({ ...f, pool: v }))}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="annual">Annual Leave</SelectItem>
                  <SelectItem value="bank_holiday">Bank Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v: AnnualLeaveStatus) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className="h-9 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planned</SelectItem>
                  <SelectItem value="requested">Requested</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="taken">Taken</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {showRequestFields && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Requested on</Label>
                <Input type="date" value={form.requestedDate} onChange={(e) => setForm((f) => ({ ...f, requestedDate: e.target.value }))} className="h-9 rounded-xl" />
              </div>
              <div className="space-y-1">
                <Label>Via</Label>
                <Input value={form.requestMethod} onChange={(e) => setForm((f) => ({ ...f, requestMethod: e.target.value }))} placeholder="e.g. Email, e-Roster" className="h-9 rounded-xl" />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="rounded-xl min-h-[60px]" />
          </div>
          <div className="flex gap-2 pt-1">
            {initial && onDelete && (
              <Button variant="outline" onClick={onDelete} className="h-9 rounded-xl text-destructive hover:text-destructive">
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 h-9 rounded-xl">Cancel</Button>
            <Button onClick={handleSave} disabled={!valid || saving} className="flex-1 h-9 rounded-xl bg-gradient-primary">
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Stat tile ───────────────────────────────────────────────────────────────

function StatTile({ label, remaining, total, pending }: { label: string; remaining: number; total: number; pending: number }) {
  return (
    <div className="flex-1 min-w-0 bg-white/10 rounded-xl px-3 py-2.5">
      <p className="text-[10px] text-primary-foreground/60 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold text-primary-foreground mt-0.5">{fmtDays(remaining)} <span className="text-xs font-normal text-primary-foreground/60">/ {fmtDays(total)}</span></p>
      {pending > 0 && <p className="text-[11px] text-amber-200 mt-0.5">{fmtDays(pending)} pending</p>}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

const AnnualLeave = () => {
  const { scopeUserId, permission, pageTitle, isOwnScope } = useSharedScope("annual_leave");
  const canEdit = permission === "edit";
  const { periods, entries, loading, error, activePeriod, startNewPeriod, updatePeriod, addEntry, updateEntry, deleteEntry } = useAnnualLeave(scopeUserId ?? undefined);

  const [newPeriodOpen, setNewPeriodOpen] = useState(false);
  const [editPeriodOpen, setEditPeriodOpen] = useState(false);
  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AnnualLeaveEntry | null>(null);
  const [viewPeriodId, setViewPeriodId] = useState<string | null>(null);

  const pastPeriods = periods.filter((p) => !p.isActive);
  const viewedPeriod = viewPeriodId ? periods.find((p) => p.id === viewPeriodId) ?? null : activePeriod;
  const isHistoryView = !!viewPeriodId;

  const breakdown: EntitlementBreakdown | null = viewedPeriod ? calculateEntitlement(viewedPeriod, entries) : null;
  const periodEntries = viewedPeriod
    ? entries.filter((e) => e.periodId === viewedPeriod.id).sort((a, b) => a.startDate.localeCompare(b.startDate))
    : [];

  const suggestedCarry = activePeriod && breakdown ? breakdown.annualRemaining : 0;

  if (loading) {
    return (
      <FeaturePageShell title={pageTitle} subtitle="NHS entitlement tracker & calculator" icon={<Plane className="w-5 h-5" />} sharePage="annual_leave">
        <DogLoader text="Loading your leave…" />
      </FeaturePageShell>
    );
  }

  if (error) {
    return (
      <FeaturePageShell title={pageTitle} subtitle="NHS entitlement tracker & calculator" icon={<Plane className="w-5 h-5" />} sharePage="annual_leave">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <p className="text-sm font-medium text-destructive">Couldn't load your annual leave data.</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle={isOwnScope ? "NHS entitlement tracker & calculator" : "Shared with you"}
      icon={<Plane className="w-5 h-5" />}
      sharePage="annual_leave"
      action={
        canEdit ? (
          <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-1.5" onClick={() => setNewPeriodOpen(true)}>
            <RotateCcw className="w-3.5 h-3.5" /> New period
          </Button>
        ) : undefined
      }
    >
      {!activePeriod ? (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-border bg-card p-8 text-center space-y-3">
          <CalendarClock className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Set up your current rotation to start tracking annual leave.</p>
          {canEdit && (
            <Button onClick={() => setNewPeriodOpen(true)} className="rounded-xl bg-gradient-primary">
              <Plus className="w-4 h-4 mr-1.5" /> Set up rotation
            </Button>
          )}
        </motion.div>
      ) : (
        <>
          {/* Summary */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-gradient-primary mb-5 shadow-elevated">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs text-primary-foreground/70 uppercase tracking-wider font-medium">
                  {isHistoryView ? "Past period" : "Current rotation"}
                </p>
                <p className="text-lg font-bold font-display text-primary-foreground mt-0.5">
                  {viewedPeriod?.label || "Untitled rotation"}
                </p>
                <p className="text-xs text-primary-foreground/70 mt-0.5">
                  {viewedPeriod && `${fmtDate(viewedPeriod.startDate)} – ${fmtDate(viewedPeriod.endDate)}`}
                  {viewedPeriod && ` · ${viewedPeriod.ltftPercentage}% WTE`}
                </p>
              </div>
              {!isHistoryView && canEdit && (
                <button onClick={() => setEditPeriodOpen(true)} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5 text-primary-foreground" />
                </button>
              )}
            </div>
            {breakdown && (
              <div className="flex gap-3 mt-3 flex-wrap">
                <StatTile label="Annual Leave" remaining={breakdown.annualRemaining} total={breakdown.annualTotal} pending={breakdown.annualPending} />
                {viewedPeriod?.includeBankHolidays && (
                  <StatTile label="Bank Holidays" remaining={breakdown.bankHolidayRemaining} total={breakdown.bankHolidayTotal} pending={breakdown.bankHolidayPending} />
                )}
              </div>
            )}
          </motion.div>

          {/* History switcher */}
          {pastPeriods.length > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <History className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              <Select value={viewPeriodId ?? "current"} onValueChange={(v) => setViewPeriodId(v === "current" ? null : v)}>
                <SelectTrigger className="h-8 rounded-lg text-xs flex-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="current">Current rotation</SelectItem>
                  {pastPeriods.map((p) => (
                    <SelectItem key={p.id} value={p.id!}>{p.label || "Untitled"} ({fmtDate(p.startDate)} – {fmtDate(p.endDate)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Entries */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <span className="w-1 h-4 rounded-full bg-gradient-primary inline-block" />
              Leave entries
            </h3>
            {!isHistoryView && canEdit && (
              <Button size="sm" className="h-7 rounded-lg text-xs gap-1 bg-gradient-primary" onClick={() => { setEditingEntry(null); setEntryDialogOpen(true); }}>
                <Plus className="w-3.5 h-3.5" /> Add leave
              </Button>
            )}
          </div>

          {periodEntries.length === 0 ? (
            <div className="p-6 rounded-2xl border border-dashed border-border text-center text-sm text-muted-foreground mb-5">
              No leave logged for this period yet.
            </div>
          ) : (
            <div className="space-y-2 mb-5">
              {periodEntries.map((entry) => {
                const meta = STATUS_META[entry.status];
                return (
                  <button
                    key={entry.id}
                    onClick={() => { if (!isHistoryView && canEdit) { setEditingEntry(entry); setEntryDialogOpen(true); } }}
                    disabled={isHistoryView || !canEdit}
                    className="w-full text-left p-3 rounded-2xl border border-border/50 bg-card shadow-soft hover:shadow-md transition-shadow disabled:hover:shadow-soft"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-card-foreground">
                          {fmtDate(entry.startDate)}{entry.endDate !== entry.startDate ? ` – ${fmtDate(entry.endDate)}` : ""}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {fmtDays(entry.days)} day{entry.days !== 1 ? "s" : ""} · {POOL_LABEL[entry.pool]}
                        </p>
                        {entry.requestedDate && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Requested {fmtDate(entry.requestedDate)}{entry.requestMethod ? ` via ${entry.requestMethod}` : ""}
                          </p>
                        )}
                        {entry.notes && <p className="text-[11px] text-muted-foreground mt-0.5 italic">{entry.notes}</p>}
                      </div>
                      <Badge variant="outline" className={meta.className}>{meta.label}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <PeriodDialog
        open={newPeriodOpen}
        onOpenChange={setNewPeriodOpen}
        title="Start new A/L period"
        suggestedCarry={suggestedCarry}
        onSave={async (data) => { await startNewPeriod(data); }}
      />
      {activePeriod && (
        <PeriodDialog
          open={editPeriodOpen}
          onOpenChange={setEditPeriodOpen}
          title="Edit current period"
          initial={activePeriod}
          onSave={async (data) => { await updatePeriod(activePeriod.id!, data); }}
        />
      )}
      {activePeriod && (
        <EntryDialog
          open={entryDialogOpen}
          onOpenChange={setEntryDialogOpen}
          initial={editingEntry}
          onSave={async (form) => {
            const payload = {
              periodId: activePeriod.id!,
              startDate: form.startDate,
              endDate: form.endDate,
              days: Number(form.days),
              pool: form.pool,
              status: form.status,
              requestedDate: form.status !== "planned" ? form.requestedDate : undefined,
              requestMethod: form.status !== "planned" && form.requestMethod.trim() ? form.requestMethod.trim() : undefined,
              notes: form.notes.trim() || undefined,
            };
            if (editingEntry?.id) {
              await updateEntry(editingEntry.id, payload, editingEntry);
            } else {
              await addEntry(payload);
            }
          }}
          onDelete={editingEntry ? async () => { await deleteEntry(editingEntry); setEntryDialogOpen(false); } : undefined}
        />
      )}
    </FeaturePageShell>
  );
};

export default AnnualLeave;

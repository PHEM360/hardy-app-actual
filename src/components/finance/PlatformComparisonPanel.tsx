import { useEffect, useMemo, useRef, useState } from "react";
import { Scale, Plus, Sparkles, FileUp, Trash2, PencilLine, Trophy, TriangleAlert, ExternalLink, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  OTHER_PROVIDER_ID,
  PLATFORM_ACCOUNT_TYPES,
  PLATFORM_PROVIDERS,
  accountTypeInfo,
  applyPreset,
  blankFields,
  comparePlatforms,
  fieldsForKind,
  missingRequiredFields,
  newPlatformEntry,
  platformPreset,
  providerInfo,
  suggestedPlanId,
  type PlatformAccountType,
  type PlatformComparisonDoc,
  type PlatformEntry,
  type PlatformFieldInfo,
  type PlatformFieldKey,
  type PlatformResult,
  type PlatformValueSource,
} from "@/lib/platformComparison";
import { extractPlatformDocument, fillPlatformGaps, type PlatformAssistResult } from "@/lib/platformCompareApi";

// Each account card takes the next colour, and keeps it in the results.
const ENTRY_COLORS = ["#22407A", "#7A2E2A", "#3A2A5E", "#1F4D3A", "#6E1F2F", "#17475C", "#8A6424"];
const NAVY = "hsl(215 35% 18%)";
const FIELD_LABEL = "text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70";

const SOURCE_BADGE: Record<PlatformValueSource, { label: string; className: string }> = {
  preset: { label: "Published", className: "bg-[hsl(215_35%_18%)] text-white" },
  user: { label: "You", className: "bg-[#1B5E5A] text-white" },
  ai: { label: "AI", className: "bg-[#3A2A5E] text-white" },
  document: { label: "Document", className: "bg-[#22407A] text-white" },
};

function money(n: number): string {
  const rounded = Math.round(n);
  return `${rounded < 0 ? "-" : ""}£${Math.abs(rounded).toLocaleString("en-GB")}`;
}

function optionClass(active: boolean) {
  return `rounded-md border px-3 py-2 text-xs font-bold transition-colors ${
    active
      ? "btn-edge border-[var(--sec)] bg-[var(--sec)] text-white"
      : "border-foreground/20 bg-card text-foreground hover:border-[var(--sec)] hover:text-[var(--sec)]"
  }`;
}

/** Merges AI or document figures into an entry. Never overwrites what the user typed unless told to. */
function applyAssist(entry: PlatformEntry, result: PlatformAssistResult, source: "ai" | "document"): { entry: PlatformEntry; filled: number } {
  const values = { ...entry.values };
  const sources = { ...entry.sources };
  const notes = { ...entry.notes };
  let filled = 0;
  for (const [key, value] of Object.entries(result.values) as [PlatformFieldKey, number | null][]) {
    if (value === null || value === undefined) continue;
    // AI only fills blanks. A document the user uploaded outranks published and AI figures, but not their own typing.
    const existing = sources[key];
    if (source === "ai" && values[key] !== null && values[key] !== undefined) continue;
    if (source === "document" && existing === "user") continue;
    values[key] = value;
    sources[key] = source;
    if (result.notes[key]) notes[key] = result.notes[key];
    else delete notes[key];
    filled += 1;
  }
  return { entry: { ...entry, values, sources, notes }, filled };
}

function PotSettings({ doc, onChange, disabled }: { doc: PlatformComparisonDoc; onChange: (patch: Partial<PlatformComparisonDoc>) => void; disabled: boolean }) {
  const numberInput = (value: number, onValue: (n: number) => void, prefix?: string, suffix?: string) => (
    <div className="relative">
      {prefix && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>}
      <Input
        type="number"
        min={0}
        disabled={disabled}
        value={value || ""}
        placeholder="0"
        onChange={(e) => onValue(Math.max(0, Number(e.target.value) || 0))}
        className={`h-10 ${prefix ? "pl-6" : ""} ${suffix ? "pr-10" : ""}`}
      />
      {suffix && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
    </div>
  );
  return (
    <div className="space-y-3 rounded-lg border border-foreground/20 bg-card p-3">
      <div className="space-y-1.5">
        <p className={FIELD_LABEL}>Compare on</p>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" disabled={disabled} onClick={() => onChange({ useSharedPot: true })} className={optionClass(doc.useSharedPot)}>
            The same pot for all
          </button>
          <button type="button" disabled={disabled} onClick={() => onChange({ useSharedPot: false })} className={optionClass(!doc.useSharedPot)}>
            Each account's own pot
          </button>
        </div>
        <p className="text-[11px] font-medium text-foreground/70">
          {doc.useSharedPot
            ? "Every account is tested with the same money, so only the charges and rates differ. This is the fair way to compare."
            : "Each account uses the balance and monthly amount on its own card."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {doc.useSharedPot && (
          <>
            <div className="space-y-1">
              <Label className={FIELD_LABEL}>Pot size</Label>
              {numberInput(doc.sharedBalance, (n) => onChange({ sharedBalance: n }), "£")}
            </div>
            <div className="space-y-1">
              <Label className={FIELD_LABEL}>Paying in each month</Label>
              {numberInput(doc.sharedMonthly, (n) => onChange({ sharedMonthly: n }), "£")}
            </div>
          </>
        )}
        <div className="space-y-1">
          <Label className={FIELD_LABEL}>Investment growth before fees</Label>
          {numberInput(doc.assumedReturnPercent, (n) => onChange({ assumedReturnPercent: n }), undefined, "%/yr")}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className={FIELD_LABEL}>Over how long</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 5, 10, 20, 30].map((y) => (
            <button key={y} type="button" disabled={disabled} onClick={() => onChange({ years: y })} className={optionClass(doc.years === y)}>
              {y} {y === 1 ? "year" : "years"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EntryCard({
  entry, color, doc, disabled, busy, onChange, onRemove, onFill, onUpload,
}: {
  entry: PlatformEntry;
  color: string;
  doc: PlatformComparisonDoc;
  disabled: boolean;
  busy: boolean;
  onChange: (next: PlatformEntry) => void;
  onRemove: () => void;
  onFill: () => void;
  onUpload: (file: File) => void;
}) {
  const info = accountTypeInfo(entry.accountType);
  const provider = providerInfo(entry.providerId);
  const preset = platformPreset(entry.providerId, entry.accountType, entry.planId);
  const fields = fieldsForKind(info.kind);
  const blanks = blankFields(entry);
  const fileRef = useRef<HTMLInputElement>(null);
  const balance = doc.useSharedPot ? doc.sharedBalance : entry.balance;
  const coreTooSmall = entry.providerId === "interactive_investor" && entry.planId === "core" && suggestedPlanId(entry.providerId, balance) !== "core";

  const setValue = (field: PlatformFieldInfo, raw: string) => {
    const values = { ...entry.values };
    const sources = { ...entry.sources };
    const notes = { ...entry.notes };
    delete notes[field.key];
    if (raw === "") {
      delete values[field.key];
      delete sources[field.key];
    } else {
      values[field.key] = Math.max(0, Number(raw) || 0);
      sources[field.key] = "user";
    }
    onChange({ ...entry, values, sources, notes });
  };

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card" style={{ ["--sec" as string]: color }}>
      <div className="flex items-center gap-3 band bg-[var(--sec)] px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base font-bold leading-tight">{entry.providerName}</p>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">{info.label}</p>
        </div>
        {!disabled && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${entry.providerName}`} className="shrink-0 rounded-md bg-black/20 p-2 text-white transition-colors hover:bg-white hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="space-y-3 p-4">
        {provider && provider.plans.length > 0 && (
          <div className="space-y-1.5">
            <p className={FIELD_LABEL}>Plan</p>
            <div className="flex flex-wrap gap-1.5">
              {provider.plans.map((plan) => (
                <button key={plan.id} type="button" disabled={disabled} onClick={() => onChange(applyPreset({ ...entry, planId: plan.id }))} className={optionClass(entry.planId === plan.id)}>
                  {plan.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {coreTooSmall && (
          <p className="flex items-start gap-2 rounded-lg bg-[#C9A24A] p-3 text-xs font-bold text-[#2A2110]">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            This pot is over the Core plan's £100,000 limit. Pick Plus for a true cost.
          </p>
        )}

        {preset && (
          <div className="rounded-lg border-l-4 border-[var(--sec)] bg-[color-mix(in_srgb,var(--sec)_12%,hsl(var(--card)))] p-3">
            <p className={FIELD_LABEL}>{entry.providerName}'s published charges</p>
            <ul className="mt-1.5 space-y-1">
              {preset.rules.map((rule) => (
                <li key={rule} className="flex items-start gap-2 text-xs font-medium leading-snug">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-[var(--sec)]" />
                  {rule}
                </li>
              ))}
            </ul>
            {provider && (
              <a href={provider.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[var(--sec)] underline underline-offset-2">
                Checked {provider.checked}. See their current charges <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        )}

        {!doc.useSharedPot && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className={FIELD_LABEL}>Balance</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
                <Input type="number" min={0} disabled={disabled} value={entry.balance || ""} placeholder="0" onChange={(e) => onChange({ ...entry, balance: Math.max(0, Number(e.target.value) || 0) })} className="h-10 pl-6" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className={FIELD_LABEL}>Paying in each month</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>
                <Input type="number" min={0} disabled={disabled} value={entry.monthlyContribution || ""} placeholder="0" onChange={(e) => onChange({ ...entry, monthlyContribution: Math.max(0, Number(e.target.value) || 0) })} className="h-10 pl-6" />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-2 gap-y-3">
          {fields.map((field) => {
            const v = entry.values[field.key];
            const source = entry.sources[field.key];
            const blank = v === null || v === undefined;
            const required = !field.optional && blank;
            return (
              <div key={field.key} className="min-w-0 space-y-1">
                <div className="flex min-h-[1.25rem] items-center gap-1.5">
                  <Label className={`${FIELD_LABEL} min-w-0 truncate`} title={field.label}>{field.label}</Label>
                  {source && !blank && (
                    <span className={`shrink-0 rounded-sm px-1 py-0.5 text-[8px] font-bold uppercase tracking-wide ${SOURCE_BADGE[source].className}`}>{SOURCE_BADGE[source].label}</span>
                  )}
                </div>
                <div className="relative">
                  {field.unit === "£" && <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">£</span>}
                  <Input
                    type="number"
                    min={0}
                    step="any"
                    disabled={disabled}
                    value={blank ? "" : v}
                    placeholder={required ? "Needed" : field.key === "annualReturnPercent" ? `${doc.assumedReturnPercent} shared` : "None"}
                    aria-label={field.label}
                    title={field.hint}
                    onChange={(e) => setValue(field, e.target.value)}
                    className={`h-10 ${field.unit === "£" ? "pl-6" : ""} ${field.unit === "%" ? "pr-7" : ""} ${required ? "border-[#B7791F] bg-amber-50 dark:bg-amber-950/40" : ""}`}
                  />
                  {field.unit === "%" && <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>}
                </div>
                {entry.notes[field.key] && !blank && <p className="text-[10px] font-medium leading-snug text-foreground/70">{entry.notes[field.key]}</p>}
              </div>
            );
          })}
        </div>

        {!disabled && (
          <div className="flex flex-wrap gap-2 border-t-2 border-foreground/10 pt-3">
            <Button size="sm" variant="outline" disabled={busy || blanks.length === 0} onClick={onFill}>
              {busy ? <Loader2 className="animate-spin" /> : <Sparkles />} {blanks.length === 0 ? "No gaps to fill" : `Fill ${blanks.length} ${blanks.length === 1 ? "gap" : "gaps"} with AI`}
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              <FileUp /> Read a document
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onUpload(file);
              }}
            />
            <p className="basis-full text-[11px] font-medium text-foreground/70">Best document: {info.document}.</p>
          </div>
        )}
      </div>
    </div>
  );
}

type GuideStep = "type" | "provider" | "plan" | "method" | "working" | "review";

interface GuideLine {
  from: "ai" | "you";
  text: string;
}

/**
 * The guided route. The questions and their order are fixed here so the flow
 * is always reliable; AI is used for the two jobs it is good at: looking up
 * figures the app does not hold and reading them out of a document.
 */
function GuidedAdd({ doc, onAdd, onCancel }: { doc: PlatformComparisonDoc; onAdd: (entry: PlatformEntry) => void; onCancel: () => void }) {
  const [step, setStep] = useState<GuideStep>("type");
  const [lines, setLines] = useState<GuideLine[]>([{ from: "ai", text: "I will walk you through adding an account. First, what kind of account is it?" }]);
  const [accountType, setAccountType] = useState<PlatformAccountType>("stocks_isa");
  const [entry, setEntry] = useState<PlatformEntry | null>(null);
  const [otherName, setOtherName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const say = (...next: GuideLine[]) => setLines((current) => [...current, ...next]);
  const balance = doc.useSharedPot ? doc.sharedBalance : 0;

  const describeNeeds = (candidate: PlatformEntry) => {
    const info = accountTypeInfo(candidate.accountType);
    const preset = platformPreset(candidate.providerId, candidate.accountType, candidate.planId);
    const needs = blankFields(candidate).map((f) => f.label.toLowerCase());
    const known = preset
      ? `I already hold ${candidate.providerName}'s published charges for this: ${preset.rules.join(" ")}`
      : info.kind === "cash"
        ? `Interest rates change too often for me to hold them, so I need the current one for ${candidate.providerName}.`
        : `I do not hold ${candidate.providerName}'s charges, so I need them from you, a document or a lookup.`;
    return `${known} Still to fill: ${needs.join(", ")}. How would you like to give me those?`;
  };

  const chooseType = (type: PlatformAccountType) => {
    setAccountType(type);
    say({ from: "you", text: accountTypeInfo(type).label }, { from: "ai", text: "Which provider is it with?" });
    setStep("provider");
  };

  const chooseProvider = (providerId: string, providerName: string) => {
    const provider = providerInfo(providerId);
    const planId = suggestedPlanId(providerId, balance);
    const candidate = newPlatformEntry(accountType, providerId, providerName, planId);
    setEntry(candidate);
    if (provider && provider.plans.length > 0 && accountTypeInfo(accountType).kind === "invest") {
      const suggestion = provider.plans.find((p) => p.id === planId)?.label;
      say({ from: "you", text: providerName }, { from: "ai", text: `Which ${providerName} plan? For a pot of ${money(balance)} the usual fit is ${suggestion}.` });
      setStep("plan");
    } else {
      say({ from: "you", text: providerName }, { from: "ai", text: describeNeeds(candidate) });
      setStep("method");
    }
  };

  const choosePlan = (planId: string, label: string) => {
    if (!entry) return;
    const candidate = applyPreset({ ...entry, planId });
    setEntry(candidate);
    say({ from: "you", text: label }, { from: "ai", text: describeNeeds(candidate) });
    setStep("method");
  };

  const finish = (candidate: PlatformEntry, result: PlatformAssistResult, source: "ai" | "document") => {
    const applied = applyAssist(candidate, result, source);
    setEntry(applied.entry);
    const found = fieldsForKind(accountTypeInfo(candidate.accountType).kind)
      .filter((f) => applied.entry.sources[f.key] === source)
      .map((f) => `${f.label}: ${f.unit === "£" ? "£" : ""}${applied.entry.values[f.key]}${f.unit === "%" ? "%" : ""}`);
    const stillBlank = missingRequiredFields(applied.entry).map((f) => f.label.toLowerCase());
    say({
      from: "ai",
      text: [
        found.length > 0 ? `Here is what I found. ${found.join(". ")}.` : "I could not find any of those figures.",
        result.summary,
        stillBlank.length > 0 ? `Still needed: ${stillBlank.join(", ")}. You can type these on the card.` : "That is everything I need.",
        source === "ai" ? "These are AI figures and may be out of date, so check them against the provider before relying on them." : "",
      ].filter(Boolean).join(" "),
    });
    setStep("review");
  };

  const lookUp = async () => {
    if (!entry) return;
    say({ from: "you", text: "Look them up for me" });
    setStep("working");
    try {
      finish(entry, await fillPlatformGaps(entry, blankFields(entry), balance), "ai");
    } catch (err) {
      say({ from: "ai", text: `That lookup failed. ${err instanceof Error ? err.message : ""} You can type the figures instead.` });
      setStep("method");
    }
  };

  const readDocument = async (file: File) => {
    if (!entry) return;
    say({ from: "you", text: `Uploaded ${file.name}` });
    setStep("working");
    try {
      const fields = fieldsForKind(accountTypeInfo(entry.accountType).kind).filter((f) => f.key !== "tradesPerYear");
      finish(entry, await extractPlatformDocument(entry, fields, balance, file), "document");
    } catch (err) {
      say({ from: "ai", text: `I could not read that. ${err instanceof Error ? err.message : ""} Try another file, or type the figures.` });
      setStep("method");
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card" style={{ ["--sec" as string]: "#3A2A5E" }}>
      <div className="flex items-center gap-3 band bg-[var(--sec)] px-4 py-3 text-white">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/20"><Sparkles className="h-4 w-4" /></span>
        <p className="min-w-0 flex-1 font-display text-base font-bold leading-tight">Guided setup</p>
        <button type="button" onClick={onCancel} aria-label="Close guided setup" className="shrink-0 rounded-md bg-black/20 p-2 text-white transition-colors hover:bg-white hover:text-[var(--sec)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3 p-4">
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className={`flex ${line.from === "you" ? "justify-end" : "justify-start"}`}>
              <p className={`max-w-[88%] rounded-lg px-3 py-2 text-sm font-medium leading-snug ${line.from === "you" ? "bg-[var(--sec)] text-white" : "border border-foreground/20 bg-secondary text-foreground"}`}>
                {line.text}
              </p>
            </div>
          ))}
          {step === "working" && (
            <p className="flex items-center gap-2 text-sm font-bold text-[var(--sec)]"><Loader2 className="h-4 w-4 animate-spin" /> Working on it</p>
          )}
        </div>

        {step === "type" && (
          <div className="flex flex-wrap gap-1.5">
            {PLATFORM_ACCOUNT_TYPES.map((t) => (
              <button key={t.id} type="button" onClick={() => chooseType(t.id)} className={optionClass(false)}>{t.label}</button>
            ))}
          </div>
        )}

        {step === "provider" && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PLATFORM_PROVIDERS.map((p) => (
                <button key={p.id} type="button" onClick={() => chooseProvider(p.id, p.name)} className={optionClass(false)}>{p.name}</button>
              ))}
            </div>
            <div className="flex gap-2">
              <Input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Another provider, e.g. a bank" className="h-10 min-w-0 flex-1" onKeyDown={(e) => { if (e.key === "Enter" && otherName.trim()) chooseProvider(OTHER_PROVIDER_ID, otherName.trim()); }} />
              <Button variant="outline" className="h-10 shrink-0" disabled={!otherName.trim()} onClick={() => chooseProvider(OTHER_PROVIDER_ID, otherName.trim())}>Use this</Button>
            </div>
          </div>
        )}

        {step === "plan" && entry && (
          <div className="flex flex-wrap gap-1.5">
            {providerInfo(entry.providerId)?.plans.map((plan) => (
              <button key={plan.id} type="button" onClick={() => choosePlan(plan.id, plan.label)} className={optionClass(false)}>{plan.label}</button>
            ))}
          </div>
        )}

        {step === "method" && entry && (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => fileRef.current?.click()}><FileUp /> Upload a document</Button>
              <Button size="sm" variant="outline" onClick={() => void lookUp()}><Sparkles /> Look them up for me</Button>
              <Button size="sm" variant="outline" onClick={() => onAdd(entry)}><PencilLine /> I will type them</Button>
            </div>
            <p className="rounded-lg border-l-4 border-[var(--sec)] bg-[color-mix(in_srgb,var(--sec)_12%,hsl(var(--card)))] p-3 text-xs font-medium leading-snug">
              <strong>Which document:</strong> {accountTypeInfo(entry.accountType).document}. A PDF or a clear photo both work.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void readDocument(file);
              }}
            />
          </div>
        )}

        {step === "review" && entry && (
          <Button onClick={() => onAdd(entry)}><Plus /> Add to the comparison</Button>
        )}
      </div>
    </div>
  );
}

function ManualAdd({ doc, onAdd, onCancel }: { doc: PlatformComparisonDoc; onAdd: (entry: PlatformEntry) => void; onCancel: () => void }) {
  const [accountType, setAccountType] = useState<PlatformAccountType>("stocks_isa");
  const [providerId, setProviderId] = useState(PLATFORM_PROVIDERS[0].id);
  const [otherName, setOtherName] = useState("");
  const isOther = providerId === OTHER_PROVIDER_ID;
  const add = () => {
    const name = isOther ? otherName.trim() : providerInfo(providerId)?.name ?? "";
    if (!name) return;
    const balance = doc.useSharedPot ? doc.sharedBalance : 0;
    onAdd(newPlatformEntry(accountType, providerId, name, suggestedPlanId(providerId, balance)));
  };
  return (
    <div className="space-y-3 rounded-xl border border-foreground/20 bg-card p-4 shadow-card" style={{ ["--sec" as string]: "#22407A" }}>
      <div className="space-y-1.5">
        <p className={FIELD_LABEL}>Account type</p>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_ACCOUNT_TYPES.map((t) => (
            <button key={t.id} type="button" onClick={() => setAccountType(t.id)} className={optionClass(accountType === t.id)}>{t.label}</button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className={FIELD_LABEL}>Provider</p>
        <div className="flex flex-wrap gap-1.5">
          {PLATFORM_PROVIDERS.map((p) => (
            <button key={p.id} type="button" onClick={() => setProviderId(p.id)} className={optionClass(providerId === p.id)}>{p.name}</button>
          ))}
          <button type="button" onClick={() => setProviderId(OTHER_PROVIDER_ID)} className={optionClass(isOther)}>Another provider</button>
        </div>
        {isOther && <Input autoFocus value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Provider name" className="h-10" />}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button onClick={add} disabled={isOther && !otherName.trim()}><Plus /> Add account</Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

function Results({ doc, results, colorFor }: { doc: PlatformComparisonDoc; results: PlatformResult[]; colorFor: (id: string) => string }) {
  const complete = results.filter((r) => r.missing.length === 0);
  const top = complete[0];
  const runnerUp = complete[1];
  const best = Math.max(1, ...complete.map((r) => r.finalValue));
  const cheapest = complete.length > 0 ? Math.min(...complete.map((r) => r.totalFees)) : 0;
  const mixed = new Set(results.map((r) => r.kind)).size > 1;
  const nameOf = (id: string) => doc.entries.find((e) => e.id === id);
  const yearsLabel = `${doc.years} ${doc.years === 1 ? "year" : "years"}`;

  return (
    <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
      <div className="band flex items-center gap-3 px-4 py-3 text-white" style={{ backgroundColor: NAVY }}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/15"><Trophy className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-tight">The comparison</p>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">Ranked by what you would have after {yearsLabel}</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        {top && runnerUp && (
          <p className="btn-edge rounded-lg bg-[#1F6B4F] p-3 text-sm font-bold text-white">
            {nameOf(top.entryId)?.providerName} comes out {money(top.finalValue - runnerUp.finalValue)} ahead of {nameOf(runnerUp.entryId)?.providerName} after {yearsLabel}.
          </p>
        )}
        <div className="grid gap-2 lg:grid-cols-2">
          {results.map((result, index) => {
            const entry = nameOf(result.entryId);
            if (!entry) return null;
            const incomplete = result.missing.length > 0;
            const isTop = !incomplete && index === 0 && complete.length > 1;
            return (
              <div key={result.entryId} className={`overflow-hidden rounded-lg border-2 bg-card ${isTop ? "border-[#1F6B4F]" : "border-foreground/15"}`} style={{ ["--sec" as string]: colorFor(result.entryId) }}>
                <div className="flex items-center gap-2.5 border-b-2 border-foreground/10 p-3">
                  <span className={`btn-edge flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold text-white ${incomplete ? "bg-[#B7791F]" : ""}`} style={incomplete ? undefined : { background: isTop ? "#1F6B4F" : "var(--sec)" }}>
                    {incomplete ? "?" : index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{entry.providerName}</p>
                    <p className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/65">{accountTypeInfo(entry.accountType).label}</p>
                  </div>
                  {!incomplete && (
                    <div className="shrink-0 text-right">
                      <p className="font-display text-lg font-bold tabular-nums leading-tight">{money(result.finalValue)}</p>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/65">after {yearsLabel}</p>
                    </div>
                  )}
                </div>
                {incomplete ? (
                  <p className="flex items-start gap-2 bg-[#C9A24A] p-3 text-xs font-bold text-[#2A2110]">
                    <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                    Not ranked yet. Still needed: {result.missing.map((f) => f.label.toLowerCase()).join(", ")}.
                  </p>
                ) : (
                  <div className="space-y-2 p-3">
                    <div className="h-2.5 overflow-hidden rounded-full bg-foreground/10">
                      <div className="h-full rounded-full" style={{ width: `${Math.max(3, (result.finalValue / best) * 100)}%`, background: isTop ? "#1F6B4F" : "var(--sec)" }} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                      <div>
                        <p className={FIELD_LABEL}>{result.kind === "cash" ? "Interest rate" : "Growth before fees"}</p>
                        <p className="font-bold tabular-nums">{result.ratePercent}%{result.usedAssumedReturn ? " (shared figure)" : ""}</p>
                      </div>
                      <div>
                        <p className={FIELD_LABEL}>Cost this year</p>
                        <p className="font-bold tabular-nums">{money(result.firstYear.total)}{result.firstYearPercent !== null ? ` (${result.firstYearPercent}%)` : ""}</p>
                      </div>
                      <div>
                        <p className={FIELD_LABEL}>Fees over {yearsLabel}</p>
                        <p className={`font-bold tabular-nums ${result.totalFees === cheapest && complete.length > 1 ? "text-[#1F6B4F]" : ""}`}>
                          {money(result.totalFees)}{result.totalFees === cheapest && complete.length > 1 ? " (lowest)" : ""}
                        </p>
                      </div>
                      <div>
                        <p className={FIELD_LABEL}>Pot lost to fees</p>
                        <p className="font-bold tabular-nums text-[#9B2C2C]">{money(result.lostToFees)}</p>
                      </div>
                    </div>
                    {result.kind === "invest" && (
                      <p className="text-[11px] font-medium text-foreground/70">
                        This year: platform {money(result.firstYear.platform)}, funds {money(result.firstYear.funds)}
                        {result.firstYear.advice > 0 ? `, management ${money(result.firstYear.advice)}` : ""}
                        {result.firstYear.trading > 0 ? `, trading ${money(result.firstYear.trading)}` : ""}.
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {mixed && (
          <p className="rounded-lg border-l-4 border-[#B7791F] bg-amber-50 p-3 text-xs font-medium text-[#2A2110] dark:bg-amber-950/40 dark:text-amber-100">
            Cash and investments are not like for like. Cash grows at a known rate. Investments can fall as well as rise, and the growth figure is an assumption.
          </p>
        )}
        <p className="text-[11px] font-medium text-foreground/70">
          An illustration, not financial advice. Charges and rates change, so check each provider before moving money.
        </p>
      </div>
    </div>
  );
}

export default function PlatformComparisonPanel({
  doc, canEdit, onSave,
}: {
  doc: PlatformComparisonDoc;
  canEdit: boolean;
  onSave: (next: PlatformComparisonDoc) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(doc);
  const [adding, setAdding] = useState<"none" | "manual" | "guide">("none");
  const [busyId, setBusyId] = useState<string | null>(null);
  // What this panel last sent or received, so a save echoing back from the
  // server is not mistaken for someone else's edit (and typing is not undone).
  const synced = useRef(JSON.stringify(doc));

  useEffect(() => {
    const incoming = JSON.stringify(doc);
    if (incoming !== synced.current) {
      synced.current = incoming;
      setDraft(doc);
    }
  }, [doc]);

  useEffect(() => {
    if (!canEdit) return;
    const outgoing = JSON.stringify(draft);
    if (outgoing === synced.current) return;
    const timer = setTimeout(() => {
      synced.current = outgoing;
      void onSave(draft);
    }, 700);
    return () => clearTimeout(timer);
  }, [draft, canEdit, onSave]);

  const results = useMemo(() => comparePlatforms(draft), [draft]);
  const colorFor = (id: string) => ENTRY_COLORS[Math.max(0, draft.entries.findIndex((e) => e.id === id)) % ENTRY_COLORS.length];
  const updateEntry = (next: PlatformEntry) => setDraft((d) => ({ ...d, entries: d.entries.map((e) => (e.id === next.id ? next : e)) }));
  const addEntry = (entry: PlatformEntry) => {
    setDraft((d) => ({ ...d, entries: [...d.entries, entry] }));
    setAdding("none");
  };
  const balanceFor = (entry: PlatformEntry) => (draft.useSharedPot ? draft.sharedBalance : entry.balance);

  const fill = async (entry: PlatformEntry): Promise<number> => {
    const fields = blankFields(entry);
    if (fields.length === 0) return 0;
    const result = await fillPlatformGaps(entry, fields, balanceFor(entry));
    const applied = applyAssist(entry, result, "ai");
    updateEntry(applied.entry);
    return applied.filled;
  };

  const fillOne = async (entry: PlatformEntry) => {
    setBusyId(entry.id);
    try {
      const filled = await fill(entry);
      if (filled > 0) toast.success(`AI filled ${filled} ${filled === 1 ? "figure" : "figures"} for ${entry.providerName}. Check them against the provider.`);
      else toast.message(`AI could not find those figures for ${entry.providerName}. Enter them yourself or upload a document.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The AI lookup failed.");
    } finally {
      setBusyId(null);
    }
  };

  const fillAll = async () => {
    setBusyId("all");
    let total = 0;
    try {
      for (const entry of draft.entries) total += await fill(entry);
      if (total > 0) toast.success(`AI filled ${total} ${total === 1 ? "figure" : "figures"}. Check them against each provider.`);
      else toast.message("AI could not find any of the missing figures.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The AI lookup failed.");
    } finally {
      setBusyId(null);
    }
  };

  const upload = async (entry: PlatformEntry, file: File) => {
    setBusyId(entry.id);
    try {
      const fields = fieldsForKind(accountTypeInfo(entry.accountType).kind).filter((f) => f.key !== "tradesPerYear");
      const result = await extractPlatformDocument(entry, fields, balanceFor(entry), file);
      const applied = applyAssist(entry, result, "document");
      updateEntry(applied.entry);
      if (applied.filled > 0) toast.success(`Read ${applied.filled} ${applied.filled === 1 ? "figure" : "figures"} from ${file.name}.`);
      else toast.message("No charges or rates were found in that document.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That document could not be read.");
    } finally {
      setBusyId(null);
    }
  };

  const totalBlanks = draft.entries.reduce((sum, e) => sum + blankFields(e).length, 0);

  return (
    <div className="mb-5 space-y-4" data-testid="platform-compare" style={{ ["--sec" as string]: "#22407A" }}>
      <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
        <div className="flex items-center gap-3 band bg-[var(--sec)] px-4 py-3 text-white">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/20"><Scale className="h-4 w-4" /></span>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold leading-tight">Compare platforms</p>
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">Same money, different providers. See what each one really costs.</p>
          </div>
        </div>
        <div className="p-4">
          <PotSettings doc={draft} disabled={!canEdit} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
        </div>
      </div>

      {draft.entries.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          {draft.entries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              color={colorFor(entry.id)}
              doc={draft}
              disabled={!canEdit}
              busy={busyId === entry.id || busyId === "all"}
              onChange={updateEntry}
              onRemove={() => setDraft((d) => ({ ...d, entries: d.entries.filter((e) => e.id !== entry.id) }))}
              onFill={() => void fillOne(entry)}
              onUpload={(file) => void upload(entry, file)}
            />
          ))}
        </div>
      )}

      {canEdit && adding === "guide" && <GuidedAdd doc={draft} onAdd={addEntry} onCancel={() => setAdding("none")} />}
      {canEdit && adding === "manual" && <ManualAdd doc={draft} onAdd={addEntry} onCancel={() => setAdding("none")} />}

      {canEdit && adding === "none" && (
        <div className="rounded-xl border border-foreground/20 bg-card p-4 shadow-card">
          <p className="text-sm font-bold">{draft.entries.length === 0 ? "Add the accounts you want to compare" : "Add another account"}</p>
          <p className="mt-0.5 text-xs font-medium text-foreground/70">
            {draft.entries.length === 0
              ? "Add two or more. interactive investor, Vanguard and True Potential have their published charges built in. Any other provider works too."
              : "There is no limit. Add as many accounts and providers as you like."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button onClick={() => setAdding("guide")}><Sparkles /> Guide me with AI</Button>
            <Button variant="outline" onClick={() => setAdding("manual")}><Plus /> Add it myself</Button>
            {totalBlanks > 0 && (
              <Button variant="outline" disabled={busyId !== null} onClick={() => void fillAll()}>
                {busyId === "all" ? <Loader2 className="animate-spin" /> : <Sparkles />} Fill all {totalBlanks} gaps with AI
              </Button>
            )}
          </div>
        </div>
      )}

      {draft.entries.length > 0 && <Results doc={draft} results={results} colorFor={colorFor} />}
    </div>
  );
}

import { useMemo, useState } from "react";
import { BarChart3, Bot, GitCompareArrows, Plus, Save, Sparkles, Trash2, Users } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Account, BalanceEntry } from "@/hooks/useFinance";
import { useFinancialModels } from "@/hooks/useFinancialModels";
import { interpretFinancialModelScenario } from "@/lib/financialModelAiApi";
import {
  calculateFinancialModel,
  defaultFinancialModel,
  fixedTermMonthlyWithdrawal,
  modelId,
  RETURN_CASES,
  UK_MODEL_RULES,
  type FinancialModelInput,
  type ModelAccount,
  type ModelAccountKind,
  type ModelGift,
  type ModelPerson,
  type SavedFinancialModel,
} from "@/lib/financialModel";
import { feeReviewDue, providerFeeSource } from "@/lib/providerFeeReview";

const COLORS = { cautious: "#b7791f", central: "#167c80", optimistic: "#3973b7" };
const KINDS: { value: ModelAccountKind; label: string }[] = [
  { value: "cash", label: "Cash" }, { value: "cash_isa", label: "Cash ISA" },
  { value: "stocks_isa", label: "Stocks & shares ISA" }, { value: "lisa", label: "Lifetime ISA" },
  { value: "gia", label: "General investment" }, { value: "pension", label: "Pension" },
  { value: "property", label: "Property" }, { value: "other", label: "Other" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value || 0);
}
function latestBalance(id: string, entries: BalanceEntry[]) {
  return [...entries].filter((item) => item.accountId === id).sort((a, b) => b.date.localeCompare(a.date))[0]?.balance ?? 0;
}
function number(value: string) { return Number.isFinite(Number(value)) ? Number(value) : 0; }

export default function FinancialModellerPanel({ accounts, entries, scopeUserId, canEdit }: {
  accounts: Account[]; entries: BalanceEntry[]; scopeUserId?: string; canEdit: boolean;
}) {
  const saved = useFinancialModels(scopeUserId);
  const [draft, setDraft] = useState<FinancialModelInput>(() => defaultFinancialModel());
  const [savedId, setSavedId] = useState<string>();
  const [prompt, setPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [questions, setQuestions] = useState<{ id: string; question: string; why: string; optional: boolean }[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [tab, setTab] = useState<"build" | "saved" | "compare">("build");
  const result = useMemo(() => calculateFinancialModel(draft), [draft]);
  const central = result.runs.central;
  const chart = central.points.map((point, index) => ({
    year: point.year,
    cautious: result.runs.cautious.points[index]?.totalGbp,
    central: point.totalGbp,
    optimistic: result.runs.optimistic.points[index]?.totalGbp,
    estate: point.estateGbp,
  }));

  const patch = (next: Partial<FinancialModelInput>) => setDraft((current) => ({ ...current, ...next }));
  const patchPerson = (id: string, next: Partial<ModelPerson>) => patch({ people: draft.people.map((item) => item.id === id ? { ...item, ...next } : item) });
  const patchAccount = (id: string, next: Partial<ModelAccount>) => patch({ accounts: draft.accounts.map((item) => item.id === id ? { ...item, ...next } : item) });
  const patchGift = (id: string, next: Partial<ModelGift>) => patch({ gifts: draft.gifts.map((item) => item.id === id ? { ...item, ...next } : item) });

  const addPerson = () => patch({ people: [...draft.people, { id: modelId("person"), name: `Person ${draft.people.length + 1}`, age: 40, annualIncomeGbp: 0, annualSpendingGbp: 0 }] });
  const addAccount = (source?: Account) => {
    const ownerId = draft.people[0]?.id;
    if (!ownerId) return;
    const feePct = (source?.feePct || 0) + (source?.ocfPct || 0) + (source?.adviceFeeKind === "percent" ? source.adviceFeeAmount || 0 : 0);
    const lower = source?.type.toLowerCase() || "";
    const kind: ModelAccountKind = lower.includes("lisa") ? "lisa" : lower.includes("pension") ? "pension" : lower.includes("cash isa") ? "cash_isa" : lower.includes("isa") ? "stocks_isa" : lower.includes("cash") ? "cash" : "gia";
    patch({ accounts: [...draft.accounts, {
      id: modelId("account"), ownerId, name: source?.name || "New account", provider: source?.name || "Custom",
      kind, openingBalanceGbp: source ? latestBalance(source.id, entries) : 0,
      monthlyContributionGbp: source?.monthlyContribution || 0, monthlyWithdrawalGbp: 0,
      returns: { cautious: 2, central: source?.growthAssumptionPct ?? 5, optimistic: 7 },
      fees: feePct || source?.annualFeeGbp ? [{ id: modelId("fee"), effectiveFrom: new Date().toISOString().slice(0, 10), annualPercent: feePct, annualFlatGbp: source?.annualFeeGbp || (source?.adviceFeeKind === "gbp" ? source.adviceFeeAmount || 0 : 0), source: source ? "hardy" : "manual", checkedAt: new Date().toISOString() }] : [],
      importedAccountId: source?.id, includeInEstate: kind !== "pension",
    }] });
  };
  const addGift = () => {
    if (draft.people.length < 2) { toast.error("Add the recipient as a person first."); return; }
    patch({ gifts: [...draft.gifts, { id: modelId("gift"), fromPersonId: draft.people[0].id, toPersonId: draft.people[1].id, amountGbp: 0, month: 1, exemptGbp: UK_MODEL_RULES.annualGiftExemptionGbp, fromNormalIncome: false, giftWithReservation: false }] });
  };

  const askAi = async () => {
    setAiBusy(true);
    try {
      const response = await interpretFinancialModelScenario(prompt, draft);
      setQuestions(response.questions || []);
      const m = response.model || {};
      patch({ ...m, assumptions: [...new Set([...(draft.assumptions || []), ...(response.assumptions || [])])] });
      toast.success(response.status === "ready" ? "Scenario added to the builder—review it before saving." : "AI has some follow-up questions.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message.replace(/^FirebaseError:\s*/i, "") : "AI could not interpret that scenario.");
    } finally { setAiBusy(false); }
  };
  const save = async () => {
    if (!draft.name.trim()) { toast.error("Name the model first."); return; }
    try { const id = await saved.saveModel(draft, result, savedId); setSavedId(id); toast.success("Financial model saved."); }
    catch { toast.error("The model could not be saved."); }
  };
  const open = (model: SavedFinancialModel) => { setDraft(model.input); setSavedId(model.id); setTab("build"); };
  const compared = saved.models.filter((model) => compareIds.includes(model.id));

  return <div className="space-y-4">
    <header className="rounded-3xl border-2 border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary"/><h2 className="font-display text-xl font-bold">Comprehensive financial modeller</h2></div>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Build multi-person UK scenarios, see all three return cases, compare against doing nothing, and save models for later comparison.</p></div>
        <div className="flex gap-2">{(["build", "saved", "compare"] as const).map((item) => <Button key={item} variant={tab === item ? "default" : "outline"} className="rounded-xl capitalize" onClick={() => setTab(item)}>{item === "compare" && <GitCompareArrows className="h-4 w-4"/>}{item}</Button>)}</div>
      </div>
      <p className="mt-3 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-foreground/80">Illustrative modelling only—not financial, legal or tax advice. England rules profile: {UK_MODEL_RULES.version}. Review all imported values and assumptions.</p>
    </header>

    {tab === "build" && <>
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-3xl border-2 border-border bg-card p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2"><Bot className="h-4 w-4 text-primary"/><h3 className="font-display font-bold">Describe the scenario to AI</h3></div>
          <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="For example: Mum gifts £20,000 each to Chris and Sarah. They invest into LISAs and cash ISAs. Compare the ten-year effect on Mum's estate, pension, fees and inheritance tax…" className="min-h-28 rounded-2xl"/>
          <div className="mt-3 flex flex-wrap items-center gap-2"><Button onClick={() => void askAi()} disabled={aiBusy || prompt.trim().length < 10} className="rounded-xl bg-gradient-primary">{aiBusy ? "Thinking…" : "Build from conversation"}</Button><span className="text-xs text-muted-foreground">AI structures the request; the deterministic engine performs the calculations.</span></div>
          {questions.length > 0 && <div className="mt-4 space-y-2"><p className="text-xs font-bold uppercase tracking-wider">Helpful follow-up questions</p>{questions.map((q) => <div key={q.id} className="rounded-xl border border-border p-3 text-sm"><p className="font-semibold">{q.question} {q.optional && <span className="text-xs text-muted-foreground">(optional—you may skip)</span>}</p><p className="text-xs text-muted-foreground">{q.why}</p></div>)}</div>}
        </div>
        <div className="rounded-3xl border-2 border-border bg-card p-4 shadow-card space-y-3">
          <Field label="Model name"><Input value={draft.name} onChange={(e) => patch({ name: e.target.value })}/></Field>
          <div className="grid grid-cols-2 gap-2"><NumberField label="Years" value={draft.years} onChange={(years) => patch({ years: Math.max(1, Math.min(60, years)), deathYear: Math.min(draft.deathYear, years) })}/><NumberField label="Death/estate year" value={draft.deathYear} onChange={(deathYear) => patch({ deathYear })}/></div>
          <div className="grid grid-cols-2 gap-2"><NumberField label="Inflation %" value={draft.inflationPct} onChange={(inflationPct) => patch({ inflationPct })}/><NumberField label="Residence £" value={draft.residenceValueGbp} onChange={(residenceValueGbp) => patch({ residenceValueGbp })}/></div>
          <Button className="w-full rounded-xl" onClick={() => void save()} disabled={!canEdit}><Save className="h-4 w-4"/>Save named model</Button>
        </div>
      </section>

      <BuilderSection title="People" icon={<Users className="h-4 w-4"/>} onAdd={addPerson}>
        {draft.people.map((person) => <div key={person.id} className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-5"><Field label="Name"><Input value={person.name} onChange={(e) => patchPerson(person.id, { name: e.target.value })}/></Field><NumberField label="Age" value={person.age} onChange={(age) => patchPerson(person.id, { age })}/><NumberField label="Annual income £" value={person.annualIncomeGbp} onChange={(annualIncomeGbp) => patchPerson(person.id, { annualIncomeGbp })}/><NumberField label="Annual spending £" value={person.annualSpendingGbp} onChange={(annualSpendingGbp) => patchPerson(person.id, { annualSpendingGbp })}/><Button variant="ghost" className="self-end" disabled={draft.people.length === 1} onClick={() => patch({ people: draft.people.filter((item) => item.id !== person.id) })}><Trash2 className="h-4 w-4"/></Button></div>)}
      </BuilderSection>

      <BuilderSection title="Accounts and pensions" icon={<BarChart3 className="h-4 w-4"/>} onAdd={() => addAccount()} extra={<Select onValueChange={(id) => addAccount(accounts.find((item) => item.id === id))}><SelectTrigger className="h-9 w-56 rounded-xl"><SelectValue placeholder="Import with consent…"/></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select>}>
        {draft.accounts.map((account) => { const fee = account.fees.at(-1); const feeSource = providerFeeSource(account.provider); const reviewDue = feeReviewDue(fee?.checkedAt); return <div key={account.id} className="rounded-2xl border border-border p-3 space-y-3"><div className="grid gap-2 sm:grid-cols-4 lg:grid-cols-7"><Field label="Name"><Input value={account.name} onChange={(e) => patchAccount(account.id, { name: e.target.value })}/></Field><Field label="Provider"><Input value={account.provider} onChange={(e) => patchAccount(account.id, { provider: e.target.value })}/></Field><Field label="Owner"><Select value={account.ownerId} onValueChange={(ownerId) => patchAccount(account.id, { ownerId })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{draft.people.map((person) => <SelectItem value={person.id} key={person.id}>{person.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Type"><Select value={account.kind} onValueChange={(kind: ModelAccountKind) => patchAccount(account.id, { kind, includeInEstate: kind !== "pension" })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{KINDS.map((kind) => <SelectItem value={kind.value} key={kind.value}>{kind.label}</SelectItem>)}</SelectContent></Select></Field><NumberField label="Balance £" value={account.openingBalanceGbp} onChange={(openingBalanceGbp) => patchAccount(account.id, { openingBalanceGbp })}/><NumberField label="Monthly in £" value={account.monthlyContributionGbp} onChange={(monthlyContributionGbp) => patchAccount(account.id, { monthlyContributionGbp })}/><NumberField label="Monthly out £" value={account.monthlyWithdrawalGbp} onChange={(monthlyWithdrawalGbp) => patchAccount(account.id, { monthlyWithdrawalGbp })}/></div>
          <div className="grid gap-2 sm:grid-cols-6"><NumberField label="Cautious %" value={account.returns.cautious} onChange={(v) => patchAccount(account.id, { returns: { ...account.returns, cautious: v } })}/><NumberField label="Central %" value={account.returns.central} onChange={(v) => patchAccount(account.id, { returns: { ...account.returns, central: v } })}/><NumberField label="Optimistic %" value={account.returns.optimistic} onChange={(v) => patchAccount(account.id, { returns: { ...account.returns, optimistic: v } })}/><NumberField label="Annual fee %" value={fee?.annualPercent || 0} onChange={(v) => patchAccount(account.id, { fees: [{ id: fee?.id || modelId("fee"), effectiveFrom: new Date().toISOString().slice(0,10), annualPercent: v, annualFlatGbp: fee?.annualFlatGbp || 0, source: "manual", checkedAt: new Date().toISOString() }] })}/><NumberField label="Flat fee £/yr" value={fee?.annualFlatGbp || 0} onChange={(v) => patchAccount(account.id, { fees: [{ id: fee?.id || modelId("fee"), effectiveFrom: new Date().toISOString().slice(0,10), annualPercent: fee?.annualPercent || 0, annualFlatGbp: v, source: "manual", checkedAt: new Date().toISOString() }] })}/><Button variant="ghost" className="self-end" onClick={() => patch({ accounts: draft.accounts.filter((item) => item.id !== account.id) })}><Trash2 className="h-4 w-4"/>Remove</Button></div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{feeSource && <Button type="button" variant="outline" size="sm" className="h-8 rounded-xl" onClick={() => { window.open(feeSource.url, "_blank", "noopener,noreferrer"); if (fee) patchAccount(account.id, { fees: account.fees.map((item) => item.id === fee.id ? { ...item, checkedAt: new Date().toISOString(), sourceUrl: feeSource.url } : item) }); }}>{reviewDue ? "Review latest official charges" : "Official charges checked this month"}</Button>}<span>Fee changes are user-confirmed and date-stamped; older saved model results remain unchanged.</span></div>
          {account.monthlyWithdrawalGbp > 0 && <p className="text-xs text-muted-foreground">At the central return, {money(account.openingBalanceGbp)} could pay approximately {money(fixedTermMonthlyWithdrawal(account.openingBalanceGbp, account.returns.central - (fee?.annualPercent || 0), draft.years))}/month for {draft.years} years before reaching £0. Your entered withdrawal is {money(account.monthlyWithdrawalGbp)}/month.</p>}</div>; })}
      </BuilderSection>

      <BuilderSection title="Gifts and transfers" icon={<GitCompareArrows className="h-4 w-4"/>} onAdd={addGift}>
        {draft.gifts.map((gift) => <div key={gift.id} className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-6"><Field label="From"><PersonSelect people={draft.people} value={gift.fromPersonId} onChange={(fromPersonId) => patchGift(gift.id, { fromPersonId })}/></Field><Field label="To"><PersonSelect people={draft.people} value={gift.toPersonId} onChange={(toPersonId) => patchGift(gift.id, { toPersonId })}/></Field><NumberField label="Amount £" value={gift.amountGbp} onChange={(amountGbp) => patchGift(gift.id, { amountGbp })}/><NumberField label="Month" value={gift.month} onChange={(month) => patchGift(gift.id, { month })}/><NumberField label="Exempt £" value={gift.exemptGbp} onChange={(exemptGbp) => patchGift(gift.id, { exemptGbp })}/><Button variant="ghost" className="self-end" onClick={() => patch({ gifts: draft.gifts.filter((item) => item.id !== gift.id) })}><Trash2 className="h-4 w-4"/>Remove</Button></div>)}
      </BuilderSection>

      <section className="rounded-3xl border-2 border-border bg-card p-4 shadow-card sm:p-5"><h3 className="font-display text-lg font-bold">All three projected returns</h3><div className="mt-3 grid gap-3 sm:grid-cols-3">{RETURN_CASES.map((item) => { const run = result.runs[item]; const base = result.baselineRuns[item]; return <div key={item} className="rounded-2xl border p-3" style={{ borderColor: COLORS[item] }}><p className="text-xs font-bold uppercase" style={{ color: COLORS[item] }}>{item}</p><p className="mt-1 font-display text-2xl font-bold">{money(run.endingTotalGbp)}</p><p className="text-xs text-muted-foreground">Estate {money(run.endingEstateGbp)} · outside estate {money(run.endingOutsideEstateGbp)}</p><div className="mt-2 grid grid-cols-2 gap-2 text-xs"><span>IHT <b>{money(run.inheritanceTaxGbp)}</b></span><span>Fees <b>{money(run.cumulativeFeesGbp)}</b></span><span>Gifts <b>{money(run.cumulativeGiftsGbp)}</b></span><span>vs do nothing <b>{money(run.endingTotalGbp - base.endingTotalGbp)}</b></span></div></div>; })}</div>
        <div className="mt-4 h-80"><ResponsiveContainer width="100%" height="100%"><LineChart data={chart}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="year"/><YAxis tickFormatter={(v) => `£${Math.round(v/1000)}k`}/><Tooltip formatter={(v: number) => money(v)}/><Legend/>{RETURN_CASES.map((item) => <Line key={item} dataKey={item} stroke={COLORS[item]} strokeWidth={3} dot={false}/>)}</LineChart></ResponsiveContainer></div>
        {result.warnings.length > 0 && <div className="mt-3 space-y-1">{result.warnings.map((warning) => <p className="text-xs text-amber-700 dark:text-amber-300" key={warning}>• {warning}</p>)}</div>}
      </section>
    </>}

    {tab === "saved" && <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{saved.models.map((model) => <div key={model.id} className="rounded-3xl border-2 border-border bg-card p-4 shadow-card"><p className="font-display text-lg font-bold">{model.input.name}</p><p className="text-xs text-muted-foreground">{model.input.years} years · {model.input.people.length} people · {model.input.accounts.length} accounts</p><div className="my-3 grid grid-cols-3 gap-1">{RETURN_CASES.map((item) => <div key={item} className="rounded-xl bg-muted/50 p-2"><p className="text-[9px] uppercase">{item}</p><p className="text-xs font-bold">{money(model.result.runs[item].endingTotalGbp)}</p></div>)}</div><div className="flex gap-2"><Button size="sm" className="rounded-xl" onClick={() => open(model)}>Open</Button><Button size="sm" variant="outline" className="rounded-xl" onClick={() => setCompareIds((ids) => ids.includes(model.id) ? ids : [...ids, model.id])}>Compare</Button><Button size="sm" variant="ghost" onClick={() => void saved.removeModel(model.id)}><Trash2 className="h-4 w-4"/></Button></div></div>)}</section>}

    {tab === "compare" && <section className="rounded-3xl border-2 border-border bg-card p-4 shadow-card"><h3 className="font-display text-lg font-bold">Compare saved models</h3><div className="my-3 flex flex-wrap gap-2">{saved.models.map((model) => <Button key={model.id} variant={compareIds.includes(model.id) ? "default" : "outline"} className="rounded-xl" onClick={() => setCompareIds((ids) => ids.includes(model.id) ? ids.filter((id) => id !== model.id) : [...ids, model.id])}>{model.input.name}</Button>)}</div>{compared.length < 2 ? <p className="py-12 text-center text-sm text-muted-foreground">Select at least two saved models.</p> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-2 text-left">Metric</th>{compared.map((m) => <th className="p-2 text-right" key={m.id}>{m.input.name}</th>)}</tr></thead><tbody>{[["Central ending wealth", (m: SavedFinancialModel) => m.result.runs.central.endingTotalGbp],["Central estate", (m: SavedFinancialModel) => m.result.runs.central.endingEstateGbp],["Outside estate", (m: SavedFinancialModel) => m.result.runs.central.endingOutsideEstateGbp],["Inheritance tax", (m: SavedFinancialModel) => m.result.runs.central.inheritanceTaxGbp],["Total fees", (m: SavedFinancialModel) => m.result.runs.central.cumulativeFeesGbp],["Total gifts", (m: SavedFinancialModel) => m.result.runs.central.cumulativeGiftsGbp]].map(([label, getter]) => <tr className="border-t" key={label as string}><td className="p-2 font-semibold">{label as string}</td>{compared.map((m) => <td className="p-2 text-right tabular-nums" key={m.id}>{money((getter as (m: SavedFinancialModel) => number)(m))}</td>)}</tr>)}</tbody></table></div>}</section>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="space-y-1"><Label className="text-xs">{label}</Label>{children}</label>; }
function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <Field label={label}><Input type="number" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(number(e.target.value))}/></Field>; }
function BuilderSection({ title, icon, onAdd, extra, children }: { title: string; icon: React.ReactNode; onAdd: () => void; extra?: React.ReactNode; children: React.ReactNode }) { return <section className="rounded-3xl border-2 border-border bg-card p-4 shadow-card"><div className="mb-3 flex flex-wrap items-center gap-2">{icon}<h3 className="font-display font-bold">{title}</h3><div className="flex-1"/>{extra}<Button variant="outline" size="sm" className="rounded-xl" onClick={onAdd}><Plus className="h-4 w-4"/>Add</Button></div><div className="space-y-3">{children}</div></section>; }
function PersonSelect({ people, value, onChange }: { people: ModelPerson[]; value: string; onChange: (value: string) => void }) { return <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{people.map((person) => <SelectItem value={person.id} key={person.id}>{person.name}</SelectItem>)}</SelectContent></Select>; }

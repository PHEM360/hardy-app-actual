import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Rocket, Plus, Trash2, TrendingUp, TrendingDown, Scale } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtGbp } from "@/lib/flatFinance";
import { useBusinessSetups } from "@/hooks/useBusinessSetups";
import { BusinessSetup, defaultBusinessSetup, monthlyCashFlowYearOne, projectBusinessSetup } from "@/lib/businessSetupModel";
import { toast } from "sonner";

// Each scenario card takes the next colour in turn, so a list of ideas reads
// as a set of distinct folders, not a column of identical white boxes.
const CARD_COLORS = ["#17475C", "#7A2E2A", "#3A2A5E", "#1F4D3A", "#6E1F2F", "#22407A", "#8A6424"];
const VERDICT_COLOR: Record<string, string> = {
  strong: "bg-[#1F6B4F]",
  promising: "bg-[#1C4A6E]",
  risky: "bg-[#B7791F]",
  needs_work: "bg-[#9B2C2C]",
};

interface CompareRow {
  label: string;
  a: number | null;
  b: number | null;
  /** Which direction wins. */
  better: "higher" | "lower";
  format: (n: number | null) => string;
}

function compareRows(a: BusinessSetup, b: BusinessSetup): CompareRow[] {
  const pa = projectBusinessSetup(a);
  const pb = projectBusinessSetup(b);
  const money = (n: number | null) => (n === null ? "n/a" : fmtGbp(n));
  const percent = (n: number | null) => (n === null ? "n/a" : `${n}%`);
  const lastCash = (p: typeof pa) => p.years[p.years.length - 1]?.cumulativeCash ?? 0;
  return [
    { label: "Start-up cost", a: pa.totalStartupCost, b: pb.totalStartupCost, better: "lower", format: money },
    { label: "Total sales", a: pa.totalRevenue, b: pb.totalRevenue, better: "higher", format: money },
    { label: "Total profit", a: pa.totalNetProfit, b: pb.totalNetProfit, better: "higher", format: money },
    { label: "Break-even", a: pa.breakEvenYear, b: pb.breakEvenYear, better: "lower", format: (n) => (n === null ? "Not reached" : `Year ${n}`) },
    { label: "Extra funding needed", a: pa.peakFundingNeeded, b: pb.peakFundingNeeded, better: "lower", format: money },
    { label: "Lowest bank balance, year 1", a: monthlyCashFlowYearOne(a).lowestBalance, b: monthlyCashFlowYearOne(b).lowestBalance, better: "higher", format: money },
    { label: "Gross margin", a: pa.grossMarginPercent, b: pb.grossMarginPercent, better: "higher", format: percent },
    { label: "Return on money in", a: pa.returnOnInvestmentPercent, b: pb.returnOnInvestmentPercent, better: "higher", format: percent },
    { label: "Cash at the end", a: lastCash(pa), b: lastCash(pb), better: "higher", format: money },
  ];
}

/** "a", "b" or null for a tie. A missing value (never breaks even, no sales) always loses. */
function winner(row: CompareRow): "a" | "b" | null {
  if (row.a === row.b) return null;
  if (row.a === null) return "b";
  if (row.b === null) return "a";
  const aWins = row.better === "higher" ? row.a > row.b : row.a < row.b;
  return aWins ? "a" : "b";
}

function ComparePanel({ setups }: { setups: BusinessSetup[] }) {
  const [aId, setAId] = useState(setups[0]?.id ?? "");
  const [bId, setBId] = useState(setups[1]?.id ?? "");
  const a = setups.find((s) => s.id === aId) ?? setups[0];
  const b = setups.find((s) => s.id === bId) ?? setups[1];
  if (!a || !b) return null;
  const rows = compareRows(a, b);
  const wins = { a: rows.filter((r) => winner(r) === "a").length, b: rows.filter((r) => winner(r) === "b").length };
  const picker = (value: string, onChange: (id: string) => void, label: string) => (
    <div className="min-w-0 space-y-1">
      <Label className="text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
        <SelectContent>
          {setups.map((s) => (
            <SelectItem key={s.id} value={s.id!}>{s.name || "Untitled idea"}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
  const cell = (row: CompareRow, side: "a" | "b") => {
    const won = winner(row) === side;
    return (
      <td className="p-1.5 text-right">
        <span className={`inline-block rounded-md px-2 py-1 font-bold tabular-nums ${won ? "btn-edge bg-[#1F6B4F] text-white" : "text-foreground"}`}>
          {row.format(side === "a" ? row.a : row.b)}
        </span>
      </td>
    );
  };
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
      <div className="flex items-center gap-3 band bg-[hsl(215_35%_18%)] px-4 py-3 text-white">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-white/15">
          <Scale className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-tight">Compare two ideas</p>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/75">The better figure in each row is green</p>
        </div>
      </div>
      <div className="space-y-3 p-4">
        <div className="grid grid-cols-2 gap-2">
          {picker(a.id!, setAId, "First idea")}
          {picker(b.id!, setBId, "Second idea")}
        </div>
        <div className="overflow-hidden rounded-lg border border-foreground/20">
          <table className="w-full table-fixed text-xs">
            <thead className="bg-[hsl(215_35%_18%)] text-[10px] uppercase tracking-wide text-white">
              <tr>
                <th className="w-[36%] p-2 text-left">Measure</th>
                <th className="truncate p-2 text-right">{a.name || "First"}</th>
                <th className="truncate p-2 text-right">{b.name || "Second"}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-foreground/10 bg-secondary">
                <td className="p-2 font-semibold">Plan length</td>
                <td className="p-2 text-right font-bold tabular-nums">{a.years} years</td>
                <td className="p-2 text-right font-bold tabular-nums">{b.years} years</td>
              </tr>
              {rows.map((row) => (
                <tr key={row.label} className="border-t border-foreground/10 odd:bg-secondary even:bg-card">
                  <td className="p-2 font-semibold">{row.label}</td>
                  {cell(row, "a")}
                  {cell(row, "b")}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm font-bold">
          {wins.a === wins.b
            ? "It is a tie on these measures."
            : `${(wins.a > wins.b ? a.name : b.name) || "One idea"} is ahead on ${Math.max(wins.a, wins.b)} of ${rows.length} measures.`}
        </p>
        {a.years !== b.years && (
          <p className="text-xs font-medium text-foreground/70">These plans cover different numbers of years, so totals are not like for like.</p>
        )}
      </div>
    </div>
  );
}

export default function BusinessModeller() {
  const navigate = useNavigate();
  const { setups, loading, addSetup, deleteSetup } = useBusinessSetups();
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const createScenario = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const id = await addSetup(defaultBusinessSetup(trimmed));
      setAddOpen(false);
      setName("");
      if (id) navigate(`/companies/business-modeller/${id}`);
    } catch {
      toast.error("Couldn't create that scenario. Please try again.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <FeaturePageShell
      title="Business Setup Modeller"
      subtitle="Plan a new venture: costs, income growth and a multi-year projection."
      icon={<Rocket className="h-5 w-5" />}
      action={
        <Button className="h-10" onClick={() => setAddOpen(true)}>
          <Plus /> New scenario
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : setups.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
          <div className="flex items-center gap-4 bg-[#3A2A5E] band px-5 py-6 text-white">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-black/20">
              <Rocket className="h-7 w-7" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-xl font-bold leading-tight">Model your first business idea</p>
              <p className="mt-1 text-sm font-medium text-white/85">See what it costs, when it pays back and how much money it needs.</p>
            </div>
          </div>
          <div className="grid gap-2 p-4 sm:grid-cols-3">
            {[
              ["#7A2E2A", "1", "Add your costs", "Start-up and running costs, from presets or your own."],
              ["#1F4D3A", "2", "Add your income", "Grow it by a rate, to a cap, or type in each year."],
              ["#22407A", "3", "Read the projection", "Profit, tax, cash in the bank and break-even, up to 10 years."],
            ].map(([color, step, title, text]) => (
              <div key={step} className="flex items-start gap-3 rounded-lg border border-foreground/20 p-3">
                <span className="btn-edge flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold text-white" style={{ background: color }}>{step}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{title}</p>
                  <p className="mt-0.5 text-xs font-medium text-foreground/70">{text}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 pb-4">
            <Button onClick={() => setAddOpen(true)} className="w-full sm:w-auto">
              <Plus /> Model a new business
            </Button>
          </div>
        </motion.div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {setups.map((setup, index) => {
            const projection = projectBusinessSetup(setup);
            const lastYear = projection.years[projection.years.length - 1];
            const profitable = (lastYear?.netProfit ?? 0) >= 0;
            return (
              <motion.button
                key={setup.id}
                type="button"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                onClick={() => navigate(`/companies/business-modeller/${setup.id}`)}
                className="relative overflow-hidden rounded-xl border border-foreground/20 bg-card text-left shadow-card transition-[border-color,box-shadow] hover:border-[var(--sec)] hover:shadow-elevated active:translate-y-px"
                style={{ ["--sec" as string]: CARD_COLORS[index % CARD_COLORS.length] }}
              >
                <div className="flex items-center gap-3 band bg-[var(--sec)] px-4 py-3 text-white">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-black/20">
                    <Rocket className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-base font-bold leading-tight">{setup.name || "Untitled idea"}</p>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/80">{setup.years} year plan</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Delete scenario"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(setup.id!);
                    }}
                    className="shrink-0 rounded-md bg-black/20 p-2 text-white transition-colors hover:bg-white hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-3 p-4">
                  {setup.description && (
                    <p className="line-clamp-2 text-sm font-medium text-foreground/75">{setup.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div className={`btn-edge rounded-lg p-2.5 ${profitable ? "bg-[#1F6B4F] text-white" : "bg-[#9B2C2C] text-white"}`}>
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-85">Year {setup.years} net profit</p>
                      <p className="mt-0.5 font-display text-base font-bold tabular-nums leading-tight">{fmtGbp(lastYear?.netProfit ?? 0)}</p>
                    </div>
                    <div className={`btn-edge rounded-lg p-2.5 ${projection.breakEvenYear ? "bg-[hsl(215_35%_18%)] text-white" : "bg-[#C9A24A] text-[#2A2110]"}`}>
                      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.12em] opacity-85">
                        {projection.breakEvenYear ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} Break-even
                      </p>
                      <p className="mt-0.5 font-display text-base font-bold tabular-nums leading-tight">
                        {projection.breakEvenYear ? `Year ${projection.breakEvenYear}` : `Not in ${setup.years}y`}
                      </p>
                    </div>
                  </div>
                  {setup.aiCritique && (
                    <span className={`inline-block rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white ${VERDICT_COLOR[setup.aiCritique.verdict] || "bg-[hsl(215_35%_18%)]"}`}>
                      AI verdict: {setup.aiCritique.verdict.replace("_", " ")}
                    </span>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      {!loading && setups.length >= 2 && <ComparePanel setups={setups} />}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent aria-describedby={undefined} className="mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Name your business idea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="space-y-1">
              <Label>Business / idea name</Label>
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Riverside Coffee Co."
                onKeyDown={(e) => { if (e.key === "Enter") void createScenario(); }}
                className="h-11"
              />
            </div>
            <Button
              className="w-full"
              disabled={!name.trim() || creating}
              onClick={() => void createScenario()}
            >
              {creating ? "Creating…" : "Start modelling"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent aria-describedby={undefined} className="mx-4 max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Delete this scenario?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This can't be undone.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={async () => {
                if (confirmDelete) await deleteSetup(confirmDelete);
                setConfirmDelete(null);
              }}
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
}

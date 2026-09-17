import { useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Rocket, Plus, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fmtGbp } from "@/lib/flatFinance";
import { useBusinessSetups } from "@/hooks/useBusinessSetups";
import { defaultBusinessSetup, projectBusinessSetup } from "@/lib/businessSetupModel";
import { toast } from "sonner";

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
        <Button className="h-9 rounded-xl bg-gradient-primary" onClick={() => setAddOpen(true)}>
          <Plus className="mr-1 h-4 w-4" /> New scenario
        </Button>
      }
    >
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : setups.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-20">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-primary text-3xl shadow-elevated">
            <Rocket className="h-9 w-9 text-primary-foreground" />
          </div>
          <div className="text-center">
            <p className="text-base font-bold text-card-foreground">No business ideas modelled yet</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              Name a new business idea, add its start-up and ongoing costs, then project income for up to 10 years.
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)} className="mt-1 gap-1.5 rounded-xl bg-gradient-primary text-white shadow-glow">
            <Plus className="h-3.5 w-3.5" /> Model a new business
          </Button>
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
                className="relative overflow-hidden rounded-2xl border border-border/40 bg-card p-4 text-left shadow-card transition-transform hover:-translate-y-0.5"
                style={{ borderTopWidth: 3, borderTopColor: "hsl(var(--primary))" }}
              >
                <button
                  type="button"
                  aria-label="Delete scenario"
                  onClick={(e) => {
                    e.stopPropagation();
                    setConfirmDelete(setup.id!);
                  }}
                  className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <p className="pr-8 font-display text-base font-bold">{setup.name || "Untitled idea"}</p>
                {setup.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{setup.description}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 font-semibold text-muted-foreground">
                    {setup.years}-year plan
                  </span>
                  {projection.breakEvenYear ? (
                    <span className="flex items-center gap-1 font-semibold text-emerald-600">
                      <TrendingUp className="h-3.5 w-3.5" /> Break-even year {projection.breakEvenYear}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold text-amber-600">
                      <TrendingDown className="h-3.5 w-3.5" /> No break-even in {setup.years}y
                    </span>
                  )}
                </div>
                <p className={`mt-2 text-sm font-bold tabular-nums ${profitable ? "text-emerald-600" : "text-rose-600"}`}>
                  {fmtGbp(lastYear?.netProfit ?? 0)} net in Year {setup.years}
                </p>
                {setup.aiCritique && (
                  <span className="mt-2 inline-block rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    AI verdict: {setup.aiCritique.verdict.replace("_", " ")}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent aria-describedby={undefined} className="mx-4 max-w-sm rounded-2xl">
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
                className="h-9 rounded-xl"
              />
            </div>
            <Button
              className="h-10 w-full rounded-xl bg-gradient-primary"
              disabled={!name.trim() || creating}
              onClick={() => void createScenario()}
            >
              {creating ? "Creating…" : "Start modelling"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent aria-describedby={undefined} className="mx-4 max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-display">Delete this scenario?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">This can't be undone.</p>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="h-10 flex-1 rounded-xl" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              className="h-10 flex-1 rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
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

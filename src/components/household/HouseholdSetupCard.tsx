import { useState } from "react";
import { Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHouseholds } from "@/hooks/useHouseholds";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";

export default function HouseholdSetupCard({
  title = "Name your household",
  description = "Give this household a name so it doesn’t show as a random ID. You can invite other people afterwards.",
}: {
  title?: string;
  description?: string;
}) {
  const { createHousehold, renameHousehold } = useHouseholds();
  const { activeHouseholdId, availableHouseholds, setActiveHouseholdId, hasExplicitHouseholds } = useActiveHousehold();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const unnamed = availableHouseholds.find((h) => h.id === activeHouseholdId);

  const handleSave = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (unnamed && hasExplicitHouseholds) {
        await renameHousehold(unnamed.id, name.trim());
      } else {
        const id = await createHousehold(name.trim());
        if (id) setActiveHouseholdId(id);
      }
      setName("");
    } catch (err: any) {
      setError(err?.message || "Could not save household.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
          <Home className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-card-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Household name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. The Hardys, 35PFP"
          className="h-11 rounded-xl"
        />
      </div>
      <Button className="w-full h-10 rounded-xl" disabled={!name.trim() || busy} onClick={handleSave}>
        {busy ? "Saving…" : unnamed && hasExplicitHouseholds ? "Rename household" : "Create household"}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

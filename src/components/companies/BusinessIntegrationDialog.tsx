import { useEffect, useState } from "react";
import { PlugZap } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Company } from "@/types/app";
import type { BusinessIntegration, BusinessIntegrationProvider } from "@/types/businessHub";
import { toast } from "sonner";

const PROVIDERS: Array<{ id: BusinessIntegrationProvider; label: string; hint: string }> = [
  { id: "milion", label: "Milion", hint: "Milion organisation ID" },
  { id: "stripe", label: "Stripe", hint: "Connected account / account ID" },
  { id: "xero", label: "Xero", hint: "Tenant / organisation ID" },
  { id: "tide", label: "Tide", hint: "Account ID" },
  { id: "website", label: "Website", hint: "Site identifier" },
  { id: "other", label: "Other", hint: "External identifier" },
];

export default function BusinessIntegrationDialog({
  company,
  open,
  onOpenChange,
  existing,
  onSave,
}: {
  company: Company | null;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  existing?: BusinessIntegration;
  onSave: (
    companyId: string,
    provider: BusinessIntegrationProvider,
    values: Partial<BusinessIntegration>,
  ) => Promise<void>;
}) {
  const [provider, setProvider] = useState<BusinessIntegrationProvider>("milion");
  const [externalId, setExternalId] = useState("");
  const [label, setLabel] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProvider(existing?.provider || "milion");
    setExternalId(existing?.externalId || "");
    setLabel(existing?.label || "");
    setBaseUrl(existing?.baseUrl || "");
    setEnabled(existing?.enabled ?? true);
  }, [existing, open]);

  const meta = PROVIDERS.find((item) => item.id === provider)!;

  const save = async () => {
    if (!company?.id) return;
    if (provider === "milion" && !externalId.trim()) {
      toast.error("Enter the Milion organisation ID.");
      return;
    }
    setSaving(true);
    try {
      await onSave(company.id, provider, {
        enabled,
        externalId: externalId.trim() || undefined,
        label: label.trim() || undefined,
        baseUrl: baseUrl.trim() || undefined,
      });
      toast.success(`${meta.label} mapping saved`);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save integration.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl sm:max-w-lg">
        <DialogHeader><DialogTitle>Connect {company?.name || "business"}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-foreground/75">
            <div className="mb-1 flex items-center gap-2 font-semibold text-foreground"><PlugZap className="h-4 w-4 text-primary" /> Connector mapping</div>
            This stores identifiers only. API keys, webhook secrets and bank credentials stay server-side and are never saved in the browser.
          </div>
          <div className="space-y-1.5">
            <Label>Provider</Label>
            <Select value={provider} onValueChange={(value) => setProvider(value as BusinessIntegrationProvider)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PROVIDERS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{meta.hint}</Label>
            <Input value={externalId} onChange={(event) => setExternalId(event.target.value)} placeholder={meta.hint} autoCapitalize="none" />
          </div>
          <div className="space-y-1.5">
            <Label>Display label</Label>
            <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. BGM Medical live account" />
          </div>
          {(provider === "website" || provider === "other") && (
            <div className="space-y-1.5">
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://…" autoCapitalize="none" />
            </div>
          )}
          <div className="flex items-center justify-between rounded-xl border border-border/50 p-3">
            <div><p className="text-sm font-semibold">Enabled</p><p className="text-[11px] text-muted-foreground">Allow this connector to participate in hub sync.</p></div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save mapping"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

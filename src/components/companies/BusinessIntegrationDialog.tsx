import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, PlugZap, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { Company } from "@/types/app";
import type { BusinessIntegration, BusinessIntegrationProvider } from "@/types/businessHub";
import { toast } from "sonner";
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";

type WebsiteKeyRow = {
  id: string;
  label: string;
  scopes: string[];
  active: boolean;
  tokenPrefix: string;
  createdAt?: string | null;
  lastUsedAt?: string | null;
};

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
  const [websiteKeys, setWebsiteKeys] = useState<WebsiteKeyRow[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [copied, setCopied] = useState(false);

  const loadWebsiteKeys = useCallback(async () => {
    if (!company?.id) return;
    setLoadingKeys(true);
    try {
      const call = httpsCallable<{ companyId: string }, { keys: WebsiteKeyRow[] }>(
        functions,
        "listBusinessWebsiteKeys",
      );
      const response = await call({ companyId: company.id });
      setWebsiteKeys(response.data.keys || []);
    } catch (error) {
      console.error("Could not load website keys", error);
    } finally {
      setLoadingKeys(false);
    }
  }, [company?.id]);

  useEffect(() => {
    if (!open) return;
    setProvider(existing?.provider || "milion");
    setExternalId(existing?.externalId || "");
    setLabel(existing?.label || "");
    setBaseUrl(existing?.baseUrl || "");
    setEnabled(existing?.enabled ?? true);
    setNewToken("");
    setCopied(false);
  }, [existing, open]);

  useEffect(() => {
    if (open && company?.id) void loadWebsiteKeys();
  }, [company?.id, loadWebsiteKeys, open]);

  const meta = PROVIDERS.find((item) => item.id === provider)!;

  const createWebsiteKey = async () => {
    if (!company?.id) return;
    try {
      const call = httpsCallable<
        { companyId: string; label: string; scopes: string[] },
        { id: string; token: string; tokenPrefix: string; scopes: string[] }
      >(functions, "createBusinessWebsiteKey");
      const response = await call({
        companyId: company.id,
        label: label.trim() || `${company.name} website`,
        scopes: ["leads", "payments", "content"],
      });
      setNewToken(response.data.token);
      setCopied(false);
      await loadWebsiteKeys();
      toast.success("Website connector key created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create website key.");
    }
  };

  const revokeWebsiteKey = async (keyId: string) => {
    try {
      const call = httpsCallable<{ keyId: string }, { ok: boolean }>(
        functions,
        "revokeBusinessWebsiteKey",
      );
      await call({ keyId });
      await loadWebsiteKeys();
      toast.success("Website key revoked");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not revoke website key.");
    }
  };

  const copyToken = async () => {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

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

          {provider === "website" && company?.id && (
            <div className="space-y-3 rounded-xl border border-border/50 p-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-1.5 text-sm font-semibold"><KeyRound className="h-4 w-4" /> Server connector keys</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    Use these only in the website backend / Cloud Function. Never embed the token in browser JavaScript.
                  </p>
                </div>
                <Button type="button" size="sm" variant="outline" onClick={createWebsiteKey}>Generate key</Button>
              </div>

              {newToken && (
                <div className="rounded-lg border border-amber-300/60 bg-amber-50/70 p-2.5 dark:bg-amber-950/20">
                  <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">Copy this token now — Hardy will not show it again.</p>
                  <div className="mt-2 flex gap-2">
                    <Input readOnly value={newToken} className="h-8 font-mono text-[10px]" />
                    <Button type="button" size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyToken}>
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                {loadingKeys ? (
                  <p className="text-[11px] text-muted-foreground">Loading keys…</p>
                ) : !websiteKeys.length ? (
                  <p className="text-[11px] text-muted-foreground">No server keys created yet.</p>
                ) : websiteKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">{key.label}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{key.tokenPrefix}•••• · {key.active ? "active" : "revoked"}</p>
                    </div>
                    {key.active && (
                      <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => void revokeWebsiteKey(key.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Endpoint function: <span className="font-mono">businessWebsiteIngress</span>. Supported events: contact, signup, payment and content_published.
              </p>
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

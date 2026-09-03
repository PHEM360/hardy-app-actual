import { useEffect, useState } from "react";
import { ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  clearOnePasswordSettings,
  getOnePasswordSettings,
  saveOnePasswordSettings,
  testOnePasswordConnection,
  type OnePasswordSettingsView,
} from "@/lib/onePasswordConnect";

/** Configure 1Password Connect for live bidirectional login sync. */
export function OnePasswordConnectCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<OnePasswordSettingsView>({ configured: false });
  const [connectUrl, setConnectUrl] = useState("");
  const [vaultId, setVaultId] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [enabled, setEnabled] = useState(true);

  const reload = async () => {
    setLoading(true);
    try {
      const next = await getOnePasswordSettings();
      setSettings(next);
      setConnectUrl(next.connectUrl || "");
      setVaultId(next.vaultId || "");
      setEnabled(next.enabled !== false);
      setAccessToken("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load 1Password settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const save = async () => {
    if (!connectUrl.trim() || !vaultId.trim()) {
      toast.error("Connect URL and vault ID are required");
      return;
    }
    if (!accessToken.trim() && !settings.hasToken) {
      toast.error("Paste your Connect access token");
      return;
    }
    setSaving(true);
    try {
      await saveOnePasswordSettings({
        connectUrl: connectUrl.trim(),
        accessToken: accessToken.trim(),
        vaultId: vaultId.trim(),
        enabled,
      });
      toast.success("1Password Connect linked");
      setAccessToken("");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save Connect settings");
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    setTesting(true);
    try {
      const res = await testOnePasswordConnection();
      toast.success(res.vaultName ? `Connected to “${res.vaultName}”` : "1Password Connect is reachable");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Connection test failed");
    } finally {
      setTesting(false);
    }
  };

  const clear = async () => {
    if (!window.confirm("Disconnect 1Password Connect from Hardy Hub?")) return;
    try {
      await clearOnePasswordSettings();
      toast.success("1Password disconnected");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect");
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/60 bg-card p-4 text-sm text-muted-foreground">
        Loading 1Password settings…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">1Password sync</p>
          <p className="text-[11px] text-muted-foreground">
            Live two-way sync needs{" "}
            <a
              className="font-semibold text-primary underline-offset-2 hover:underline"
              href="https://developer.1password.com/docs/connect/"
              target="_blank"
              rel="noreferrer"
            >
              1Password Connect
            </a>{" "}
            (Business Secrets Automation + a Connect server you host). Personal 1Password has no public sync API —
            CSV import cannot keep both sides updated.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Connect server URL</Label>
          <Input
            value={connectUrl}
            onChange={(e) => setConnectUrl(e.target.value)}
            placeholder="https://connect.example.com"
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Vault UUID</Label>
          <Input
            value={vaultId}
            onChange={(e) => setVaultId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className="h-10 rounded-xl"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">
            Access token{settings.hasToken ? ` (saved ${settings.tokenHint})` : ""}
          </Label>
          <Input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={settings.hasToken ? "Paste token to replace / re-verify" : "ops_…"}
            className="h-10 rounded-xl"
          />
        </div>
        <label className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm">
          <span>Keep Log Ins in sync with this vault</span>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </label>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          className="flex-1 rounded-xl bg-gradient-primary text-primary-foreground border-0"
          disabled={saving}
          onClick={() => void save()}
        >
          {saving ? "Saving…" : settings.configured ? "Update connection" : "Connect 1Password"}
        </Button>
        {settings.configured && (
          <Button variant="outline" className="rounded-xl" disabled={testing} onClick={() => void test()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {testing ? "Testing…" : "Test"}
          </Button>
        )}
      </div>
      {settings.configured && (
        <Button variant="ghost" className="w-full rounded-xl text-destructive" onClick={() => void clear()}>
          Disconnect
        </Button>
      )}
      <a
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"
        href="https://developer.1password.com/docs/connect/get-started/"
        target="_blank"
        rel="noreferrer"
      >
        How to deploy Connect <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

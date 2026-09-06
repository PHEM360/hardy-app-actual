import { useState } from "react";
import { CalendarRange, Landmark, Link2, Loader2, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBankConnections } from "@/hooks/useBankConnections";
import { useBankConnectStatus } from "@/hooks/useBankConnectStatus";
import type { Account } from "@/hooks/useFinance";
import {
  disconnectBank,
  linkBankAccount,
  startBankConnect,
  syncBankBalances,
  unlinkBankAccount,
} from "@/lib/truelayerApi";

function formatSynced(value?: { toDate?: () => Date } | null) {
  try {
    const date = value?.toDate?.();
    if (!date) return "Not synced yet";
    return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "Not synced yet";
  }
}

export default function BankSyncSettings({
  scopeUserId,
  canEdit,
  accounts,
}: {
  scopeUserId?: string | null;
  canEdit: boolean;
  accounts: Account[];
}) {
  const { connections, loading } = useBankConnections(scopeUserId);
  const { configured } = useBankConnectStatus();
  const [busy, setBusy] = useState<string | null>(null);

  const connect = async () => {
    if (configured === false) {
      toast.error("Bank linking is not set up yet. A TrueLayer sandbox app still needs to be added.");
      return;
    }
    setBusy("connect");
    try {
      const url = await startBankConnect();
      window.location.href = url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not start bank connection.";
      toast.error(message.replace(/^FirebaseError:\s*/i, ""));
      setBusy(null);
    }
  };

  const run = async (key: string, fn: () => Promise<void>, success?: string) => {
    setBusy(key);
    try {
      await fn();
      if (success) toast.success(success);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message.replace(/^FirebaseError:\s*/i, ""));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="p-4 sm:p-5 rounded-3xl bg-card border-2 border-border shadow-card mb-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Bank connections</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Connect your bank once. Hardy Hub then copies today’s balance, and can also fill in the last day of each past month — as far back as your bank will share. Most banks only keep a few months, not the full life of the account. You’ll be asked to reconnect about every 90 days.
          </p>
        </div>
        {canEdit && (
          <Button size="sm" className="h-8 rounded-lg text-xs gap-1.5 bg-gradient-primary flex-shrink-0" disabled={!!busy || configured === false} onClick={() => void connect()}>
            {busy === "connect" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5" />}
            Connect bank
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading connections…</p>
      ) : connections.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {configured === false
            ? "Bank linking is waiting on a TrueLayer app. Create one at console.truelayer.com (Sandbox is fine), add the Hardy Hub redirect URLs, then put the client ID and secret in Firebase secrets."
            : "No banks connected yet. Connect once, then pick which account belongs here."}
        </p>
      ) : (
        <div className="space-y-4">
          {connections.map((conn) => (
            <div key={conn.id} className="rounded-2xl border border-border/60 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    TrueLayer {conn.sandbox ? "sandbox" : ""}
                    <span className={`ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                      conn.status === "active" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                    }`}>
                      {conn.status === "needs_reauth" ? "Reconnect needed" : conn.status}
                    </span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Last sync: {formatSynced(conn.lastSyncedAt)}</p>
                  {conn.lastError && <p className="text-[11px] text-destructive mt-0.5">{conn.lastError}</p>}
                </div>
                {canEdit && (
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs gap-1"
                      disabled={!!busy}
                      onClick={() => void run(`sync-${conn.id}`, async () => { await syncBankBalances(conn.id); }, "Today’s balances updated")}
                    >
                      {busy === `sync-${conn.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      Sync today
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs gap-1"
                      disabled={!!busy}
                      onClick={() => void run(`hist-${conn.id}`, async () => {
                        const result = await syncBankBalances(conn.id, true);
                        if (result.months) {
                          toast.success(`Imported ${result.months} month-end balances`);
                        } else {
                          toast.info("The bank did not share enough history to fill past months. Many banks only give a few months.");
                        }
                      })}
                    >
                      {busy === `hist-${conn.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CalendarRange className="w-3.5 h-3.5" />}
                      Import months
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 rounded-lg text-xs gap-1"
                      disabled={!!busy}
                      onClick={() => void run(`off-${conn.id}`, async () => { await disconnectBank(conn.id); }, "Bank disconnected")}
                    >
                      <Unplug className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>

              {conn.accounts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No accounts were returned by the bank.</p>
              ) : (
                <div className="space-y-2">
                  {conn.accounts.map((bank) => (
                    <BankAccountRow
                      key={bank.id}
                      bank={bank}
                      accounts={accounts}
                      canEdit={canEdit}
                      busy={busy}
                      onLink={(financeAccountId, createNew) =>
                        run(`link-${bank.id}`, async () => {
                          await linkBankAccount({
                            connectionId: conn.id,
                            bankAccountId: bank.id,
                            financeAccountId,
                            createNew,
                          });
                        }, "Account linked — today’s balance and past months imported")
                      }
                      onUnlink={() =>
                        run(`unlink-${bank.id}`, async () => {
                          await unlinkBankAccount(conn.id, bank.id);
                        }, "Account unlinked")
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BankAccountRow({
  bank,
  accounts,
  canEdit,
  busy,
  onLink,
  onUnlink,
}: {
  bank: { id: string; name: string; type: string; masked: string; linkedAccountId: string | null };
  accounts: Account[];
  canEdit: boolean;
  busy: string | null;
  onLink: (financeAccountId?: string, createNew?: boolean) => void;
  onUnlink: () => void;
}) {
  const [choice, setChoice] = useState("");
  const linked = accounts.find((a) => a.id === bank.linkedAccountId);

  return (
    <div className="rounded-xl bg-muted/30 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{bank.name}</p>
        <p className="text-[11px] text-muted-foreground">{bank.type}{bank.masked ? ` · ${bank.masked}` : ""}</p>
      </div>
      {linked ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1">
            <Link2 className="w-3.5 h-3.5" /> {linked.name}
          </span>
          {canEdit && (
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={!!busy} onClick={onUnlink}>Unlink</Button>
          )}
        </div>
      ) : canEdit ? (
        <div className="flex items-center gap-1.5">
          <Select value={choice} onValueChange={setChoice}>
            <SelectTrigger className="h-8 rounded-lg text-xs w-40"><SelectValue placeholder="Link to…" /></SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 rounded-lg text-xs" disabled={!!busy || !choice} onClick={() => onLink(choice)}>
            Link
          </Button>
          <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" disabled={!!busy} onClick={() => onLink(undefined, true)}>
            Create
          </Button>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Not linked</span>
      )}
    </div>
  );
}

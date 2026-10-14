import { useEffect, useState, type CSSProperties } from "react";
import { CalendarRange, Landmark, Link2, Loader2, Plus, RefreshCw, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBankConnections } from "@/hooks/useBankConnections";
import { useBankConnectStatus } from "@/hooks/useBankConnectStatus";
import type { Account } from "@/hooks/useFinance";
import { JEWEL, STATUS_COLOR } from "@/lib/brandPalette";
import {
  disconnectBank,
  linkBankAccount,
  startBankConnect,
  syncBankBalances,
  unlinkBankAccount,
  type BankHistoryFrequency,
  type BankHistoryOptions,
  type BankSyncResult,
} from "@/lib/truelayerApi";
import { openExternalUrl } from "@/lib/nativeApp";

const HISTORY_KEY = "hardyhub.bankHistoryOptions";
const DEFAULT_HISTORY: BankHistoryOptions = { months: 6, frequency: "weekly", time: "21:00" };
const MONTH_CHOICES = [1, 3, 6, 12, 24];
const FREQUENCY_CHOICES: { id: BankHistoryFrequency; label: string; noun: string }[] = [
  { id: "daily", label: "Daily", noun: "daily" },
  { id: "weekly", label: "Weekly", noun: "weekly" },
  { id: "monthly", label: "Month end", noun: "month end" },
];
const FIELD_LABEL = "text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70";

function optionClass(active: boolean) {
  return `min-h-10 rounded-md border px-3 py-2 text-xs font-bold transition-colors ${
    active
      ? "btn-edge border-[var(--sec)] bg-[var(--sec)] text-white"
      : "border-foreground/20 bg-card text-foreground hover:border-[var(--sec)] hover:text-[var(--sec)]"
  }`;
}

function loadHistoryOptions(): BankHistoryOptions {
  try {
    const raw = JSON.parse(window.localStorage.getItem(HISTORY_KEY) || "null") as Partial<BankHistoryOptions> | null;
    if (!raw) return DEFAULT_HISTORY;
    return {
      months: MONTH_CHOICES.includes(Number(raw.months)) ? Number(raw.months) : DEFAULT_HISTORY.months,
      frequency: FREQUENCY_CHOICES.some((f) => f.id === raw.frequency) ? (raw.frequency as BankHistoryFrequency) : DEFAULT_HISTORY.frequency,
      time: typeof raw.time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(raw.time) ? raw.time : DEFAULT_HISTORY.time,
    };
  } catch {
    return DEFAULT_HISTORY;
  }
}

function formatSynced(value?: { toDate?: () => Date } | null) {
  try {
    const date = value?.toDate?.();
    if (!date) return "Not synced yet";
    return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "Not synced yet";
  }
}

function formatDay(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? day : date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function monthsLabel(months: number) {
  return months === 1 ? "1 month" : months === 12 ? "1 year" : months === 24 ? "2 years" : `${months} months`;
}

/** Tell the person plainly what came in, and why if it was less than they asked for. */
function reportImport(result: BankSyncResult, options: BankHistoryOptions) {
  if (result.updated === 0) {
    toast.error("No bank accounts are attached to this page yet, so there was nothing to bring in. Attach an account first.");
    return;
  }
  if (result.points === 0 || !result.earliest) {
    toast.info("Today's balance was saved, but the bank did not share any past transactions to work back from.");
    return;
  }
  const noun = FREQUENCY_CHOICES.find((f) => f.id === options.frequency)?.noun ?? options.frequency;
  toast.success(`Brought in ${result.points} ${noun} balances back to ${formatDay(result.earliest)}.`);
  const wanted = new Date();
  wanted.setMonth(wanted.getMonth() - options.months);
  const gapDays = (new Date(`${result.earliest}T00:00:00Z`).getTime() - wanted.getTime()) / 86_400_000;
  const allowed = options.frequency === "monthly" ? 45 : 21;
  if (gapDays > allowed) {
    toast.info(
      `That is less than the ${monthsLabel(options.months)} you asked for. Many banks only release older history in the first few minutes after you connect. To get more, disconnect, connect again and import straight away.`,
      { duration: 12000 },
    );
  }
}

export default function BankSyncSettings({
  scopeUserId,
  canEdit,
  accounts,
  householdId,
}: {
  scopeUserId?: string | null;
  canEdit: boolean;
  accounts: Pick<Account, "id" | "name">[];
  householdId?: string;
}) {
  const { connections, loading } = useBankConnections(scopeUserId);
  const { configured, using, mismatch } = useBankConnectStatus();
  const [busy, setBusy] = useState<string | null>(null);
  const [history, setHistory] = useState<BankHistoryOptions>(loadHistoryOptions);
  const pageLabel = householdId ? "this household page" : "Personal Finance";

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch {
      // Storage can be blocked. The choice still applies for this visit.
    }
  }, [history]);

  const connect = async () => {
    if (configured === false) {
      toast.error("Bank linking is not set up yet. Add the TrueLayer client ID and secret in Firebase, and allow https://hardyapp.co.uk/api/truelayer/callback in TrueLayer Console.");
      return;
    }
    setBusy("connect");
    try {
      const url = await startBankConnect(window.location.pathname);
      if (!url) throw new Error("TrueLayer did not return a login address.");
      await openExternalUrl(url);
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : "Could not start bank connection.";
      const message = raw.replace(/^FirebaseError:\s*/i, "");
      toast.error(
        /unknown client|not enabled|invalid_client/i.test(message)
          ? "TrueLayer did not recognise this app. Check the live client ID and secret, and that the callback https://hardyapp.co.uk/api/truelayer/callback is listed on the TrueLayer app."
          : message,
      );
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

  const linkedHere = (conn: (typeof connections)[number], bankId: string, fallback: string | null) =>
    householdId ? conn.householdMappings?.[householdId]?.[bankId] || null : fallback;

  const historySummary = `${FREQUENCY_CHOICES.find((f) => f.id === history.frequency)?.label} balances as at ${history.time}, for the last ${monthsLabel(history.months)}.`;

  return (
    <div
      className="mb-5 overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card"
      style={{ "--sec": JEWEL.petrol } as CSSProperties}
    >
      <div className="band flex items-center justify-between gap-3 bg-[var(--sec)] px-4 py-3">
        <div className="min-w-0">
          <h3 className="font-display text-base font-bold text-white">Bank connections</h3>
          {configured && (
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/80">
              TrueLayer {using === "live" ? "live" : "sandbox"}
            </p>
          )}
        </div>
        {canEdit && (
          <Button variant="gold" size="sm" className="h-10 flex-shrink-0" disabled={!!busy || configured === false} onClick={() => void connect()}>
            {busy === "connect" ? <Loader2 className="animate-spin" /> : <Landmark />}
            Connect bank
          </Button>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <p className="text-sm text-foreground">
          There are two steps. First connect the bank. Then attach each bank account to an account on {pageLabel}. Balances only come in for accounts that are attached.
        </p>
        {mismatch && (
          <p className="text-xs font-medium text-foreground/80">
            The saved TrueLayer client belonged to the other environment, so Hardy Hub switched automatically.
          </p>
        )}

        {canEdit && connections.length > 0 && (
          <div className="space-y-3 rounded-lg border border-foreground/20 bg-background p-3">
            <div>
              <p className="font-display text-sm font-bold text-foreground">Past balances to bring in</p>
              <p className="text-xs text-foreground/80">{historySummary} This is used when you attach an account and when you tap Import history.</p>
            </div>
            <div className="space-y-1.5">
              <p className={FIELD_LABEL}>How far back</p>
              <div className="flex flex-wrap gap-2">
                {MONTH_CHOICES.map((months) => (
                  <button key={months} type="button" className={optionClass(history.months === months)} onClick={() => setHistory((h) => ({ ...h, months }))}>
                    {monthsLabel(months)}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className={FIELD_LABEL}>How often</p>
              <div className="flex flex-wrap gap-2">
                {FREQUENCY_CHOICES.map((choice) => (
                  <button key={choice.id} type="button" className={optionClass(history.frequency === choice.id)} onClick={() => setHistory((h) => ({ ...h, frequency: choice.id }))}>
                    {choice.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bank-history-time" className={FIELD_LABEL}>Balance as at (UK time)</label>
              <Input
                id="bank-history-time"
                type="time"
                value={history.time}
                onChange={(event) => {
                  const time = event.target.value;
                  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) setHistory((h) => ({ ...h, time }));
                }}
                className="h-10 w-32 rounded-lg border-foreground/30 bg-card font-semibold tabular-nums"
              />
            </div>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-foreground/80">Loading connections…</p>
        ) : connections.length === 0 ? (
          <p className="rounded-lg border-l-4 border-[var(--sec)] bg-[color-mix(in_srgb,var(--sec)_14%,hsl(var(--card)))] p-4 text-sm font-medium text-foreground">
            {configured === false
              ? "Bank linking is waiting on a TrueLayer app. Add the Hardy Hub callback https://hardyapp.co.uk/api/truelayer/callback in Console, then put the client ID and secret in Firebase secrets."
              : "No banks connected yet. Tap Connect bank to start."}
          </p>
        ) : (
          <div className="space-y-4">
            {connections.map((conn) => {
              const unattached = conn.accounts.filter((bank) => !linkedHere(conn, bank.id, bank.linkedAccountId));
              const noneAttached = conn.accounts.length > 0 && unattached.length === conn.accounts.length;
              return (
                <div key={conn.id} className="space-y-3 rounded-lg border border-foreground/20 border-l-4 border-l-[var(--sec)] bg-card p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-foreground">
                        TrueLayer {conn.sandbox ? "sandbox" : ""}
                        <span
                          className="rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em]"
                          style={
                            conn.status === "active"
                              ? { background: STATUS_COLOR.good, color: "#fff" }
                              : { background: STATUS_COLOR.warn, color: STATUS_COLOR.warnText }
                          }
                        >
                          {conn.status === "needs_reauth" ? "Reconnect needed" : conn.status}
                        </span>
                      </p>
                      <p className="mt-1 text-xs text-foreground/80">Last sync: {formatSynced(conn.lastSyncedAt)}</p>
                      {conn.lastError && <p className="mt-1 text-xs font-semibold text-destructive">{conn.lastError}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10"
                          disabled={!!busy}
                          onClick={() => void run(`sync-${conn.id}`, async () => {
                            const result = await syncBankBalances(conn.id);
                            if (result.updated === 0) {
                              toast.error("No bank accounts are attached yet, so there was nothing to update. Attach an account first.");
                            } else {
                              toast.success("Today’s balances updated");
                            }
                          })}
                        >
                          {busy === `sync-${conn.id}` ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                          Sync today
                        </Button>
                        <Button
                          size="sm"
                          className="h-10"
                          disabled={!!busy}
                          onClick={() => void run(`hist-${conn.id}`, async () => {
                            reportImport(await syncBankBalances(conn.id, history), history);
                          })}
                        >
                          {busy === `hist-${conn.id}` ? <Loader2 className="animate-spin" /> : <CalendarRange />}
                          Import history
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-10"
                          disabled={!!busy}
                          onClick={() => void run(`off-${conn.id}`, async () => { await disconnectBank(conn.id); }, "Bank disconnected")}
                        >
                          <Unplug />
                          Disconnect
                        </Button>
                      </div>
                    )}
                  </div>

                  {conn.accounts.length === 0 ? (
                    <p className="text-sm text-foreground/80">No accounts were returned by the bank.</p>
                  ) : (
                    <>
                      {noneAttached && (
                        <div
                          className="space-y-2 rounded-lg p-3"
                          style={{ background: STATUS_COLOR.warn, color: STATUS_COLOR.warnText }}
                        >
                          <p className="text-sm font-bold">Step 2. Nothing is attached to {pageLabel} yet, so no balances can come in.</p>
                          <p className="text-xs font-medium">Attach each account below, or add them all as new accounts in one go.</p>
                          {canEdit && (
                            <Button
                              size="sm"
                              className="h-10"
                              disabled={!!busy}
                              onClick={() => void run(`all-${conn.id}`, async () => {
                                for (const bank of unattached) {
                                  await linkBankAccount({
                                    connectionId: conn.id,
                                    bankAccountId: bank.id,
                                    createNew: true,
                                    scope: householdId ? "household" : "personal",
                                    householdId,
                                    sync: false,
                                  });
                                }
                                reportImport(await syncBankBalances(conn.id, history), history);
                              })}
                            >
                              {busy === `all-${conn.id}` ? <Loader2 className="animate-spin" /> : <Plus />}
                              {unattached.length === 1 ? "Add it as a new account" : `Add all ${unattached.length} as new accounts`}
                            </Button>
                          )}
                        </div>
                      )}
                      <div className="space-y-2">
                        {conn.accounts.map((bank) => (
                          <BankAccountRow
                            key={bank.id}
                            bank={{ ...bank, linkedAccountId: linkedHere(conn, bank.id, bank.linkedAccountId) }}
                            accounts={accounts}
                            canEdit={canEdit}
                            busy={busy}
                            working={busy === `link-${bank.id}`}
                            onLink={(financeAccountId, createNew) =>
                              run(`link-${bank.id}`, async () => {
                                const linked = await linkBankAccount({
                                  connectionId: conn.id,
                                  bankAccountId: bank.id,
                                  financeAccountId,
                                  createNew,
                                  scope: householdId ? "household" : "personal",
                                  householdId,
                                  history,
                                });
                                if (linked.syncError) {
                                  toast.error(`The account is attached, but the bank would not hand over balances: ${linked.syncError}`);
                                } else if (linked.result) {
                                  reportImport(linked.result, history);
                                } else {
                                  toast.success("Account attached");
                                }
                              })
                            }
                            onUnlink={() =>
                              run(`unlink-${bank.id}`, async () => {
                                await unlinkBankAccount(conn.id, bank.id, householdId);
                              }, "Account detached")
                            }
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function BankAccountRow({
  bank,
  accounts,
  canEdit,
  busy,
  working,
  onLink,
  onUnlink,
}: {
  bank: { id: string; name: string; type: string; masked: string; linkedAccountId: string | null };
  accounts: Pick<Account, "id" | "name">[];
  canEdit: boolean;
  busy: string | null;
  working: boolean;
  onLink: (financeAccountId?: string, createNew?: boolean) => void;
  onUnlink: () => void;
}) {
  const [choice, setChoice] = useState("");
  const linked = accounts.find((a) => a.id === bank.linkedAccountId);

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-foreground/20 bg-background p-3 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-foreground">{bank.name}</p>
        <p className="text-xs text-foreground/80">{bank.type}{bank.masked ? ` · ${bank.masked}` : ""}</p>
      </div>
      {linked ? (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="flex min-h-10 items-center gap-1.5 rounded-md px-3 text-xs font-bold text-white"
            style={{ background: STATUS_COLOR.good }}
          >
            <Link2 className="h-3.5 w-3.5" /> {linked.name}
          </span>
          {canEdit && (
            <Button size="sm" variant="outline" className="h-10" disabled={!!busy} onClick={onUnlink}>Detach</Button>
          )}
        </div>
      ) : canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          {accounts.length > 0 && (
            <>
              <Select value={choice} onValueChange={setChoice}>
                <SelectTrigger className="h-10 w-44 rounded-lg border-foreground/30 bg-card text-xs font-semibold"><SelectValue placeholder="Attach to…" /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" className="h-10" disabled={!!busy || !choice} onClick={() => onLink(choice)}>
                Attach
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" className="h-10" disabled={!!busy} onClick={() => onLink(undefined, true)}>
            {working ? <Loader2 className="animate-spin" /> : <Plus />}
            New account
          </Button>
        </div>
      ) : (
        <span className="text-xs font-semibold text-foreground/80">Not attached</span>
      )}
    </div>
  );
}

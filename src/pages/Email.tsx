import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Inbox, Loader2, Mail, MailPlus, RefreshCw, Reply, ReplyAll, Forward, Send,
  Sparkles, Star, Trash2, Unplug, UserRound, WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMail } from "@/hooks/useMail";
import { useSharedScope } from "@/hooks/useSharedScope";
import {
  applyMailAiActions,
  connectImapAccount,
  disconnectMailAccount,
  runMailAi,
  sendMail,
  startGmailConnect,
  syncMailbox,
  updateMailFlags,
} from "@/lib/mailApi";
import {
  DEFAULT_MAIL_INSTRUCTIONS,
  extractEmailAddress,
  filterMailMessages,
  forwardSubject,
  guessMailHosts,
  quoteReplyBody,
  replySubject,
} from "@/lib/mailLogic";
import type { MailCompose, MailMessage, MailRail } from "@/types/mail";

const ACCENT = "hsl(239,70%,58%)";
const RAILS: Array<{ id: MailRail; label: string; icon: typeof Inbox }> = [
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "unread", label: "Unread", icon: Mail },
  { id: "starred", label: "Starred", icon: Star },
  { id: "sent", label: "Sent", icon: Send },
  { id: "lists", label: "Lists", icon: UserRound },
  { id: "ai", label: "AI", icon: WandSparkles },
  { id: "accounts", label: "Accounts", icon: Unplug },
];

function railClass(active: boolean) {
  return `flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-xs font-semibold transition-colors ${
    active ? "bg-gradient-primary text-primary-foreground shadow-sm" : "text-foreground hover:bg-card"
  }`;
}

function chipClass(active: boolean) {
  return `rounded-xl border px-2.5 py-1.5 text-xs font-semibold ${
    active ? "border-primary/50 bg-gradient-primary text-primary-foreground" : "border-border/50 bg-card text-foreground"
  }`;
}

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const sameDay = new Date().toDateString() === date.toDateString();
  return date.toLocaleString("en-GB", sameDay ?
    { hour: "2-digit", minute: "2-digit" } :
    { day: "numeric", month: "short" });
}

function emptyCompose(accountId: string): MailCompose {
  return { accountId, to: "", cc: "", subject: "", body: "" };
}

export default function Email() {
  const { scopeUserId, permission, pageTitle, isOwnScope } = useSharedScope("email");
  const mail = useMail(scopeUserId);
  const canEdit = permission === "edit";
  const [rail, setRail] = useState<MailRail>("inbox");
  const [accountId, setAccountId] = useState("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [compose, setCompose] = useState<MailCompose | null>(null);
  const [instruction, setInstruction] = useState(DEFAULT_MAIL_INSTRUCTIONS);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();
  const [imap, setImap] = useState({ email: "", password: "", displayName: "", imapHost: "" });
  const didAutoSync = useRef(false);

  useEffect(() => {
    setInstruction(mail.settings.instructions);
  }, [mail.settings.instructions]);

  useEffect(() => {
    if (params.get("mail") === "connected") toast.success("Mailbox linked");
    if (params.get("mail") === "error") toast.error("That mailbox login did not finish");
    if (!params.get("mail")) return;
    const next = new URLSearchParams(params);
    next.delete("mail");
    next.delete("reason");
    setParams(next, { replace: true });
    setRail("accounts");
  }, [params, setParams]);

  const visible = useMemo(
    () => filterMailMessages(mail.messages, rail === "ai" || rail === "accounts" ? "inbox" : rail, accountId, query),
    [mail.messages, rail, accountId, query],
  );
  const selected = mail.messages.find((item) => item.id === selectedId) || visible[0] || null;
  const owner = scopeUserId || undefined;

  useEffect(() => {
    if (selected && selected.id !== selectedId) setSelectedId(selected.id);
  }, [selected, selectedId]);

  useEffect(() => {
    if (didAutoSync.current || !canEdit || !mail.accounts.length || mail.loading) return;
    const stale = mail.accounts.some((account) => {
      const at = account.lastSyncAt ? Date.parse(account.lastSyncAt) : 0;
      return !at || Date.now() - at > 5 * 60 * 1000;
    });
    if (!stale) return;
    didAutoSync.current = true;
    void syncMailbox(owner).catch(() => undefined);
  }, [canEdit, mail.accounts, mail.loading, owner]);

  const refresh = async () => {
    if (!canEdit) return;
    setBusy(true);
    try {
      const result = await syncMailbox(owner, accountId === "all" ? undefined : accountId);
      toast.success(result.synced ? `Refreshed ${result.synced} message${result.synced === 1 ? "" : "s"}` : "Already up to date");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not refresh mail");
    } finally {
      setBusy(false);
    }
  };

  const openCompose = (mode: "new" | "reply" | "replyAll" | "forward", message?: MailMessage | null) => {
    const fallbackAccount = accountId !== "all" ? accountId : mail.accounts[0]?.id || "";
    if (mode === "new" || !message) {
      setCompose(emptyCompose(fallbackAccount));
      return;
    }
    const me = extractEmailAddress(mail.accounts.find((item) => item.id === message.accountId)?.email || "");
    const from = extractEmailAddress(message.from) || message.from;
    const others = message.to.filter((item) => extractEmailAddress(item) !== me && extractEmailAddress(item) !== from);
    setCompose({
      accountId: message.accountId || fallbackAccount,
      to: mode === "forward" ? "" : mode === "replyAll" ? [from, ...others].filter(Boolean).join(", ") : from,
      cc: mode === "replyAll" ? message.cc.join(", ") : "",
      subject: mode === "forward" ? forwardSubject(message.subject) : replySubject(message.subject),
      body: quoteReplyBody(message.fromName || message.from, when(message.date), message.bodyText),
      inReplyTo: message.threadId,
      references: message.threadId,
    });
  };

  const send = async () => {
    if (!compose) return;
    setBusy(true);
    try {
      await sendMail({ ...compose, ownerUid: owner });
      toast.success("Sent");
      setCompose(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send");
    } finally {
      setBusy(false);
    }
  };

  const toggleStar = async (message: MailMessage) => {
    if (!canEdit) return;
    await mail.patchMessage(message.id, { starred: !message.starred });
    try {
      await updateMailFlags({ ownerUid: owner, messageId: message.id, starred: !message.starred });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not star that");
    }
  };

  const openMessage = async (message: MailMessage) => {
    setSelectedId(message.id);
    if (canEdit && message.unread) {
      await mail.patchMessage(message.id, { unread: false });
      void updateMailFlags({ ownerUid: owner, messageId: message.id, unread: false });
    }
  };

  const bin = async (message: MailMessage) => {
    if (!canEdit) return;
    await mail.patchMessage(message.id, { folder: "trash", unread: false });
    try {
      await updateMailFlags({ ownerUid: owner, messageId: message.id, folder: "trash" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move that");
    }
  };

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle="Your mailbox, with AI to sort lists and draft the boring replies"
      icon={<Mail className="h-5 w-5" />}
      sharePage="email"
      action={canEdit ? (
        <Button size="sm" onClick={() => openCompose("new")}>
          <MailPlus className="mr-1.5 h-3.5 w-3.5" /> Write
        </Button>
      ) : undefined}
    >
      <div className="flex min-w-0 gap-3">
        <aside className="w-[4.5rem] shrink-0 sm:w-[10.75rem]">
          <div
            className="sticky top-2 space-y-1 rounded-2xl border border-border/40 p-1.5 shadow-card"
            style={{ background: `color-mix(in srgb, ${ACCENT} 12%, hsl(var(--card)))` }}
          >
            {RAILS.map((item) => {
              const Icon = item.icon;
              const count = item.id === "unread" ? mail.unreadCount : 0;
              return (
                <button key={item.id} type="button" className={railClass(rail === item.id)} onClick={() => setRail(item.id)}>
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="hidden truncate sm:inline">{item.label}</span>
                  {count > 0 && (
                    <span className={`ml-auto hidden rounded-full px-1.5 text-[10px] font-bold sm:inline ${rail === item.id ? "bg-primary-foreground/20" : "border border-border/60 bg-background"}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-w-0 flex-1 space-y-3 overflow-x-hidden">
          {rail !== "ai" && rail !== "accounts" && (
            <div className="rounded-2xl border border-border/40 bg-card p-3 shadow-card">
              <div className="flex flex-wrap gap-1.5">
                <button type="button" className={chipClass(accountId === "all")} onClick={() => setAccountId("all")}>All accounts</button>
                {mail.accounts.map((account) => (
                  <button key={account.id} type="button" className={chipClass(accountId === account.id)} onClick={() => setAccountId(account.id)}>
                    {account.displayName}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this mailbox" />
                {canEdit && (
                  <Button size="sm" variant="secondary" disabled={busy || !mail.accounts.length} onClick={() => void refresh()}>
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Sync
                  </Button>
                )}
              </div>
            </div>
          )}

          {rail === "accounts" ? (
            <AccountsPanel
              canEdit={canEdit && isOwnScope}
              accounts={mail.accounts}
              imap={imap}
              setImap={setImap}
              busy={busy}
              onGmail={async () => {
                setBusy(true);
                try {
                  window.location.href = await startGmailConnect(owner);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not start Gmail");
                  setBusy(false);
                }
              }}
              onImap={async () => {
                setBusy(true);
                try {
                  await connectImapAccount({ ownerUid: owner, ...imap });
                  toast.success("Mailbox added");
                  setImap({ email: "", password: "", displayName: "", imapHost: "" });
                  await syncMailbox(owner);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not add that mailbox");
                } finally {
                  setBusy(false);
                }
              }}
              onRemove={async (id) => {
                setBusy(true);
                try {
                  await disconnectMailAccount(owner, id);
                  toast.success("Account removed");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not remove that account");
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : rail === "ai" ? (
            <AiPanel
              canEdit={canEdit}
              instruction={instruction}
              setInstruction={setInstruction}
              result={mail.aiResult}
              busy={busy}
              onSave={() => void mail.saveInstructions(instruction)}
              onRun={async () => {
                setBusy(true);
                try {
                  await mail.saveInstructions(instruction);
                  await runMailAi(owner, instruction);
                  toast.success("AI finished looking through the mailbox");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "AI could not run");
                } finally {
                  setBusy(false);
                }
              }}
              onApply={async (ids) => {
                setBusy(true);
                try {
                  const result = await applyMailAiActions(owner, ids);
                  toast.success(result.applied ? `Sent ${result.applied} confirmed action${result.applied === 1 ? "" : "s"}` : "Nothing to send");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not apply those");
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : mail.loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Opening mailbox…</p>
          ) : !mail.accounts.length ? (
            <EmptyMailbox onAccounts={() => setRail("accounts")} />
          ) : (
            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
              <div className="space-y-1.5">
                {visible.length ? visible.map((message) => (
                  <button
                    key={message.id}
                    type="button"
                    onClick={() => void openMessage(message)}
                    className="w-full rounded-2xl border border-border/40 p-3 text-left shadow-card"
                    style={{
                      background: selected?.id === message.id ?
                        `color-mix(in srgb, ${ACCENT} 16%, hsl(var(--card)))` :
                        `color-mix(in srgb, ${ACCENT} 8%, hsl(var(--card)))`,
                      borderLeftWidth: 4,
                      borderLeftColor: message.unread ? ACCENT : "transparent",
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className={`truncate text-sm ${message.unread ? "font-bold" : "font-semibold"}`}>{message.fromName}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{when(message.date)}</span>
                    </div>
                    <p className="truncate text-sm">{message.subject}</p>
                    <p className="truncate text-xs text-muted-foreground">{message.snippet}</p>
                  </button>
                )) : (
                  <div className="rounded-2xl border border-border/40 bg-card p-6 text-center shadow-card">
                    <p className="font-display font-bold">Nothing here</p>
                    <p className="mt-1 text-sm text-muted-foreground">Sync the mailbox, or try another folder.</p>
                  </div>
                )}
              </div>
              {selected ? (
                <article className="rounded-2xl border border-border/40 bg-card p-4 shadow-card" style={{ borderLeftWidth: 4, borderLeftColor: ACCENT }}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display text-lg font-bold">{selected.subject}</p>
                      <p className="text-sm text-muted-foreground">{selected.fromName} · {selected.from}</p>
                      {selected.aiSummary && <p className="mt-1 text-sm">{selected.aiSummary}</p>}
                    </div>
                    {canEdit && (
                      <div className="flex flex-wrap gap-1.5">
                        <Button size="sm" variant="secondary" onClick={() => openCompose("reply", selected)}><Reply className="h-3.5 w-3.5" /> Reply</Button>
                        <Button size="sm" variant="secondary" onClick={() => openCompose("replyAll", selected)}><ReplyAll className="h-3.5 w-3.5" /> Reply all</Button>
                        <Button size="sm" variant="secondary" onClick={() => openCompose("forward", selected)}><Forward className="h-3.5 w-3.5" /> Forward</Button>
                        <Button size="sm" variant="ghost" onClick={() => void toggleStar(selected)}><Star className={`h-3.5 w-3.5 ${selected.starred ? "fill-current" : ""}`} /></Button>
                        <Button size="sm" variant="ghost" onClick={() => void bin(selected)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    )}
                  </div>
                  {(selected.isMailingList || selected.aiCategory) && (
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {selected.isMailingList ? "Mailing list" : selected.aiCategory}
                    </p>
                  )}
                  <pre className="mt-4 whitespace-pre-wrap font-sans text-sm leading-relaxed">{selected.bodyText || selected.snippet}</pre>
                </article>
              ) : null}
            </div>
          )}
        </div>
      </div>

      <Dialog open={!!compose} onOpenChange={(open) => !open && setCompose(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Write an email</DialogTitle>
          </DialogHeader>
          {compose && (
            <div className="space-y-3">
              <div>
                <Label>From</Label>
                <select
                  className="mt-1 h-11 w-full rounded-xl border-2 border-border bg-input px-3 text-sm"
                  value={compose.accountId}
                  onChange={(event) => setCompose({ ...compose, accountId: event.target.value })}
                >
                  {mail.accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.email}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>To</Label>
                <Input className="mt-1" value={compose.to} onChange={(event) => setCompose({ ...compose, to: event.target.value })} />
              </div>
              <div>
                <Label>Cc</Label>
                <Input className="mt-1" value={compose.cc} onChange={(event) => setCompose({ ...compose, cc: event.target.value })} />
              </div>
              <div>
                <Label>Subject</Label>
                <Input className="mt-1" value={compose.subject} onChange={(event) => setCompose({ ...compose, subject: event.target.value })} />
              </div>
              <div>
                <Label>Message</Label>
                <Textarea className="mt-1 min-h-40" value={compose.body} onChange={(event) => setCompose({ ...compose, body: event.target.value })} />
              </div>
              <Button className="w-full" disabled={busy} onClick={() => void send()}>Send</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </FeaturePageShell>
  );
}

function EmptyMailbox({ onAccounts }: { onAccounts: () => void }) {
  return (
    <div
      className="rounded-2xl border border-border/40 px-6 py-12 text-center shadow-card"
      style={{ background: `color-mix(in srgb, ${ACCENT} 12%, hsl(var(--card)))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}
    >
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-glow">
        <Mail className="h-6 w-6" />
      </div>
      <p className="font-display text-xl font-bold">Add your first mailbox</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Connect Gmail in the app, or add Outlook, iCloud or another account with an app password. Mail stays on the server — never in the browser.
      </p>
      <Button className="mt-5" onClick={onAccounts}>Connect an account</Button>
    </div>
  );
}

function AccountsPanel({
  canEdit,
  accounts,
  imap,
  setImap,
  busy,
  onGmail,
  onImap,
  onRemove,
}: {
  canEdit: boolean;
  accounts: ReturnType<typeof useMail>["accounts"];
  imap: { email: string; password: string; displayName: string; imapHost: string };
  setImap: (value: { email: string; password: string; displayName: string; imapHost: string }) => void;
  busy: boolean;
  onGmail: () => void;
  onImap: () => void;
  onRemove: (id: string) => void;
}) {
  const guessed = guessMailHosts(imap.email);
  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <article key={account.id} className="rounded-2xl border border-border/40 bg-card p-4 shadow-card" style={{ borderLeftWidth: 4, borderLeftColor: ACCENT }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-display font-bold">{account.displayName}</p>
              <p className="text-sm text-muted-foreground">{account.email} · {account.provider === "gmail" ? "Gmail" : account.host}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {account.status === "ok" ? (account.lastSyncAt ? `Synced ${when(account.lastSyncAt)}` : "Ready to sync") : account.lastError || account.status}
              </p>
            </div>
            {canEdit && (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onRemove(account.id)}>Remove</Button>
            )}
          </div>
        </article>
      ))}

      {canEdit ? (
        <>
          <div className="rounded-2xl border border-border/40 p-4 shadow-card" style={{ background: `color-mix(in srgb, ${ACCENT} 10%, hsl(var(--card)))` }}>
            <p className="font-display text-lg font-bold">Connect Gmail</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with Google in this app. The refresh token stays on the server. In Google Cloud, add this redirect:
              <span className="mt-1 block break-all font-mono text-[11px] text-foreground">https://hardyhub-7b30d.web.app/api/mail/callback</span>
            </p>
            <Button className="mt-3" disabled={busy} onClick={onGmail}>Connect Gmail</Button>
          </div>
          <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-card">
            <p className="font-display text-lg font-bold">Other accounts</p>
            <p className="mt-1 text-sm text-muted-foreground">Use an app password from Google, Microsoft, Apple or your host. The normal login password is not stored here.</p>
            <div className="mt-3 space-y-2">
              <Input placeholder="Email address" value={imap.email} onChange={(event) => setImap({ ...imap, email: event.target.value })} />
              <Input placeholder="Display name" value={imap.displayName} onChange={(event) => setImap({ ...imap, displayName: event.target.value })} />
              <Input type="password" placeholder="App password" value={imap.password} onChange={(event) => setImap({ ...imap, password: event.target.value })} autoComplete="new-password" />
              <Input placeholder={guessed?.imap || "Incoming server, if it is not guessed"} value={imap.imapHost} onChange={(event) => setImap({ ...imap, imapHost: event.target.value })} />
              <Button disabled={busy} onClick={onImap}>Add mailbox</Button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Only the owner can connect or remove accounts.</p>
      )}
    </div>
  );
}

function AiPanel({
  canEdit,
  instruction,
  setInstruction,
  result,
  busy,
  onSave,
  onRun,
  onApply,
}: {
  canEdit: boolean;
  instruction: string;
  setInstruction: (value: string) => void;
  result: ReturnType<typeof useMail>["aiResult"];
  busy: boolean;
  onSave: () => void;
  onRun: () => void;
  onApply: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    setPicked(result?.actions.filter((action) => action.type === "unsubscribe").map((action) => action.id) || []);
  }, [result]);

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-border/40 p-4 shadow-card" style={{ background: `color-mix(in srgb, ${ACCENT} 10%, hsl(var(--card)))` }}>
        <p className="font-display text-lg font-bold">Tell the AI what to do</p>
        <p className="mt-1 text-sm text-muted-foreground">It can sort mail, find lists you are on, and draft unsubscribes. It will not send until you confirm.</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[
            "Find mailing lists and draft emails to remove me",
            "Keep personal and work, hide promo",
            "Summarise unread from this week",
          ].map((hint) => (
            <button key={hint} type="button" className={chipClass(instruction === hint)} onClick={() => setInstruction(hint)}>
              {hint}
            </button>
          ))}
        </div>
        <Textarea className="mt-3 min-h-28" value={instruction} onChange={(event) => setInstruction(event.target.value)} disabled={!canEdit} />
        {canEdit && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy} onClick={onSave}>Save instruction</Button>
            <Button disabled={busy} onClick={onRun}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Run AI
            </Button>
          </div>
        )}
      </div>
      {result && (
        <div className="rounded-2xl border border-border/40 bg-card p-4 shadow-card">
          <p className="font-display font-bold">Last run</p>
          <p className="mt-1 text-sm">{result.summary}</p>
          <p className="mt-1 text-xs text-muted-foreground">{result.classified} messages labelled</p>
          <div className="mt-3 space-y-2">
            {result.actions.map((action) => (
              <label key={action.id} className="flex items-start gap-2 rounded-xl bg-card px-2 py-2" style={{ background: `color-mix(in srgb, ${ACCENT} 8%, hsl(var(--card)))` }}>
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={picked.includes(action.id)}
                  onChange={() => setPicked((current) => current.includes(action.id) ? current.filter((id) => id !== action.id) : [...current, action.id])}
                />
                <span className="text-sm">
                  <span className="font-semibold capitalize">{action.type}</span>
                  {action.to ? ` · ${action.to}` : ""}
                  <span className="block text-muted-foreground">{action.reason || action.subject}</span>
                </span>
              </label>
            ))}
          </div>
          {canEdit && result.actions.length > 0 && (
            <Button className="mt-3" disabled={busy || !picked.length} onClick={() => onApply(picked)}>
              Confirm and send {picked.length || ""}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

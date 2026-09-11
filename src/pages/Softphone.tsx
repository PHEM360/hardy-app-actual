import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Phone, PhoneCall, PhoneIncoming, PhoneOff, Mic, MicOff,
  Grid3x3, Clock, MessageSquare, Users, Settings, Delete,
  Plus, Send, Bell, Volume2,
} from "lucide-react";
import { toast } from "sonner";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useSoftphone } from "@/hooks/useSoftphone";
import {
  getSoftphoneConfig,
  getSoftphoneVoiceToken,
  sendSoftphoneSms,
  startSoftphoneCall,
  type SoftphoneConfig,
} from "@/lib/softphoneApi";
import { formatUkNumber, prettyNumber } from "@/lib/phoneNumbers";

type Tab = "keypad" | "recents" | "messages" | "contacts" | "settings";
const ACCENT = "hsl(152,48%,38%)";
const KEYS = [
  { digit: "1", letters: "" },
  { digit: "2", letters: "ABC" },
  { digit: "3", letters: "DEF" },
  { digit: "4", letters: "GHI" },
  { digit: "5", letters: "JKL" },
  { digit: "6", letters: "MNO" },
  { digit: "7", letters: "PQRS" },
  { digit: "8", letters: "TUV" },
  { digit: "9", letters: "WXYZ" },
  { digit: "*", letters: "" },
  { digit: "0", letters: "+" },
  { digit: "#", letters: "" },
] as const;

function playTone() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
  } catch { /* ignore */ }
}

export default function Softphone() {
  const [tab, setTab] = useState<Tab>("keypad");
  const [digits, setDigits] = useState("");
  const [config, setConfig] = useState<SoftphoneConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [callState, setCallState] = useState<"idle" | "connecting" | "open" | "incoming">("idle");
  const [muted, setMuted] = useState(false);
  const [incomingFrom, setIncomingFrom] = useState("");
  const [activeTo, setActiveTo] = useState("");
  const [threadNumber, setThreadNumber] = useState<string | null>(null);
  const [smsDraft, setSmsDraft] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [mobileDraft, setMobileDraft] = useState("");
  const deviceRef = useRef<{ disconnectAll?: () => void; audio?: { incoming?: () => Promise<unknown> }; on?: Function } | null>(null);
  const callRef = useRef<{ disconnect?: () => void; mute?: (v: boolean) => void; on?: Function } | null>(null);
  const seenInbound = useRef(new Set<string>());
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const { calls, contacts, threads, myMobile, loading, saveMobile, addContact, removeContact, recordLocalCall } = useSoftphone();

  useEffect(() => {
    void getSoftphoneConfig().then((next) => {
      setConfig(next);
      setMobileDraft(next.myMobile || "");
    }).catch((err) => toast.error((err as Error).message || "Could not load phone"));
  }, []);

  useEffect(() => {
    if (myMobile && !mobileDraft) setMobileDraft(myMobile);
  }, [myMobile, mobileDraft]);

  useEffect(() => {
    const newest = threads.flatMap((t) => t.items).filter((m) => m.direction === "inbound");
    for (const message of newest.slice(0, 8)) {
      if (!message.id || seenInbound.current.has(message.id)) continue;
      seenInbound.current.add(message.id);
      if (seenInbound.current.size > 40) seenInbound.current.clear();
      if (permission === "granted") {
        new Notification(`Text from ${prettyNumber(message.from)}`, { body: message.body, icon: "/favicon.ico" });
      }
      toast.message(`Text from ${prettyNumber(message.from)}`, { description: message.body });
    }
  }, [threads, permission]);

  const connectVoice = useCallback(async () => {
    if (!config?.voiceReady) return null;
    if (deviceRef.current) return deviceRef.current;
    const { Device } = await import("@twilio/voice-sdk");
    const { token } = await getSoftphoneVoiceToken();
    const device = new Device(token, { closeProtection: true, logLevel: "error" });
    await device.register();
    device.on("incoming", (call) => {
      setIncomingFrom(String(call.parameters?.From || "Unknown"));
      setCallState("incoming");
      callRef.current = call;
      playTone();
      if (permission === "granted") {
        new Notification("Incoming call", { body: prettyNumber(String(call.parameters?.From || "")), icon: "/favicon.ico" });
      }
      call.on("cancel", () => setCallState("idle"));
      call.on("disconnect", () => { setCallState("idle"); callRef.current = null; });
    });
    deviceRef.current = device as never;
    return device;
  }, [config?.voiceReady, permission]);

  useEffect(() => {
    if (!config?.voiceReady) return;
    void connectVoice().catch(() => undefined);
    return () => {
      try { deviceRef.current?.disconnectAll?.(); } catch { /* ignore */ }
      deviceRef.current = null;
    };
  }, [config?.voiceReady, connectVoice]);

  const press = (key: string) => {
    playTone();
    setDigits((value) => (value + key).slice(0, 18));
  };

  const placeCall = async (raw?: string) => {
    const to = formatUkNumber(raw || digits);
    if (!to) {
      toast.error("Enter a number first");
      return;
    }
    setActiveTo(to);
    setBusy(true);
    try {
      if (config?.voiceReady) {
        const device = await connectVoice();
        if (!device) throw new Error("Voice is not ready");
        setCallState("connecting");
        const call = await (device as { connect: (opts: { params: { To: string } }) => Promise<unknown> }).connect({ params: { To: to } });
        callRef.current = call as never;
        setCallState("open");
        (call as { on: (ev: string, fn: () => void) => void }).on("disconnect", () => {
          setCallState("idle");
          callRef.current = null;
        });
        await recordLocalCall({ direction: "outbound", from: config.fromNumber, to, status: "initiated", via: "client", createdAtIso: new Date().toISOString() });
      } else {
        const result = await startSoftphoneCall(to, mobileDraft || myMobile);
        toast.success(result.via === "callback"
          ? "Your mobile will ring, then we’ll connect the other person."
          : "Add your mobile in Settings so we can join you to the call.");
        await recordLocalCall({ direction: "outbound", from: config?.fromNumber || "", to, status: result.status, via: result.via, createdAtIso: new Date().toISOString() });
      }
    } catch (err) {
      setCallState("idle");
      toast.error((err as Error).message || "Could not start the call");
    } finally {
      setBusy(false);
    }
  };

  const hangUp = () => {
    try { callRef.current?.disconnect?.(); } catch { /* ignore */ }
    try { deviceRef.current?.disconnectAll?.(); } catch { /* ignore */ }
    setCallState("idle");
    callRef.current = null;
  };

  const answer = () => {
    const call = callRef.current as { accept?: () => void; on?: Function } | null;
    call?.accept?.();
    setCallState("open");
    call?.on?.("disconnect", () => { setCallState("idle"); callRef.current = null; });
  };

  const sendSms = async (to: string, body: string) => {
    const number = formatUkNumber(to);
    const text = body.trim();
    if (!number || !text) return;
    setBusy(true);
    try {
      await sendSoftphoneSms(number, text);
      setSmsDraft("");
      toast.success("Sent");
    } catch (err) {
      toast.error((err as Error).message || "Could not send");
    } finally {
      setBusy(false);
    }
  };

  const activeThread = threads.find((t) => t.number === threadNumber);
  const rail: Array<{ id: Tab; label: string; icon: typeof Phone }> = [
    { id: "keypad", label: "Keypad", icon: Grid3x3 },
    { id: "recents", label: "Recents", icon: Clock },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "contacts", label: "Contacts", icon: Users },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <FeaturePageShell
      title="Phone"
      subtitle="Calls and texts from Hardy Hub"
      icon={<Phone className="w-5 h-5" />}
      sharePage="softphone"
    >
      {(callState === "incoming" || callState === "open" || callState === "connecting") && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[hsl(152,20%,10%)] px-6 text-white">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            {callState === "incoming" ? "Incoming" : callState === "connecting" ? "Calling" : "On a call"}
          </p>
          <p className="mt-4 font-display text-4xl font-bold">
            {prettyNumber(callState === "incoming" ? incomingFrom : activeTo)}
          </p>
          <div className="mt-16 flex items-center gap-10">
            {callState === "incoming" ? (
              <>
                <button type="button" onClick={hangUp} className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-red-500 shadow-lg">
                  <PhoneOff className="h-7 w-7" />
                </button>
                <button type="button" onClick={answer} className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-emerald-500 shadow-lg">
                  <PhoneCall className="h-7 w-7" />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const next = !muted;
                    setMuted(next);
                    callRef.current?.mute?.(next);
                  }}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10"
                >
                  {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
                </button>
                <button type="button" onClick={hangUp} className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500 shadow-lg">
                  <PhoneOff className="h-7 w-7" />
                </button>
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10">
                  <Volume2 className="h-6 w-6" />
                </span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4 lg:flex-row">
        <aside className="w-full shrink-0 lg:w-52">
          <div
            className="rounded-2xl border border-border/50 p-2 shadow-card"
            style={{ background: `color-mix(in srgb, ${ACCENT} 12%, var(--card))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}
          >
            <nav className="grid grid-cols-2 gap-1 sm:grid-cols-5 lg:grid-cols-1">
              {rail.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setTab(item.id); if (item.id !== "messages") setThreadNumber(null); }}
                    className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                      active ? "bg-gradient-primary text-primary-foreground" : "text-foreground hover:bg-card"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted-foreground">
            {config?.fromNumber ? `Hardy Hub number ${prettyNumber(config.fromNumber)}` : "Twilio number not set yet"}
          </p>
        </aside>

        <div className="min-w-0 flex-1">
          {tab === "keypad" && (
            <div
              className="mx-auto max-w-sm rounded-3xl border border-border/50 p-6 shadow-card"
              style={{ background: `color-mix(in srgb, ${ACCENT} 10%, var(--card))`, borderLeftWidth: 4, borderLeftColor: ACCENT }}
            >
              <input
                value={digits}
                onChange={(event) => setDigits(event.target.value.replace(/[^\d+*#]/g, ""))}
                placeholder="Enter a number"
                className="mb-6 w-full bg-transparent text-center font-display text-3xl font-bold tracking-wide outline-none"
              />
              <div className="grid grid-cols-3 gap-3">
                {KEYS.map((key) => (
                  <button
                    key={key.digit}
                    type="button"
                    onClick={() => press(key.digit)}
                    className="flex h-16 flex-col items-center justify-center rounded-full bg-card shadow-sm hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,var(--card))]"
                  >
                    <span className="text-2xl font-semibold leading-none">{key.digit}</span>
                    {key.letters ? (
                      <span className="mt-1 text-[9px] font-bold tracking-[0.18em] text-muted-foreground">{key.letters}</span>
                    ) : (
                      <span className="mt-1 h-3" />
                    )}
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-center gap-6">
                <button type="button" onClick={() => setDigits((v) => v.slice(0, -1))} className="text-muted-foreground">
                  <Delete className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void placeCall()}
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-primary text-primary-foreground shadow-lg"
                >
                  <Phone className="h-7 w-7" />
                </button>
                <button type="button" onClick={() => { setTab("messages"); setThreadNumber(formatUkNumber(digits) || digits); }} className="text-muted-foreground">
                  <MessageSquare className="h-5 w-5" />
                </button>
              </div>
              {!config?.voiceReady && (
                <p className="mt-4 text-center text-[11px] text-muted-foreground">
                  In-app calling needs Twilio Voice. Until then, add your mobile in Settings and we’ll ring you first.
                </p>
              )}
              {!config?.smsReady && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">Texts need the existing Twilio SMS secrets.</p>
              )}
            </div>
          )}

          {tab === "recents" && (
            <div className="space-y-2">
              {loading && <p className="text-sm text-muted-foreground">Loading calls…</p>}
              {!loading && calls.length === 0 && (
                <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card">
                  <PhoneIncoming className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-2 font-display font-bold">No calls yet</p>
                  <p className="text-sm text-muted-foreground">Dial from the keypad or a contact.</p>
                </div>
              )}
              {calls.map((call) => (
                <button
                  key={call.id}
                  type="button"
                  onClick={() => { setDigits(call.direction === "inbound" ? call.from : call.to); setTab("keypad"); }}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 text-left shadow-card"
                  style={{ borderLeftWidth: 4, borderLeftColor: ACCENT }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,hsl(152,48%,38%)_16%,var(--card))]">
                    {call.direction === "inbound" ? <PhoneIncoming className="h-4 w-4" /> : <PhoneCall className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{prettyNumber(call.direction === "inbound" ? call.from : call.to)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {call.status || call.via || call.direction}
                      {call.createdAtIso ? ` · ${new Date(call.createdAtIso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === "messages" && !threadNumber && (
            <div className="space-y-2">
              {threads.length === 0 && (
                <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-card">
                  <MessageSquare className="mx-auto h-8 w-8 text-primary" />
                  <p className="mt-2 font-display font-bold">No texts yet</p>
                  <p className="text-sm text-muted-foreground">Start from the keypad, or pick a contact.</p>
                </div>
              )}
              {threads.map((thread) => (
                <button
                  key={thread.number}
                  type="button"
                  onClick={() => setThreadNumber(thread.number)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 text-left shadow-card"
                  style={{ borderLeftWidth: 4, borderLeftColor: ACCENT }}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,hsl(152,48%,38%)_16%,var(--card))] font-bold">
                    {prettyNumber(thread.number).slice(-2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{prettyNumber(thread.number)}</p>
                    <p className="truncate text-xs text-muted-foreground">{thread.last?.body}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {tab === "messages" && threadNumber && (
            <div className="flex min-h-[420px] flex-col rounded-2xl border border-border/50 bg-card shadow-card">
              <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
                <button type="button" className="text-sm text-primary" onClick={() => setThreadNumber(null)}>Back</button>
                <p className="font-display font-bold">{prettyNumber(threadNumber)}</p>
                <button type="button" onClick={() => void placeCall(threadNumber)} className="text-primary"><Phone className="h-4 w-4" /></button>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {(activeThread?.items || []).map((message) => (
                  <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}>
                    <p className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                      message.direction === "outbound"
                        ? "bg-gradient-primary text-primary-foreground"
                        : "bg-[color-mix(in_srgb,hsl(152,48%,38%)_14%,var(--card))]"
                    }`}>
                      {message.body}
                    </p>
                  </div>
                ))}
              </div>
              <form
                className="flex gap-2 border-t border-border/40 p-3"
                onSubmit={(event) => { event.preventDefault(); void sendSms(threadNumber, smsDraft); }}
              >
                <Input value={smsDraft} onChange={(e) => setSmsDraft(e.target.value)} placeholder="Text message" className="h-11 rounded-xl" />
                <Button type="submit" disabled={busy || !smsDraft.trim()} className="h-11 rounded-xl bg-gradient-primary">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          )}

          {tab === "contacts" && (
            <div className="space-y-3">
              <form
                className="rounded-2xl border border-border/50 bg-card p-3 shadow-card"
                style={{ background: `color-mix(in srgb, ${ACCENT} 10%, var(--card))` }}
                onSubmit={(event) => {
                  event.preventDefault();
                  void addContact(contactName, contactNumber).then(() => { setContactName(""); setContactNumber(""); });
                }}
              >
                <p className="mb-2 text-sm font-semibold">Add a person</p>
                <div className="flex flex-wrap gap-2">
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Name" className="h-10 min-w-[8rem] flex-1 rounded-xl" />
                  <Input value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="Number" className="h-10 min-w-[8rem] flex-1 rounded-xl" />
                  <Button type="submit" className="h-10 rounded-xl bg-gradient-primary"><Plus className="h-4 w-4" /></Button>
                </div>
              </form>
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-card p-3 shadow-card" style={{ borderLeftWidth: 4, borderLeftColor: ACCENT }}>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{contact.name}</p>
                    <p className="text-xs text-muted-foreground">{prettyNumber(contact.number)}</p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void placeCall(contact.number)}>Call</Button>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setTab("messages"); setThreadNumber(formatUkNumber(contact.number)); }}>Text</Button>
                  <button type="button" className="text-xs text-muted-foreground" onClick={() => void removeContact(contact.id)}>Remove</button>
                </div>
              ))}
            </div>
          )}

          {tab === "settings" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card" style={{ borderLeftWidth: 4, borderLeftColor: ACCENT }}>
                <p className="font-display font-bold">Your mobile</p>
                <p className="mt-1 text-sm text-muted-foreground">If in-app calling is not set up, we ring this phone first, then the person you dialled.</p>
                <div className="mt-3 flex gap-2">
                  <Input value={mobileDraft} onChange={(e) => setMobileDraft(e.target.value)} placeholder="07…" className="h-11 rounded-xl" />
                  <Button className="h-11 rounded-xl bg-gradient-primary" onClick={() => void saveMobile(mobileDraft).then(() => toast.success("Saved"))}>Save</Button>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/50 bg-card p-4 shadow-card">
                <div>
                  <p className="font-semibold">Call and text alerts</p>
                  <p className="text-xs text-muted-foreground">Use this device’s notification permission.</p>
                </div>
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  {permission !== "granted" && isSupported && (
                    <Button size="sm" className="rounded-xl" onClick={() => void requestPermission()}>Allow</Button>
                  )}
                  {permission === "granted" && <span className="text-xs font-semibold text-primary">On</span>}
                </div>
              </div>
              <div className="rounded-2xl border border-border/50 bg-card p-4 text-sm shadow-card">
                <p className="font-semibold">Twilio status</p>
                <p className="mt-1 text-muted-foreground">SMS {config?.smsReady ? "ready" : "not configured"} · Browser calls {config?.voiceReady ? "ready" : "need API key + TwiML app"}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </FeaturePageShell>
  );
}

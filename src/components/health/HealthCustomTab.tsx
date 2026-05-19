import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, Save, MessageSquare, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { differenceInDays, format, parseISO } from "date-fns";
import { useHealthTabs, type HealthTab, type TabField, type FieldType } from "@/hooks/useHealthTabs";
import AiSupportChat from "./AiSupportChat";

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: "number",   label: "Number / measurement" },
  { value: "counter",  label: "Counter (tap to increment)" },
  { value: "text",     label: "Text note" },
  { value: "boolean",  label: "Yes / No" },
  { value: "sobriety", label: "Sobriety tracker (days clean)" },
];

const EMOJIS = ["🧘", "🍷", "💊", "🚭", "🍕", "😴", "🏃", "❤️", "🧠", "⚡", "🌿", "🌊", "🎯", "💪", "✨"];
const COLORS  = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

function sobrietyDays(startDate?: string): number {
  if (!startDate) return 0;
  return Math.max(0, differenceInDays(new Date(), parseISO(startDate)));
}

interface Props {
  tab: HealthTab;
}

export default function HealthCustomTab({ tab }: Props) {
  const { saveEntry, getTodayEntry, getEntriesForTab, updateTab, deleteTab } = useHealthTabs();
  const todayEntry = getTodayEntry(tab.id);
  const allEntries = getEntriesForTab(tab.id);

  const today = new Date().toISOString().split("T")[0];
  const [values, setValues] = useState<Record<string, any>>(todayEntry?.values ?? {});
  const [note, setNote] = useState(todayEntry?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [editTabOpen, setEditTabOpen] = useState(false);

  // Edit tab form
  const [eName, setEName]   = useState(tab.name);
  const [eEmoji, setEEmoji] = useState(tab.emoji);
  const [eColor, setEColor] = useState(tab.color);
  const [eAi, setEAi]       = useState(tab.enableAiChat);
  const [eSobStart, setESobStart] = useState(tab.sobrietyStartDate ?? "");
  const [eFields, setEFields] = useState<TabField[]>(tab.fields);
  const [editSaving, setEditSaving] = useState(false);

  const isSobriety = tab.fields.some((f) => f.type === "sobriety");
  const days = isSobriety ? sobrietyDays(tab.sobrietyStartDate) : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveEntry({ tabId: tab.id, date: today, values, note: note.trim() });
    } finally { setSaving(false); }
  };

  const setValue = (fieldId: string, val: any) => setValues((v) => ({ ...v, [fieldId]: val }));

  const saveTabEdit = async () => {
    setEditSaving(true);
    try {
      await updateTab(tab.id, {
        name: eName.trim(), emoji: eEmoji, color: eColor,
        enableAiChat: eAi, sobrietyStartDate: eSobStart || undefined,
        fields: eFields,
      });
      setEditTabOpen(false);
    } finally { setEditSaving(false); }
  };

  const addField = () => {
    const id = `f_${Date.now()}`;
    setEFields((f) => [...f, { id, label: "New field", type: "number" }]);
  };

  const updateField = (id: string, updates: Partial<TabField>) => {
    setEFields((f) => f.map((x) => x.id === id ? { ...x, ...updates } : x));
  };

  const removeField = (id: string) => setEFields((f) => f.filter((x) => x.id !== id));

  const recentEntries = allEntries.slice(0, 7);

  return (
    <div>
      {/* Tab header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl">{tab.emoji}</span>
          <div>
            <h3 className="text-base font-bold text-card-foreground">{tab.name}</h3>
            {days !== null && (
              <p className="text-xs text-muted-foreground">{days} days clean</p>
            )}
          </div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setEditTabOpen(true)} className="p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sobriety counter */}
      {days !== null && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mb-4 p-5 rounded-2xl text-center"
          style={{ background: `linear-gradient(135deg, ${tab.color}22, ${tab.color}44)`, borderColor: `${tab.color}44`, border: "1px solid" }}
        >
          <p className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground mb-1">Days Clean</p>
          <p className="text-6xl font-black font-display" style={{ color: tab.color }}>{days}</p>
          {tab.sobrietyStartDate && (
            <p className="text-xs text-muted-foreground mt-1">
              Since {format(parseISO(tab.sobrietyStartDate), "d MMMM yyyy")}
            </p>
          )}
          {days > 0 && days % 7 === 0 && (
            <div className="mt-2 px-3 py-1.5 rounded-full bg-white/60 inline-block">
              <span className="text-xs font-bold text-amber-700">🎉 {days / 7} week{days / 7 > 1 ? "s" : ""}!</span>
            </div>
          )}
        </motion.div>
      )}

      {/* Today's entry fields */}
      {tab.fields.filter((f) => f.type !== "sobriety").length > 0 && (
        <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-4">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today</h4>
          <div className="space-y-3">
            {tab.fields.filter((f) => f.type !== "sobriety").map((field) => (
              <div key={field.id}>
                <Label className="text-xs mb-1.5 block">{field.label}{field.unit ? ` (${field.unit})` : ""}</Label>
                {field.type === "number" && (
                  <Input
                    type="number"
                    step="0.1"
                    value={values[field.id] ?? ""}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    placeholder={field.description ?? "Enter value"}
                    className="h-10 rounded-xl text-sm"
                  />
                )}
                {field.type === "counter" && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setValue(field.id, Math.max(0, (values[field.id] ?? 0) - 1))}
                      className="w-9 h-9 rounded-xl border border-border bg-muted text-lg font-bold hover:bg-muted/80 transition-colors"
                    >−</button>
                    <span className="text-2xl font-black font-display w-12 text-center">{values[field.id] ?? 0}</span>
                    <button
                      onClick={() => setValue(field.id, (values[field.id] ?? 0) + 1)}
                      className="w-9 h-9 rounded-xl border border-border bg-primary text-primary-foreground text-lg font-bold hover:bg-primary/90 transition-colors"
                    >+</button>
                  </div>
                )}
                {field.type === "text" && (
                  <Textarea
                    value={values[field.id] ?? ""}
                    onChange={(e) => setValue(field.id, e.target.value)}
                    placeholder={field.description ?? "Type here…"}
                    className="rounded-xl text-sm min-h-[72px]"
                  />
                )}
                {field.type === "boolean" && (
                  <div className="flex gap-2">
                    {["Yes", "No"].map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setValue(field.id, opt)}
                        className={`flex-1 py-2 rounded-xl border text-sm font-semibold transition-colors ${
                          values[field.id] === opt
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted border-border text-muted-foreground"
                        }`}
                      >{opt}</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            <Label className="text-xs">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Any notes for today…"
              className="rounded-xl text-sm min-h-[56px]"
            />
          </div>

          <Button
            onClick={handleSave}
            disabled={saving}
            className="mt-3 w-full h-10 rounded-xl text-xs bg-gradient-primary"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {saving ? "Saving…" : todayEntry ? "Update Today" : "Save Today"}
          </Button>
        </div>
      )}

      {/* Recent history */}
      {recentEntries.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setShowHistory((x) => !x)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-2"
          >
            <Calendar className="w-3.5 h-3.5" />
            {showHistory ? "Hide" : "Show"} history ({recentEntries.length} entries)
            {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
          <AnimatePresence>
            {showHistory && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
                {recentEntries.map((entry) => (
                  <div key={entry.id} className="p-3 rounded-xl bg-card border border-border/40 text-xs">
                    <p className="font-semibold text-muted-foreground mb-1">{format(parseISO(entry.date), "EEEE d MMM")}</p>
                    {tab.fields.filter((f) => f.type !== "sobriety").map((f) => (
                      entry.values[f.id] !== undefined && (
                        <p key={f.id} className="text-card-foreground">
                          <span className="text-muted-foreground">{f.label}: </span>
                          {String(entry.values[f.id])}{f.unit ? ` ${f.unit}` : ""}
                        </p>
                      )
                    ))}
                    {entry.note && <p className="text-muted-foreground italic mt-1">{entry.note}</p>}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* AI Support chat */}
      {tab.enableAiChat && (
        <div className="mt-2">
          <button
            onClick={() => setShowChat((x) => !x)}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-sm font-semibold text-rose-800 mb-3"
          >
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              AI Companion Chat
            </div>
            {showChat ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="p-4 rounded-2xl bg-card border border-border/50 h-[480px] flex flex-col">
                  <AiSupportChat tabName={tab.name} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Edit tab dialog */}
      <Dialog open={editTabOpen} onOpenChange={setEditTabOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Tab — {tab.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={eName} onChange={(e) => setEName(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Emoji</Label>
                <div className="flex flex-wrap gap-1.5">
                  {EMOJIS.map((em) => (
                    <button key={em} onClick={() => setEEmoji(em)} className={`text-lg rounded-lg px-1 py-0.5 ${eEmoji === em ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-muted"}`}>{em}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Colour</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} onClick={() => setEColor(c)} className={`w-7 h-7 rounded-full border-2 ${eColor === c ? "border-foreground scale-125" : "border-transparent"}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            {isSobriety && (
              <div className="space-y-1.5">
                <Label>Sobriety start date</Label>
                <Input type="date" value={eSobStart} onChange={(e) => setESobStart(e.target.value)} className="h-10 rounded-xl" />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>AI companion chat</Label>
              <Switch checked={eAi} onCheckedChange={setEAi} />
            </div>

            {/* Fields */}
            <div>
              <Label className="mb-2 block">Tracking fields</Label>
              <div className="space-y-2">
                {eFields.map((f) => (
                  <div key={f.id} className="p-2.5 rounded-xl bg-muted/30 border border-border/40 space-y-2">
                    <div className="flex gap-2 items-center">
                      <Input value={f.label} onChange={(e) => updateField(f.id, { label: e.target.value })} className="h-8 rounded-lg text-xs flex-1" placeholder="Field name" />
                      <button onClick={() => removeField(f.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={f.type}
                        onChange={(e) => updateField(f.id, { type: e.target.value as FieldType })}
                        className="h-8 rounded-lg border border-border bg-background text-xs px-2"
                      >
                        {FIELD_TYPES.map((ft) => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                      </select>
                      <Input value={f.unit ?? ""} onChange={(e) => updateField(f.id, { unit: e.target.value })} className="h-8 rounded-lg text-xs" placeholder="Unit (optional)" />
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addField} className="mt-2 flex items-center gap-1.5 text-xs text-primary font-medium">
                <Plus className="w-3.5 h-3.5" /> Add field
              </button>
            </div>

            <Button onClick={saveTabEdit} disabled={editSaving} className="w-full h-11 rounded-xl bg-gradient-primary">
              {editSaving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

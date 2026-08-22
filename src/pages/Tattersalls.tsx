import { useState, useRef, useEffect } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import DocumentScannerSheet from "@/components/DocumentScannerSheet";
import { Building, Plus, FileText, TrendingUp, Upload, Camera, ScanLine, File, Pencil, X, Check, Trash2, StickyNote, CheckSquare, Square, Settings, MessageCircle, Paperclip } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTattersalls, type TatDocument } from "@/hooks/useTattersalls";
import { useAuth } from "@/auth/AuthContext";
import { collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg bg-card border border-border shadow-elevated p-2.5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold font-display text-card-foreground">£{payload[0].value.toLocaleString("en-GB")}</p>
      </div>
    );
  }
  return null;
};

const PILL_PALETTE = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-amber-100 text-amber-700",
  "bg-cyan-100 text-cyan-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-rose-100 text-rose-700",
  "bg-pink-100 text-pink-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-lime-100 text-lime-700",
  "bg-slate-100 text-slate-600",
];

// Row tint for alternating expense rows — subtle category-hued bg
const ROW_TINT_PALETTE = [
  "bg-blue-50/60 dark:bg-blue-950/20",
  "bg-purple-50/60 dark:bg-purple-950/20",
  "bg-amber-50/60 dark:bg-amber-950/20",
  "bg-cyan-50/60 dark:bg-cyan-950/20",
  "bg-emerald-50/60 dark:bg-emerald-950/20",
  "bg-orange-50/60 dark:bg-orange-950/20",
  "bg-rose-50/60 dark:bg-rose-950/20",
  "bg-pink-50/60 dark:bg-pink-950/20",
  "bg-indigo-50/60 dark:bg-indigo-950/20",
  "bg-teal-50/60 dark:bg-teal-950/20",
  "bg-lime-50/60 dark:bg-lime-950/20",
  "bg-slate-50/60 dark:bg-slate-950/20",
];

const Tattersalls = () => {
  const { dataUid } = useAuth();
  const { balanceHistory, expenses, expenseCategories, documents, notes, loading, uploadingDoc, addBalance, addExpense, saveExpenseCategories, uploadDocument, updateDocument, addNote, updateNote, addComment, toggleNote, deleteNote } = useTattersalls();

  // App users for "Who?" dropdown
  const [appUsers, setAppUsers] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    getDocs(collection(db, "users")).then((snap) => {
      setAppUsers(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().firstName ?? d.data().displayName ?? d.data().email ?? d.id,
        }))
      );
    }).catch(() => {});
  }, []);

  // Add balance dialog
  const [addBalOpen, setAddBalOpen] = useState(false);
  const [newBalDate, setNewBalDate] = useState(new Date().toISOString().split("T")[0]);
  const [newBal, setNewBal] = useState("");
  const [addBalLoading, setAddBalLoading] = useState(false);

  // Add expense dialog
  const [addExpOpen, setAddExpOpen] = useState(false);
  const [newExpDesc, setNewExpDesc] = useState("");
  const [newExpAmount, setNewExpAmount] = useState("");
  const [newExpType, setNewExpType] = useState("General");
  const [newExpFrequency, setNewExpFrequency] = useState("Monthly");
  const [addExpLoading, setAddExpLoading] = useState(false);

  // Upload document dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Document detail/edit sheet
  const [docDetail, setDocDetail] = useState<TatDocument | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);

  // Notes / tasks — add form
  const [addMode, setAddMode] = useState<null | 'note' | 'task'>(null);
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteAuthor, setNewNoteAuthor] = useState("");
  const [newNoteAuthorOther, setNewNoteAuthorOther] = useState("");
  const [newNoteType, setNewNoteType] = useState<'task' | 'note'>('task');
  const [newNoteDueDate, setNewNoteDueDate] = useState("");
  const [newNoteAddToTasks, setNewNoteAddToTasks] = useState(false);
  const [newNoteReminder, setNewNoteReminder] = useState("none");
  const [newNoteFile, setNewNoteFile] = useState<File | null>(null);
  const [addingNote, setAddingNote] = useState(false);
  const noteFileInputRef = useRef<HTMLInputElement>(null);
  const existingNoteFileInputRef = useRef<HTMLInputElement>(null);
  const [attachingNoteId, setAttachingNoteId] = useState<string | null>(null);
  // Edit & comments
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteText, setEditNoteText] = useState("");
  const [expandedCommentId, setExpandedCommentId] = useState<string | null>(null);
  const [newCommentText, setNewCommentText] = useState("");
  const [newCommentAuthor, setNewCommentAuthor] = useState("");

  // Settings (expense categories)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [savingCats, setSavingCats] = useState(false);

  // Computed
  const regularExpenses = expenses.filter((e) => e.frequency !== "One-off");
  const oneOffExpenses = expenses.filter((e) => e.frequency === "One-off");

  const catPillClass = (type: string) => {
    const idx = expenseCategories.indexOf(type);
    return idx === -1 ? "bg-slate-100 text-slate-600" : PILL_PALETTE[idx % PILL_PALETTE.length];
  };

  const currentBalance = balanceHistory.length > 0 ? balanceHistory[balanceHistory.length - 1].balance : 0;

  const handleAddBalance = async () => {
    if (!newBalDate || !newBal) return;
    const val = parseFloat(newBal);
    if (isNaN(val)) return;
    setAddBalLoading(true);
    try {
      const month = new Date(newBalDate).toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      await addBalance({ date: newBalDate, month, balance: val });
      setNewBalDate(new Date().toISOString().split("T")[0]);
      setNewBal("");
      setAddBalOpen(false);
    } finally {
      setAddBalLoading(false);
    }
  };

  const handleAddExpense = async () => {
    if (!newExpDesc.trim()) return;
    setAddExpLoading(true);
    try {
      await addExpense({
        date: new Date().toISOString().split("T")[0],
        desc: newExpDesc.trim(),
        type: newExpType,
        frequency: newExpFrequency,
        amount: parseFloat(newExpAmount) || 0,
      });
      setNewExpDesc(""); setNewExpAmount(""); setNewExpType(expenseCategories[0] ?? ""); setNewExpFrequency("Monthly");
      setAddExpOpen(false);
    } finally {
      setAddExpLoading(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadOpen(false);
    await uploadDocument(file);
  };

  const handleCameraSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploadOpen(false);
    // Route all camera images through the document scanner
    setScannerFile(file);
  };

  const openDocDetail = (doc: TatDocument) => {
    setDocDetail(doc);
    setEditName(doc.name);
    setEditNotes(doc.notes ?? "");
  };

  const saveDocChanges = async () => {
    if (!docDetail?.id) return;
    setSavingDoc(true);
    try {
      await updateDocument(docDetail.id, { name: editName.trim() || docDetail.name, notes: editNotes });
      setDocDetail(null);
    } finally { setSavingDoc(false); }
  };

  const handleAddNote = async () => {
    if (!newNoteText.trim()) return;
    setAddingNote(true);
    const resolvedAuthor = newNoteAuthor === "__other__"
      ? newNoteAuthorOther.trim() || undefined
      : newNoteAuthor || undefined;
    try {
      const noteId = await addNote(
        newNoteText.trim(),
        resolvedAuthor,
        newNoteType,
        newNoteType === 'task' ? (newNoteDueDate || undefined) : undefined,
        dataUid,
      );
      if (newNoteFile) {
        try {
          await uploadDocument(newNoteFile, {
            noteId,
            type: newNoteType,
            text: newNoteText.trim(),
          });
        } catch (error) {
          console.error("Failed to attach Tattersalls document", error);
          toast.error(`${newNoteType === "note" ? "Note" : "Task"} saved, but the file didn’t upload.`);
        }
      }
      if (newNoteType === 'task' && newNoteAddToTasks && dataUid) {
        const taskData: Record<string, unknown> = {
          title: newNoteText.trim(),
          status: "todo",
          dueDate: newNoteDueDate || null,
          createdAt: serverTimestamp(),
        };
        if (newNoteReminder === "onDay") {
          taskData.reminder = { mode: "onDayAt", timeOfDay: "09:00", channels: ["email"] };
        } else if (newNoteReminder === "dayBefore") {
          taskData.reminder = { mode: "relative", relativeAmount: 1, relativeUnit: "days", relativeDirection: "before", timeOfDay: "09:00", channels: ["email"] };
        }
        await addDoc(collection(db, "tasks", dataUid, "items"), taskData);
      }
      setNewNoteText(""); setNewNoteAuthor(""); setNewNoteAuthorOther("");
      setNewNoteDueDate(""); setNewNoteAddToTasks(false); setNewNoteReminder("none");
      setNewNoteFile(null);
      setAddMode(null);
    } finally { setAddingNote(false); }
  };

  const handleAttachToExistingNote = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const note = notes.find((item) => item.id === attachingNoteId);
    if (!file || !note) {
      setAttachingNoteId(null);
      return;
    }
    try {
      await uploadDocument(file, {
        noteId: note.id,
        type: note.type ?? "task",
        text: note.text,
      });
      toast.success("File attached");
    } catch (error) {
      console.error("Failed to attach Tattersalls document", error);
      toast.error("Couldn’t attach the file.");
    } finally {
      setAttachingNoteId(null);
    }
  };

  const handleSaveEdit = async (noteId: string) => {
    if (!editNoteText.trim()) return;
    await updateNote(noteId, editNoteText.trim());
    setEditingNoteId(null);
  };

  const handleAddComment = async (noteId: string) => {
    if (!newCommentText.trim()) return;
    const name = newCommentAuthor.trim() || (appUsers.find(u => u.id === dataUid)?.name ?? "Someone");
    await addComment(noteId, newCommentText.trim(), name);
    setNewCommentText(""); setNewCommentAuthor("");
  };

  const openSettings = () => {
    setEditCategories([...expenseCategories]);
    setNewCatName("");
    setSettingsOpen(true);
  };

  const handleAddCategory = () => {
    const t = newCatName.trim();
    if (!t || editCategories.includes(t)) return;
    setEditCategories((prev) => [...prev, t]);
    setNewCatName("");
  };

  const handleRemoveCategory = (i: number) =>
    setEditCategories((prev) => prev.filter((_, idx) => idx !== i));

  const handleSaveCategories = async () => {
    setSavingCats(true);
    try {
      await saveExpenseCategories(editCategories);
      setSettingsOpen(false);
    } finally { setSavingCats(false); }
  };

  if (loading) {
    return (
      <FeaturePageShell title="Tattersalls" subtitle="Flat management & expenses" icon={<Building className="w-5 h-5" />} sharePage="tattersalls">
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell
      title="Tattersalls"
      subtitle="Flat management & expenses"
      icon={<Building className="w-5 h-5" />}
      sharePage="tattersalls"
      action={
        <button
          onClick={openSettings}
          className="w-9 h-9 rounded-xl bg-muted/60 hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      }
    >
      {/* Balance Summary */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-5 rounded-2xl bg-gradient-warm mb-5">
        <p className="text-xs text-secondary-foreground/70 uppercase tracking-wider font-medium">Joint Balance</p>
        <p className="text-2xl font-bold font-display text-secondary-foreground mt-1">
          £{currentBalance.toLocaleString("en-GB", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-xs text-secondary-foreground/60 mt-1">Shared between Hardy &amp; Sarah</p>
        <button
          onClick={() => setAddBalOpen(true)}
          className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-secondary-foreground/80 hover:text-secondary-foreground bg-secondary-foreground/10 px-3 py-1.5 rounded-lg"
        >
          <Plus className="w-3.5 h-3.5" /> Add Balance
        </button>
      </motion.div>

      {/* Balance Chart */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Balance Over Time</h3>
        {balanceHistory.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No balance records yet — add one above.</p>
        ) : (
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={balanceHistory}>
              <defs>
                <linearGradient id="tatGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(36, 80%, 56%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(36, 80%, 56%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 15%, 88%)" />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(220, 10%, 46%)" }} axisLine={false} tickLine={false} tickFormatter={(v) => `£${v}`} width={40} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="balance" stroke="hsl(36, 80%, 56%)" strokeWidth={2} fill="url(#tatGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        )}
      </div>

      {/* Notes & Tasks */}
      <div className="mb-5">
        {/* Header with Add buttons */}
        <div className="flex items-center justify-between px-1 mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Notes & Tasks
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => { setAddMode(addMode === 'note' ? null : 'note'); setNewNoteType('note'); setNewNoteText(""); setNewNoteFile(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${addMode === 'note' ? "bg-amber-500 text-white" : "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 hover:bg-amber-200"}`}
            >
              <StickyNote className="w-3.5 h-3.5" /> Add Note
            </button>
            <button
              onClick={() => { setAddMode(addMode === 'task' ? null : 'task'); setNewNoteType('task'); setNewNoteText(""); setNewNoteFile(null); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shadow-sm ${addMode === 'task' ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 hover:bg-emerald-200"}`}
            >
              <CheckSquare className="w-3.5 h-3.5" /> Add Task
            </button>
          </div>
        </div>

        {/* Collapsible add form */}
        {addMode !== null && (
          <div className={`rounded-xl border shadow-soft p-3 mb-3 space-y-3 ${addMode === 'note' ? "bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40" : "bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40"}`}>
            <Input
              autoFocus
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddNote()}
              placeholder={addMode === 'note' ? "Write your note…" : "Describe the task…"}
              className="h-9 rounded-xl text-sm w-full"
            />
            <input
              ref={noteFileInputRef}
              type="file"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                e.target.value = "";
                setNewNoteFile(file);
              }}
            />
            {newNoteFile ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-card px-3 py-2 shadow-soft">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-foreground">{newNoteFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">Will also appear in Documents</p>
                </div>
                <button type="button" onClick={() => setNewNoteFile(null)} className="p-1 text-muted-foreground hover:text-destructive" aria-label="Remove attachment">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => noteFileInputRef.current?.click()}
                className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-card text-xs font-semibold text-foreground hover:border-primary/35"
              >
                <Paperclip className="h-3.5 w-3.5 text-primary" /> Attach a file
              </button>
            )}
            <div>
              <select
                value={newNoteAuthor}
                onChange={(e) => setNewNoteAuthor(e.target.value)}
                className="w-full h-9 rounded-xl border-2 border-border bg-input px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              >
                <option value="">Who? (optional)</option>
                {appUsers.map((u) => (
                  <option key={u.id} value={u.name}>{u.name}</option>
                ))}
                <option value="__other__">Other…</option>
              </select>
              {newNoteAuthor === "__other__" && (
                <Input value={newNoteAuthorOther} onChange={(e) => setNewNoteAuthorOther(e.target.value)}
                  placeholder="Enter name…" className="mt-2 h-9 rounded-xl text-sm w-full" />
              )}
            </div>
            {addMode === 'task' && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Due date</label>
                  <Input type="date" value={newNoteDueDate} onChange={(e) => setNewNoteDueDate(e.target.value)} className="h-9 rounded-xl text-sm w-full" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={newNoteAddToTasks} onChange={(e) => setNewNoteAddToTasks(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
                  <span className="text-sm text-card-foreground">Add to main task list</span>
                </label>
                {newNoteAddToTasks && (
                  <div>
                    <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Reminder</label>
                    <select value={newNoteReminder} onChange={(e) => setNewNoteReminder(e.target.value)}
                      className="w-full h-9 rounded-xl border-2 border-border bg-input px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50">
                      <option value="none">None</option>
                      <option value="onDay">On the day at 9am</option>
                      <option value="dayBefore">1 day before</option>
                    </select>
                  </div>
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={handleAddNote} disabled={addingNote || !newNoteText.trim()}
                className={`flex-1 h-9 rounded-xl text-sm ${addMode === 'note' ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white"}`}>
                <Plus className="w-4 h-4 mr-1" />
                {addingNote ? "Adding…" : addMode === 'note' ? "Add Note" : "Add Task"}
              </Button>
              <Button variant="ghost" onClick={() => { setAddMode(null); setNewNoteFile(null); }} className="h-9 px-3 rounded-xl text-xs">Cancel</Button>
            </div>
          </div>
        )}

        {/* Note / task list */}
        <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No notes or tasks yet — add one above.</p>
          ) : notes.map((note) => {
            const isNoteType = note.type === 'note';
            const isEditing = editingNoteId === note.id;
            const isCommentsOpen = expandedCommentId === note.id;
            const commentCount = note.comments?.length ?? 0;
            const canEdit = !note.authorId || note.authorId === dataUid;
            const linkedDocuments = documents.filter((doc) => doc.linkedNoteId === note.id);
            return (
              <div key={note.id} className={`transition-colors ${isNoteType ? "bg-amber-50/40 dark:bg-amber-950/15" : note.done ? "bg-muted/15" : ""}`}>
                <div className="flex items-start gap-3 px-3 py-2.5">
                  {/* Checkbox or sticky note icon */}
                  {isNoteType ? (
                    <StickyNote className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400" />
                  ) : (
                    <button onClick={() => toggleNote(note.id, !note.done)} className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary">
                      {note.done ? <CheckSquare className="w-4 h-4 text-green-500" /> : <Square className="w-4 h-4" />}
                    </button>
                  )}

                  {/* Text + meta */}
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex gap-2 items-center">
                        <Input autoFocus value={editNoteText} onChange={(e) => setEditNoteText(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(note.id); if (e.key === "Escape") setEditingNoteId(null); }}
                          className="h-8 rounded-lg text-sm flex-1" />
                        <button onClick={() => handleSaveEdit(note.id)} className="text-xs text-primary font-semibold px-2"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setEditingNoteId(null)} className="text-xs text-muted-foreground px-1"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <p className={`text-sm ${!isNoteType && note.done ? "line-through text-muted-foreground" : "text-card-foreground"}`}>{note.text}</p>
                    )}
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {note.author && <span className="text-[10px] text-muted-foreground">{note.author}</span>}
                      {note.dueDate && <span className="text-[10px] text-muted-foreground">Due: {new Date(note.dueDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>}
                    </div>
                    {linkedDocuments.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {linkedDocuments.map((document) => (
                          <button
                            key={document.id}
                            type="button"
                            onClick={() => openDocDetail(document)}
                            className="flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-border/50 bg-card px-2 py-1.5 text-left shadow-soft hover:border-primary/35"
                          >
                            {document.fileType === "image" ? (
                              <img src={document.url} alt="" className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                            ) : (
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15">
                                <FileText className="h-3.5 w-3.5 text-primary" />
                              </span>
                            )}
                            <span className="min-w-0 truncate text-[10px] font-semibold text-foreground">{document.name}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                    {/* Comments badge */}
                    <button
                      onClick={() => { setExpandedCommentId(isCommentsOpen ? null : note.id); setNewCommentText(""); setNewCommentAuthor(""); }}
                      className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full transition-colors ${isCommentsOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {commentCount > 0 && <span>{commentCount}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setAttachingNoteId(note.id);
                        existingNoteFileInputRef.current?.click();
                      }}
                      disabled={uploadingDoc && attachingNoteId === note.id}
                      className="rounded p-0.5 text-muted-foreground transition-colors hover:text-primary disabled:opacity-40"
                      aria-label={`Attach a file to this ${isNoteType ? "note" : "task"}`}
                      title="Attach file"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
                    {/* Edit (author only) */}
                    {canEdit && !isEditing && (
                      <button onClick={() => { setEditingNoteId(note.id); setEditNoteText(note.text); }}
                        className="text-muted-foreground hover:text-primary p-0.5 rounded transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {/* Delete */}
                    <button onClick={() => deleteNote(note.id)} className="text-muted-foreground hover:text-destructive p-0.5 rounded transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Comments panel */}
                {isCommentsOpen && (
                  <div className="px-3 pb-3 pt-0 border-t border-border/20 bg-muted/20">
                    {commentCount > 0 && (
                      <div className="space-y-1.5 py-2">
                        {note.comments!.map((c) => (
                          <div key={c.id} className="flex gap-2 items-start">
                            <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-[9px] font-bold text-primary">{c.authorName.charAt(0).toUpperCase()}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-semibold text-foreground">{c.authorName} </span>
                              <span className="text-[10px] text-muted-foreground">{c.text}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2 mt-1">
                      <Input value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddComment(note.id)}
                        placeholder="Add a comment…" className="h-8 rounded-lg text-xs flex-1" />
                      <select value={newCommentAuthor} onChange={(e) => setNewCommentAuthor(e.target.value)}
                        className="h-8 rounded-lg border-2 border-border bg-input px-2 text-xs text-foreground focus:outline-none w-28">
                        <option value="">Who?</option>
                        {appUsers.map((u) => <option key={u.id} value={u.name}>{u.name}</option>)}
                      </select>
                      <button onClick={() => handleAddComment(note.id)} disabled={!newCommentText.trim()}
                        className="h-8 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-semibold disabled:opacity-40">Post</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <input
          ref={existingNoteFileInputRef}
          type="file"
          className="hidden"
          onChange={handleAttachToExistingNote}
        />
      </div>

      {/* Expenses */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expenses</h3>
          <button onClick={() => { setNewExpType(expenseCategories[0] ?? ""); setAddExpOpen(true); }} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Plus className="w-3.5 h-3.5" /> Add Expense
          </button>
        </div>

        {/* Regular expenses */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 mb-1.5">Regular</p>
          <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
            {regularExpenses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No regular expenses yet.</p>
            ) : regularExpenses.map((exp, i) => {
              const catIdx = expenseCategories.indexOf(exp.type);
              const rowTint = catIdx !== -1 ? ROW_TINT_PALETTE[catIdx % ROW_TINT_PALETTE.length] : (i % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/20" : "");
              return (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 ${rowTint}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{exp.desc}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${catPillClass(exp.type)}`}>{exp.type}</span>
                    <span className="text-[10px] text-muted-foreground">{exp.frequency} · {exp.date}</span>
                  </div>
                </div>
                <span className="text-sm font-bold font-display text-card-foreground flex-shrink-0">£{exp.amount}</span>
              </div>
            ); })}
          </div>
        </div>

        {/* One-off expenses */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 mb-1.5">One-off</p>
          <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
            {oneOffExpenses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No one-off expenses yet.</p>
            ) : oneOffExpenses.map((exp, i) => {
              const catIdx = expenseCategories.indexOf(exp.type);
              const rowTint = catIdx !== -1 ? ROW_TINT_PALETTE[catIdx % ROW_TINT_PALETTE.length] : (i % 2 === 0 ? "bg-slate-50/60 dark:bg-slate-950/20" : "");
              return (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 ${rowTint}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{exp.desc}</p>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium ${catPillClass(exp.type)}`}>{exp.type}</span>
                    <span className="text-[10px] text-muted-foreground">{exp.date}</span>
                  </div>
                </div>
                <span className="text-sm font-bold font-display text-card-foreground flex-shrink-0">£{exp.amount}</span>
              </div>
            ); })}
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documents</h3>
          <button onClick={() => setUploadOpen(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
            <Upload className="w-3.5 h-3.5" /> Upload
          </button>
        </div>
        <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
          {documents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No documents yet — upload one above.</p>
          ) : documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5">
              {/* Thumbnail / icon — links out */}
              <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                {doc.fileType === "image" ? (
                  <img src={doc.url} alt={doc.name} className="w-8 h-8 rounded object-cover border border-border/40" />
                ) : doc.fileType === "pdf" ? (
                  <div className="w-8 h-8 rounded bg-destructive/10 border border-destructive/20 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-destructive" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded bg-muted border border-border/40 flex items-center justify-center">
                    <File className="w-4 h-4 text-muted-foreground" />
                  </div>
                )}
              </a>
              {/* Name + notes — tapping opens edit sheet */}
              <button className="flex-1 min-w-0 text-left" onClick={() => openDocDetail(doc)}>
                <p className="text-sm font-medium text-card-foreground truncate">{doc.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(doc.date).toLocaleDateString("en-GB")}
                  {doc.notes ? ` · ${doc.notes.slice(0, 40)}${doc.notes.length > 40 ? "…" : ""}` : ""}
                </p>
                {doc.linkedNoteId && (
                  <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] font-medium text-primary">
                    <Paperclip className="h-2.5 w-2.5 shrink-0" />
                    Attached to {doc.linkedNoteType ?? "task"}: {doc.linkedNoteText || "Tattersalls entry"}
                  </p>
                )}
              </button>
              <button onClick={() => openDocDetail(doc)} className="text-muted-foreground hover:text-foreground ml-1 flex-shrink-0">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Add Balance Dialog */}
      <Dialog open={addBalOpen} onOpenChange={(o) => { setAddBalOpen(o); if (!o) { setNewBalDate(new Date().toISOString().split("T")[0]); setNewBal(""); } }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Add Balance</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input type="date" value={newBalDate} onChange={e => setNewBalDate(e.target.value)} className="h-10 rounded-xl" />
            </div>
            <div className="space-y-1.5">
              <Label>Balance (£)</Label>
              <Input type="number" step="0.01" value={newBal} onChange={e => setNewBal(e.target.value)} placeholder="0.00" className="h-10 rounded-xl" />
            </div>
            <Button onClick={handleAddBalance} disabled={!newBalDate || !newBal || addBalLoading} className="w-full h-10 rounded-xl bg-gradient-primary">
              {addBalLoading ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog open={addExpOpen} onOpenChange={setAddExpOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Add Expense</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Input value={newExpDesc} onChange={e => setNewExpDesc(e.target.value)} placeholder="e.g. Boiler service" className="h-10 rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (£)</Label>
                <Input type="number" step="0.01" value={newExpAmount} onChange={e => setNewExpAmount(e.target.value)} placeholder="0.00" className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={newExpType} onValueChange={setNewExpType}>
                  <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={newExpFrequency} onValueChange={setNewExpFrequency}>
                <SelectTrigger className="h-10 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["Daily", "Weekly", "Monthly", "Quarterly", "Bi-annually", "Annually", "One-off", "Other"].map(f => (
                    <SelectItem key={f} value={f}>{f}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddExpense} disabled={!newExpDesc.trim() || addExpLoading} className="w-full h-10 rounded-xl bg-gradient-primary">
              {addExpLoading ? "Saving…" : "Add Expense"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Upload Document</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            {/* Upload a file from device */}
            <button
              disabled={uploadingDoc}
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Upload className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">Upload file</p>
                <p className="text-[11px] text-muted-foreground">PDF, image or any document from your device</p>
              </div>
            </button>

            {/* Take a photo with camera */}
            <button
              disabled={uploadingDoc}
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                <Camera className="w-4.5 h-4.5 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">Take a photo</p>
                <p className="text-[11px] text-muted-foreground">Open camera to photograph a document</p>
              </div>
            </button>

            {/* Scan / autocrop a letter */}
            <button
              disabled={uploadingDoc}
              onClick={() => scanInputRef.current?.click()}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border border-border/50 bg-muted/30 hover:bg-muted/60 transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
            >
              <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center flex-shrink-0">
                <ScanLine className="w-4.5 h-4.5 text-info" />
              </div>
              <div>
                <p className="text-sm font-medium text-card-foreground">Scan a letter</p>
                <p className="text-[11px] text-muted-foreground">Use the rear camera — device will auto-crop to the document edge</p>
              </div>
            </button>

            {uploadingDoc ? (
              <p className="text-[10px] text-primary text-center pt-1">Uploading…</p>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center pt-1">Files are saved to the cloud</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden file inputs */}
      {/* Generic file picker */}
      <input ref={fileInputRef} type="file" accept="*/*" className="hidden" onChange={handleFileSelected} />
      {/* Camera — front-facing, photo only — goes through scanner */}
      <input ref={cameraInputRef} type="file" accept="image/*" capture="user" className="hidden" onChange={handleCameraSelected} />
      {/* Scan — rear camera — goes through scanner */}
      <input ref={scanInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCameraSelected} />

      {/* Document scanner */}
      <DocumentScannerSheet
        imageFile={scannerFile}
        onConfirm={async (scannedFile) => {
          setScannerFile(null);
          await uploadDocument(scannedFile);
        }}
        onCancel={() => setScannerFile(null)}
      />

      {/* Settings — expense categories */}
      <Dialog open={settingsOpen} onOpenChange={(o) => { setSettingsOpen(o); if (!o) setNewCatName(""); }}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader><DialogTitle className="font-display">Settings</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expense Categories</p>
            <div className="rounded-xl bg-card border border-border/50 divide-y divide-border/30 overflow-hidden max-h-56 overflow-y-auto">
              {editCategories.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No categories yet.</p>
              ) : editCategories.map((cat, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2.5">
                  <span className="flex-1 text-sm text-card-foreground">{cat}</span>
                  <button onClick={() => handleRemoveCategory(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                placeholder="New category…"
                className="h-9 rounded-xl flex-1 text-sm"
              />
              <Button size="sm" onClick={handleAddCategory} disabled={!newCatName.trim()} className="h-9 rounded-xl px-3">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={handleSaveCategories} disabled={savingCats} className="w-full h-10 rounded-xl bg-gradient-primary">
              {savingCats ? "Saving…" : "Save Categories"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document detail / edit sheet */}
      <Sheet open={!!docDetail} onOpenChange={(o) => !o && setDocDetail(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85dvh] overflow-y-auto pb-safe">
          <SheetHeader className="mb-4">
            <SheetTitle>Edit Document</SheetTitle>
          </SheetHeader>
          {docDetail && (
            <div className="space-y-4">
              {/* Preview */}
              {docDetail.fileType === "image" && (
                <div className="rounded-xl overflow-hidden border">
                  <img src={docDetail.url} alt={docDetail.name} className="w-full max-h-52 object-contain bg-muted/30" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Name</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-10 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Notes</Label>
                <textarea
                  className="w-full rounded-xl border-2 border-border bg-input px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
                  rows={3}
                  placeholder="Add notes about this document…"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                <a href={docDetail.url} target="_blank" rel="noopener noreferrer" className="flex-1">
                  <Button variant="outline" className="w-full rounded-xl gap-1.5">
                    <FileText className="w-4 h-4" /> View file
                  </Button>
                </a>
                <Button onClick={saveDocChanges} disabled={savingDoc} className="flex-1 rounded-xl">
                  {savingDoc ? "Saving…" : <><Check className="w-4 h-4 mr-1" /> Save</>}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </FeaturePageShell>
  );
};

export default Tattersalls;

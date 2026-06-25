import { useState, useRef } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import DocumentScannerSheet from "@/components/DocumentScannerSheet";
import { Building, Plus, FileText, TrendingUp, Upload, Camera, ScanLine, File, Pencil, X, Check, Trash2, StickyNote, CheckSquare, Square, Settings } from "lucide-react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTattersalls, type TatDocument } from "@/hooks/useTattersalls";

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

const Tattersalls = () => {
  const { balanceHistory, expenses, expenseCategories, documents, notes, loading, uploadingDoc, addBalance, addExpense, saveExpenseCategories, uploadDocument, updateDocument, addNote, toggleNote, deleteNote } = useTattersalls();

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

  // Notes / tasks
  const [newNoteText, setNewNoteText] = useState("");
  const [newNoteAuthor, setNewNoteAuthor] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Settings (expense categories)
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editCategories, setEditCategories] = useState<string[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [savingCats, setSavingCats] = useState(false);

  // Computed
  const regularExpenses = expenses.filter((e) => e.frequency !== "One-off");
  const oneOffExpenses = expenses.filter((e) => e.frequency === "One-off");

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
      setNewExpDesc(""); setNewExpAmount(""); setNewExpType("General"); setNewExpFrequency("Monthly");
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
    try {
      await addNote(newNoteText.trim(), newNoteAuthor.trim() || undefined);
      setNewNoteText("");
    } finally { setAddingNote(false); }
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
      <FeaturePageShell title="Tattersalls" subtitle="Flat management & expenses" icon={<Building className="w-5 h-5" />}>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </FeaturePageShell>
    );
  }

  return (
    <FeaturePageShell title="Tattersalls" subtitle="Flat management & expenses" icon={<Building className="w-5 h-5" />}>
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
        <div className="flex items-center justify-between px-1 mb-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <StickyNote className="w-3.5 h-3.5" /> Notes & Tasks
          </h3>
        </div>

        {/* Add note input */}
        <div className="flex gap-2 mb-3">
          <Input
            value={newNoteText}
            onChange={(e) => setNewNoteText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleAddNote()}
            placeholder="Add a note or task…"
            className="flex-1 h-9 rounded-xl text-sm"
          />
          <Input
            value={newNoteAuthor}
            onChange={(e) => setNewNoteAuthor(e.target.value)}
            placeholder="Who?"
            className="w-24 h-9 rounded-xl text-sm"
          />
          <Button size="sm" onClick={handleAddNote} disabled={addingNote || !newNoteText.trim()} className="h-9 rounded-xl px-3">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
          {notes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No notes yet — add one above.</p>
          ) : notes.map((note) => (
            <div key={note.id} className={`flex items-start gap-3 px-3 py-2.5 transition-colors ${note.done ? "bg-muted/20" : ""}`}>
              <button onClick={() => toggleNote(note.id, !note.done)} className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-primary">
                {note.done ? <CheckSquare className="w-4 h-4 text-green-500" /> : <Square className="w-4 h-4" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${note.done ? "line-through text-muted-foreground" : "text-card-foreground"}`}>{note.text}</p>
                {note.author && <p className="text-[10px] text-muted-foreground mt-0.5">{note.author}</p>}
              </div>
              <button onClick={() => deleteNote(note.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0 mt-0.5">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Expenses */}
      <div className="mb-5">
        <div className="flex items-center justify-between px-1 mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Expenses</h3>
          <div className="flex items-center gap-3">
            <button onClick={openSettings} className="text-muted-foreground hover:text-foreground" title="Manage categories">
              <Settings className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setAddExpOpen(true)} className="flex items-center gap-1 text-xs text-primary font-medium">
              <Plus className="w-3.5 h-3.5" /> Add Expense
            </button>
          </div>
        </div>

        {/* Regular expenses */}
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 mb-1.5">Regular</p>
          <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
            {regularExpenses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No regular expenses yet.</p>
            ) : regularExpenses.map((exp, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{exp.desc}</p>
                  <p className="text-[10px] text-muted-foreground">{exp.date} · {exp.type} · {exp.frequency}</p>
                </div>
                <span className="text-sm font-bold font-display text-card-foreground">£{exp.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* One-off expenses */}
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-wider px-1 mb-1.5">One-off</p>
          <div className="rounded-xl bg-card border border-border/50 shadow-soft divide-y divide-border/30 overflow-hidden">
            {oneOffExpenses.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No one-off expenses yet.</p>
            ) : oneOffExpenses.map((exp, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{exp.desc}</p>
                  <p className="text-[10px] text-muted-foreground">{exp.date} · {exp.type}</p>
                </div>
                <span className="text-sm font-bold font-display text-card-foreground">£{exp.amount}</span>
              </div>
            ))}
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
          <DialogHeader><DialogTitle className="font-display">Expense Categories</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
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
                  className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 resize-none"
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

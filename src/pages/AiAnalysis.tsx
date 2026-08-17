import { useRef, useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Upload, FileText, ImageIcon, X, Loader2, AlertCircle, ChevronDown, ChevronUp, History,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAiAnalysis, type UploadedDoc } from "@/hooks/useAiAnalysis";
import { useSharedScope } from "@/hooks/useSharedScope";

const MAX_DOCUMENTS = 5;

const PRESET_QUESTIONS = [
  "Summarize this document in plain English",
  "What type of document is this?",
  "What are the key dates or deadlines mentioned?",
  "Is there any money owed, due, or refunded — and how much?",
  "Are there any fees or charges I should be aware of?",
  "What account, policy, or reference number does this relate to?",
  "Who is the document from, and who is it addressed to?",
  "Are there any renewal or expiry dates I need to act on?",
  "What is the total balance or amount shown?",
  "Are there any tax implications mentioned?",
  "Does this document mention any tax relief or allowances I could claim?",
  "What contributions or payments are recorded in this document?",
  "Are there any penalties, interest charges, or late fees mentioned?",
  "What actions do I need to take based on this document?",
  "Is there anything unusual or that looks like an error in this document?",
  "What is the interest rate or growth rate mentioned, if any?",
  "Does this document reference any other accounts or policies?",
  "What is the coverage or benefit amount, if this is an insurance document?",
  "Are there contact details or a phone number I should keep for reference?",
  "Explain any jargon or technical terms used in this document",
];

function AnswerRenderer({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-0.5 text-sm leading-relaxed text-card-foreground">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-2" />;
        const headerMatch = line.match(/^\*\*(.+)\*\*\s*$/);
        if (headerMatch) {
          return (
            <h4 key={i} className="font-bold text-[13px] text-foreground mt-4 mb-1.5 pb-1 border-b border-border/30">
              {headerMatch[1]}
            </h4>
          );
        }
        if (line.trim().startsWith("- ") || line.trim().startsWith("• ")) {
          return (
            <div key={i} className="flex gap-2 ml-2 text-[13px]">
              <span className="text-primary mt-0.5 flex-shrink-0">•</span>
              <span>{line.trim().replace(/^[-•]\s*/, "")}</span>
            </div>
          );
        }
        const numMatch = line.match(/^(\d+)\.\s+(.+)/);
        if (numMatch) {
          return (
            <div key={i} className="flex gap-2 ml-2 text-[13px]">
              <span className="text-primary font-bold flex-shrink-0 text-xs mt-0.5 w-5">{numMatch[1]}.</span>
              <span>{numMatch[2]}</span>
            </div>
          );
        }
        return <p key={i} className="text-[13px]">{line}</p>;
      })}
    </div>
  );
}

export default function AiAnalysis() {
  const { scopeUserId, permission, pageTitle, isOwnScope } = useSharedScope("ai_analysis");
  const canEdit = permission === "edit";
  const { sessions, uploadDocument, analyze } = useAiAnalysis(scopeUserId ?? undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [pendingDocs, setPendingDocs] = useState<UploadedDoc[]>([]);
  const [uploading, setUploading] = useState(false);
  const [question, setQuestion] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    const remaining = MAX_DOCUMENTS - pendingDocs.length;
    if (remaining <= 0) {
      setError(`You can attach up to ${MAX_DOCUMENTS} documents at a time.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    try {
      const uploaded = await Promise.all(toUpload.map((f) => uploadDocument(f)));
      setPendingDocs((prev) => [...prev, ...uploaded]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeDoc = (storagePath: string) => {
    setPendingDocs((prev) => prev.filter((d) => d.storagePath !== storagePath));
  };

  const handleAnalyze = async () => {
    if (pendingDocs.length === 0 || !question.trim()) return;
    setAnalyzing(true);
    setError(null);
    setAnswer(null);
    try {
      const result = await analyze(pendingDocs, question.trim());
      setAnswer(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed. Please try again.");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <FeaturePageShell
      title={pageTitle}
      subtitle={isOwnScope ? "Upload a document and ask questions about it" : "Shared with you"}
      icon={<Sparkles className="w-5 h-5" />}
      sharePage="ai_analysis"
    >
      {canEdit && (
      <>
      {/* Upload */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-gradient-primary inline-block" />
          Documents
        </h3>

        {pendingDocs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
            {pendingDocs.map((doc) => (
              <div key={doc.storagePath} className="relative flex items-center gap-2 p-2 rounded-xl bg-muted/40 border border-border/30">
                {doc.mimeType.startsWith("image/") ? (
                  <img src={doc.url} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-md bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-rose-500" />
                  </div>
                )}
                <span className="text-xs text-card-foreground truncate flex-1">{doc.name}</span>
                <button onClick={() => removeDoc(doc.storagePath)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-9 rounded-xl gap-1.5"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || pendingDocs.length >= MAX_DOCUMENTS}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Uploading…" : "Upload photo or PDF"}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-1.5">Up to {MAX_DOCUMENTS} files, 15MB each. Images or PDFs.</p>
      </div>

      {/* Question */}
      <div className="p-4 rounded-2xl bg-card border border-border/50 shadow-soft mb-4">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <span className="w-1 h-4 rounded-full bg-gradient-primary inline-block" />
          Ask a question
        </h3>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESET_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => setQuestion(q)}
              className={`text-[11px] px-2.5 py-1.5 rounded-full border transition-colors ${
                question === q
                  ? "bg-primary/10 border-primary/40 text-primary font-medium"
                  : "bg-muted/40 border-border/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {q}
            </button>
          ))}
        </div>

        <Textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Or type your own question…"
          className="rounded-xl text-sm min-h-20"
        />

        <Button
          onClick={handleAnalyze}
          disabled={pendingDocs.length === 0 || !question.trim() || analyzing}
          className="w-full h-11 rounded-xl mt-3 bg-gradient-primary gap-2"
        >
          {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {analyzing ? "Analyzing…" : "Analyze"}
        </Button>

        {error && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-xl bg-destructive/10 text-destructive text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>
      </>
      )}

      {/* Answer */}
      <AnimatePresence>
        {answer && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-2xl bg-card border border-primary/20 shadow-card mb-4"
          >
            <h3 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> Answer
            </h3>
            <AnswerRenderer text={answer} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {sessions.length > 0 && (
        <div className="rounded-2xl bg-card border border-border/50 shadow-soft overflow-hidden">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="w-full p-4 flex items-center justify-between text-left"
          >
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <History className="w-3.5 h-3.5" /> Past questions ({sessions.length})
            </h3>
            {historyOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {historyOpen && (
              <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 space-y-2">
                  {sessions.map((s) => {
                    const expanded = expandedSessionId === s.id;
                    return (
                      <div key={s.id} className="rounded-xl border border-border/40 overflow-hidden">
                        <button
                          onClick={() => setExpandedSessionId(expanded ? null : s.id)}
                          className="w-full p-3 text-left flex items-center gap-2"
                        >
                          <ImageIcon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium text-card-foreground truncate">{s.question}</p>
                            <p className="text-[10px] text-muted-foreground truncate">{s.documentNames.join(", ")}</p>
                          </div>
                          {expanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                        </button>
                        {expanded && (
                          <div className="px-3 pb-3 border-t border-border/30 pt-2">
                            <AnswerRenderer text={s.answer} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </FeaturePageShell>
  );
}

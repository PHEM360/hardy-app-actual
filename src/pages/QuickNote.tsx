import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StickyNote, CheckSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNotes } from "@/hooks/useNotes";
import { toast } from "sonner";

export default function QuickNote() {
  const navigate = useNavigate();
  const { addNote } = useNotes();
  const [kind, setKind] = useState<"note" | "checklist">("note");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [item, setItem] = useState("");
  const [items, setItems] = useState<{ id: string; text: string; done: boolean }[]>([]);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!title.trim() && !body.trim() && items.length === 0) {
      toast.error("Write something first");
      return;
    }
    setBusy(true);
    try {
      await addNote({
        kind,
        title: title.trim(),
        body: kind === "note" ? body : "",
        checklist: kind === "checklist" ? items.filter((i) => i.text.trim()) : [],
      });
      toast.success("Saved to Notes");
      navigate("/notes");
    } catch {
      toast.error("Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background px-4 py-6">
      <button
        type="button"
        onClick={() => navigate("/notes")}
        className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Notes
      </button>
      <h1 className="font-display text-xl font-bold">Quick note</h1>
      <p className="mb-4 text-sm text-muted-foreground">Capture something and it lands in your Notes inbox.</p>

      <div className="mb-3 flex gap-2">
        <Button type="button" variant={kind === "note" ? "default" : "outline"} size="sm" onClick={() => setKind("note")}>
          <StickyNote className="mr-1 h-3.5 w-3.5" /> Note
        </Button>
        <Button type="button" variant={kind === "checklist" ? "default" : "outline"} size="sm" onClick={() => setKind("checklist")}>
          <CheckSquare className="mr-1 h-3.5 w-3.5" /> Checklist
        </Button>
      </div>

      <Input className="mb-3 text-lg font-semibold" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />

      {kind === "note" ? (
        <Textarea className="mb-4 min-h-[200px]" placeholder="What’s on your mind?" value={body} onChange={(e) => setBody(e.target.value)} />
      ) : (
        <div className="mb-4 space-y-2">
          {items.map((row) => (
            <p key={row.id} className="rounded-lg border border-border px-3 py-2 text-sm">{row.text}</p>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!item.trim()) return;
              setItems((prev) => [...prev, { id: `c${Date.now()}`, text: item.trim(), done: false }]);
              setItem("");
            }}
          >
            <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Add an item" />
            <Button type="submit" variant="secondary">Add</Button>
          </form>
        </div>
      )}

      <Button className="w-full" disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
    </div>
  );
}

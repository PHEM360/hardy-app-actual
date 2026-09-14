import { useState } from "react";
import { CheckSquare, GitBranch, PenLine, StickyNote } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DiagramCanvas } from "@/components/notes/NoteDiagram";
import { DIAGRAM_TEMPLATES } from "@/lib/noteDiagram";
import type { NoteDiagram, NoteKind } from "@/types/notes";

export type NoteStartChoice = {
  kind: NoteKind;
  diagram?: NoteDiagram | null;
  title?: string;
};

const KINDS: { id: NoteKind; label: string; hint: string; icon: typeof StickyNote }[] = [
  { id: "note", label: "Note", hint: "A blank sheet. Just start typing.", icon: StickyNote },
  { id: "checklist", label: "Checklist", hint: "Jobs you can tick off.", icon: CheckSquare },
  { id: "drawing", label: "Sketch", hint: "Draw on paper.", icon: PenLine },
  { id: "note", label: "Diagram", hint: "Flows, networks, family maps.", icon: GitBranch },
];

export function NoteStartDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (choice: NoteStartChoice) => void;
}) {
  const [step, setStep] = useState<"kind" | "diagram" | "title">("kind");
  const [pending, setPending] = useState<NoteStartChoice | null>(null);
  const [title, setTitle] = useState("");

  const close = (nextOpen: boolean) => {
    if (!nextOpen) {
      setStep("kind");
      setPending(null);
      setTitle("");
    }
    onOpenChange(nextOpen);
  };

  const askTitle = (choice: NoteStartChoice) => {
    setPending(choice);
    setTitle("");
    setStep("title");
  };

  const finish = () => {
    const trimmed = title.trim();
    if (!pending || !trimmed) return;
    onPick({ ...pending, title: trimmed });
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {step === "diagram" ? "Choose a diagram" : step === "title" ? "Give it a name" : "Start a note"}
          </DialogTitle>
          <DialogDescription>
            {step === "diagram"
              ? "Use a ready-made board or start blank."
              : step === "title"
                ? "Checklists, sketches and diagrams need a title so you can find them later."
                : "A note is just paper. The others ask for a name first."}
          </DialogDescription>
        </DialogHeader>
        {step === "kind" && (
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((kind, index) => {
              const Icon = kind.icon;
              return (
                <button
                  key={`${kind.label}-${index}`}
                  type="button"
                  onClick={() => {
                    if (kind.label === "Diagram") {
                      setStep("diagram");
                      return;
                    }
                    if (kind.label === "Note") {
                      onPick({ kind: "note" });
                      close(false);
                      return;
                    }
                    askTitle({ kind: kind.id });
                  }}
                  className="rounded-2xl border border-border/50 bg-card p-4 text-left shadow-card transition hover:border-primary/40"
                >
                  <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </span>
                  <p className="font-display text-sm font-bold">{kind.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{kind.hint}</p>
                </button>
              );
            })}
          </div>
        )}
        {step === "diagram" && (
          <div className="space-y-2">
            <button type="button" className="text-xs font-semibold text-primary" onClick={() => setStep("kind")}>
              Back
            </button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DIAGRAM_TEMPLATES.map((template) => {
                const preview = template.build();
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => askTitle({ kind: "note", diagram: template.build() })}
                    className="rounded-2xl border border-border/50 bg-card p-3 text-left shadow-card transition hover:border-primary/40"
                  >
                    <div className="mb-2 h-20 overflow-hidden rounded-xl bg-background">
                      {preview.nodes.length ? (
                        <DiagramCanvas diagram={preview} className="h-full w-full" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">Blank</div>
                      )}
                    </div>
                    <p className="text-sm font-semibold">{template.label}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{template.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {step === "title" && (
          <div className="space-y-3">
            <button type="button" className="text-xs font-semibold text-primary" onClick={() => setStep(pending?.diagram !== undefined ? "diagram" : "kind")}>
              Back
            </button>
            <Input
              autoFocus
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  finish();
                }
              }}
              placeholder="Title"
              aria-label="Note title"
            />
            <Button className="w-full rounded-xl bg-gradient-primary" disabled={!title.trim()} onClick={finish}>
              Continue
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

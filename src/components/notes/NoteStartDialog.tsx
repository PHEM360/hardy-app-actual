import { useEffect, useState } from "react";
import { ArrowRight, CheckSquare, ChevronLeft, GitBranch, PenLine, StickyNote } from "lucide-react";
import { JEWEL, jewelGradient } from "@/lib/brandPalette";
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

const KINDS: { id: NoteKind; label: string; hint: string; icon: typeof StickyNote; tone: string }[] = [
  { id: "note", label: "Note", hint: "A blank sheet. Just start typing.", icon: StickyNote, tone: JEWEL.petrol },
  { id: "checklist", label: "Checklist", hint: "Jobs you can tick off.", icon: CheckSquare, tone: JEWEL.forest },
  { id: "drawing", label: "Sketch", hint: "Draw on paper.", icon: PenLine, tone: JEWEL.burgundy },
  { id: "note", label: "Diagram", hint: "Flows, networks, family maps.", icon: GitBranch, tone: JEWEL.aubergine },
];

const TILE = "overflow-hidden rounded-xl border border-foreground/20 bg-card text-left shadow-card transition-transform duration-150 active:translate-y-px active:brightness-95";

export function NoteStartDialog({
  open,
  onOpenChange,
  onPick,
  startAt = "kind",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (choice: NoteStartChoice) => void;
  /** Open straight on the diagram templates when the person already chose Diagram. */
  startAt?: "kind" | "diagram";
}) {
  const [step, setStep] = useState<"kind" | "diagram" | "title">(startAt);

  useEffect(() => {
    if (open) setStep(startAt);
  }, [open, startAt]);
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
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                  className={`${TILE} flex items-stretch`}
                >
                  <span className="btn-edge flex w-12 shrink-0 items-center justify-center text-white" style={{ background: jewelGradient(kind.tone) }}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 p-3">
                    <span className="block font-display text-base font-semibold">{kind.label}</span>
                    <span className="mt-0.5 block text-xs leading-snug text-foreground/80">{kind.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {step === "diagram" && (
          <div className="space-y-2">
            <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => setStep("kind")}>
              <ChevronLeft /> Back
            </Button>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DIAGRAM_TEMPLATES.map((template) => {
                const preview = template.build();
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => askTitle({ kind: "note", diagram: template.build() })}
                    className={`${TILE} p-3`}
                  >
                    <div className="mb-2 h-20 overflow-hidden rounded-lg border border-foreground/15 bg-[#fffdf8]">
                      {preview.nodes.length ? (
                        <DiagramCanvas diagram={preview} className="h-full w-full" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-xs font-semibold text-foreground/70">Blank board</div>
                      )}
                    </div>
                    <p className="font-display text-sm font-semibold">{template.label}</p>
                    <p className="mt-0.5 text-xs text-foreground/80">{template.hint}</p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {step === "title" && (
          <div className="space-y-3">
            <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => setStep(pending?.diagram !== undefined ? "diagram" : "kind")}>
              <ChevronLeft /> Back
            </Button>
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
              className="h-11 border-foreground/30 bg-card text-base"
            />
            <Button className="w-full" disabled={!title.trim()} onClick={finish}>
              <ArrowRight /> Continue
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

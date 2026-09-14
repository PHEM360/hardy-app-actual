import type { NoteCanvas, NoteKind } from "@/types/notes";

export function deriveNoteTitle(draft: {
  title?: string | null;
  kind?: NoteKind;
  canvas?: NoteCanvas | null;
}): string {
  const explicit = draft.title?.trim();
  if (explicit) return explicit.slice(0, 80);

  const blocks = draft.canvas?.blocks ?? [];
  const text = blocks.find((block) => block.type === "text" && block.text.trim());
  if (text?.type === "text") {
    const first = text.text.trim().split("\n")[0]?.trim();
    if (first) return first.slice(0, 80);
  }

  const list = blocks.find((block) => block.type === "checklist");
  if (list?.type === "checklist") {
    const heading = list.title?.trim();
    if (heading && heading.toLowerCase() !== "checklist") return heading.slice(0, 80);
  }

  if (blocks.some((block) => block.type === "diagram" && (block.diagram?.nodes.length ?? 0) > 0)) {
    return "Diagram";
  }
  if (draft.kind === "checklist" || draft.kind === "task") return "Checklist";
  if (draft.kind === "drawing") return "Sketch";
  return "Note";
}

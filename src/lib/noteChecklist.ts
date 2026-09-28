import type { HubNote, NoteCanvas, NoteChecklistItem } from "@/types/notes";

export function noteChecklistItems(note: Pick<HubNote, "checklist" | "canvas" | "kind">): NoteChecklistItem[] {
  const fromCanvas = note.canvas?.blocks.find((block) => block.type === "checklist");
  if (fromCanvas?.type === "checklist" && fromCanvas.items.length) return fromCanvas.items;
  return note.checklist ?? [];
}

export function noteHasChecklist(note: Pick<HubNote, "checklist" | "canvas" | "kind">): boolean {
  if (note.kind === "checklist" || note.kind === "task") return true;
  return noteChecklistItems(note).some((item) => item.text.trim() || item.done);
}

export function patchNoteChecklist(
  note: HubNote,
  itemId: string,
  done: boolean,
): Pick<HubNote, "checklist" | "canvas"> {
  const patchItems = (items: NoteChecklistItem[]) =>
    items.map((item) => (item.id === itemId ? { ...item, done } : item));

  const checklist = patchItems(note.checklist ?? []);
  const canvas: NoteCanvas | null | undefined = note.canvas
    ? {
        ...note.canvas,
        blocks: note.canvas.blocks.map((block) =>
          block.type === "checklist" ? { ...block, items: patchItems(block.items) } : block,
        ),
      }
    : note.canvas;

  return { checklist, canvas };
}

export function canvasChecklistItems(canvas: NoteCanvas | null | undefined): NoteChecklistItem[] {
  const block = canvas?.blocks.find((entry) => entry.type === "checklist");
  return block?.type === "checklist" ? block.items : [];
}

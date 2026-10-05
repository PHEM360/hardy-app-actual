import { describe, expect, it } from "vitest";
import { noteHasChecklist, noteChecklistItems, patchNoteChecklist } from "@/lib/noteChecklist";
import type { HubNote } from "@/types/notes";

const note: HubNote = {
  id: "n1",
  ownerId: "owner",
  folderId: null,
  kind: "checklist",
  title: "Jobs",
  body: "",
  color: "yellow",
  category: "personal",
  pinned: false,
  archived: false,
  tags: [],
  checklist: [{ id: "i1", text: "Milk", done: false }],
  locked: false,
  vault: false,
  sharedWith: [],
  canvas: {
    version: 1,
    height: 400,
    blocks: [{
      id: "c1",
      type: "checklist",
      x: 10,
      y: 10,
      width: 300,
      height: 180,
      title: "Jobs",
      items: [{ id: "i1", text: "Milk", done: false }],
    }],
  },
};

describe("noteChecklist", () => {
  it("reads items from the canvas when present", () => {
    expect(noteHasChecklist(note)).toBe(true);
    expect(noteChecklistItems(note)[0].text).toBe("Milk");
  });

  it("patches both the legacy list and the canvas block", () => {
    const patched = patchNoteChecklist(note, "i1", true);
    expect(patched.checklist?.[0].done).toBe(true);
    const block = patched.canvas?.blocks[0];
    expect(block?.type === "checklist" && block.items[0].done).toBe(true);
  });
});

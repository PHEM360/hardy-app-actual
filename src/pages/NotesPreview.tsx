import Notes from "@/pages/Notes";
import BottomNav from "@/components/layout/BottomNav";
import type { HubNote, NoteFolder } from "@/types/notes";

/**
 * Dev-only preview of the Notes page with sample notes.
 * Routed at /dev/notes-preview when import.meta.env.DEV. Nothing is saved.
 */
function note(id: string, patch: Partial<HubNote>): HubNote {
  return {
    id,
    ownerId: "preview",
    folderId: null,
    kind: "note",
    title: "",
    body: "",
    color: "default",
    category: "personal",
    pinned: false,
    archived: false,
    tags: [],
    checklist: [],
    locked: false,
    vault: false,
    sharedWith: [],
    ...patch,
  };
}

const FOLDERS: NoteFolder[] = [
  { id: "f1", ownerId: "preview", name: "House", color: "green", parentId: null, sortOrder: 0, sharedWith: [] },
  { id: "f2", ownerId: "preview", name: "Travel", color: "blue", parentId: null, sortOrder: 1, sharedWith: [] },
];

const NOTES: HubNote[] = [
  note("n1", {
    title: "Weekend jobs",
    kind: "checklist",
    pinned: true,
    category: "family",
    folderId: "f1",
    dueDate: "2026-10-11",
    checklist: [
      { id: "c1", text: "Bleed the radiators", done: true },
      { id: "c2", text: "Book the boiler service", done: false },
      { id: "c3", text: "Take the garden waste to the tip", done: false },
      { id: "c4", text: "Order logs", done: false },
    ],
  }),
  note("n2", {
    title: "Wifi and router",
    pinned: true,
    folderId: "f1",
    body: "Router is in the hall cupboard. Guest network is HardyGuest. Restart it from the app before calling the provider.",
  }),
  note("n3", {
    title: "Gift ideas for Mum",
    category: "family",
    body: "A print of the harbour.\nThe cookery course in Padstow.\nNew walking boots, size 6.",
  }),
  note("n4", {
    title: "Portugal packing",
    kind: "checklist",
    folderId: "f2",
    category: "personal",
    dueDate: "2026-10-24",
    checklist: [
      { id: "p1", text: "Passports", done: true },
      { id: "p2", text: "Travel insurance documents", done: true },
      { id: "p3", text: "Car hire confirmation", done: false },
    ],
  }),
  note("n5", {
    title: "Questions for the accountant",
    category: "work",
    dueDate: "2026-10-02",
    body: "Can the home office costs be claimed this year. What is the deadline for the payment on account.",
  }),
  note("n6", { title: "", body: "Milk, eggs, coffee beans, dishwasher tablets." }),
  note("n7", { title: "Pension login", locked: true, category: "finance" }),
];

export default function NotesPreview() {
  return (
    <div className="min-h-[100dvh] bg-background pb-[calc(4rem+env(safe-area-inset-bottom,0px))]">
      <Notes preview={{ notes: NOTES, folders: FOLDERS }} />
      <BottomNav />
    </div>
  );
}

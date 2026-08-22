import type { CSSProperties } from "react";
import type { HubNote, NoteFolder, NotesColorMode, NotesListStyle } from "@/types/notes";
import { NOTE_CATEGORIES, NOTE_COLORS } from "@/types/notes";

const KIND_SWATCH: Record<string, string> = {
  note: "#fde68a",
  checklist: "#86efac",
  task: "#c4b5fd",
};

const STATUS_SWATCH = {
  overdue: "#fca5a5",
  soon: "#fdba74",
  open: "#93c5fd",
  done: "#86efac",
  plain: "#e2e8f0",
};

function hashIndex(id: string, mod: number) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h % Math.max(mod, 1);
}

function mix(swatch: string, amount = 78): string {
  return `color-mix(in srgb, ${swatch} ${amount}%, hsl(var(--card)))`;
}

function shade(hex: string, index: number, total: number) {
  const t = total <= 1 ? 0.55 : 0.28 + (index / Math.max(total - 1, 1)) * 0.55;
  return `color-mix(in srgb, ${hex} ${Math.round(t * 100)}%, hsl(var(--card)))`;
}

export function noteSwatch(
  note: HubNote,
  index: number,
  total: number,
  mode: NotesColorMode,
  folders: NoteFolder[],
  shadeHue: string,
): string | null {
  if (mode === "none") return null;
  if (mode === "note") {
    const found = NOTE_COLORS.find((c) => c.id === note.color);
    if (found && note.color !== "default") return found.swatch;
    const colors = NOTE_COLORS.filter((c) => c.id !== "default");
    return colors[hashIndex(note.id || note.title, colors.length)]?.swatch ?? "#fde68a";
  }
  if (mode === "folder") {
    const folder = folders.find((f) => f.id === note.folderId);
    const id = folder?.color || "default";
    const found = NOTE_COLORS.find((c) => c.id === id);
    return found && id !== "default" ? found.swatch : "#cbd5e1";
  }
  if (mode === "kind") return KIND_SWATCH[note.kind] ?? KIND_SWATCH.note;
  if (mode === "category") {
    return NOTE_CATEGORIES.find((c) => c.id === note.category)?.swatch ?? NOTE_CATEGORIES[6].swatch;
  }
  if (mode === "status") {
    const items = note.checklist ?? [];
    const done = items.length > 0 && items.every((i) => i.done);
    if (done) return STATUS_SWATCH.done;
    if (note.dueDate) {
      const due = new Date(`${note.dueDate.slice(0, 10)}T12:00:00`);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (due < today) return STATUS_SWATCH.overdue;
      const soon = new Date(today);
      soon.setDate(soon.getDate() + 3);
      if (due <= soon) return STATUS_SWATCH.soon;
    }
    if (items.some((i) => !i.done)) return STATUS_SWATCH.open;
    return STATUS_SWATCH.plain;
  }
  if (mode === "alternate") {
    return index % 2 === 0 ? "#fde68a" : "#bfdbfe";
  }
  if (mode === "random") {
    const colors = NOTE_COLORS.filter((c) => c.id !== "default");
    return colors[hashIndex(note.id, colors.length)]?.swatch ?? null;
  }
  if (mode === "shades") return shade(shadeHue, index, total);
  return null;
}

export function noteCardStyle(
  swatch: string | null,
  listStyle: NotesListStyle,
  index = 0,
): CSSProperties {
  const rotate = listStyle === "paper" ? `${(index % 5) - 2}deg` : undefined;
  if (!swatch) {
    return {
      backgroundColor: listStyle === "filled" ? "hsl(var(--muted))" : undefined,
      transform: rotate ? `rotate(${rotate})` : undefined,
    };
  }
  if (listStyle === "outlined") {
    return { borderLeftWidth: 6, borderLeftColor: swatch, backgroundColor: "hsl(var(--card))" };
  }
  if (listStyle === "filled") {
    return { backgroundColor: swatch, color: "#1c1917" };
  }
  if (listStyle === "paper") {
    return {
      backgroundColor: mix(swatch, 82),
      transform: `rotate(${rotate})`,
      boxShadow: "2px 3px 0 rgba(28,25,23,0.12)",
    };
  }
  if (listStyle === "compact") {
    return { backgroundColor: mix(swatch, 55) };
  }
  return {
    backgroundColor: mix(swatch, 78),
    boxShadow: "0 8px 24px -12px color-mix(in srgb, " + swatch + " 55%, transparent)",
  };
}

export const COLOR_MODE_OPTIONS: { id: NotesColorMode; label: string; hint: string }[] = [
  { id: "note", label: "Note colour", hint: "Each note’s own colour" },
  { id: "folder", label: "By folder", hint: "Match the sidebar folder" },
  { id: "kind", label: "By type", hint: "Note, checklist or task" },
  { id: "category", label: "By category", hint: "Personal, work, family…" },
  { id: "status", label: "By status", hint: "Overdue, soon, done" },
  { id: "alternate", label: "Alternate", hint: "Zebra stripes" },
  { id: "random", label: "Random", hint: "A stable colour per note" },
  { id: "shades", label: "Shades", hint: "Light-to-dark of one hue" },
  { id: "none", label: "None", hint: "Plain cards" },
];

export const LIST_STYLE_OPTIONS: { id: NotesListStyle; label: string }[] = [
  { id: "keep", label: "Cards" },
  { id: "paper", label: "Sticky notes" },
  { id: "outlined", label: "Accent bar" },
  { id: "filled", label: "Bold fill" },
  { id: "compact", label: "Compact" },
];

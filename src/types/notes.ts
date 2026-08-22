export type NoteKind = "note" | "checklist" | "task" | "drawing";
export type NotesView = "grid" | "list" | "board" | "calendar" | "agenda";
export type NoteSharePermission = "view" | "edit";
export type VaultUnlockMethod = "pin" | "webauthn" | "both";
export type NotesColorMode =
  | "note"
  | "folder"
  | "kind"
  | "category"
  | "status"
  | "alternate"
  | "random"
  | "shades"
  | "none";
export type NotesListStyle = "keep" | "paper" | "outlined" | "filled" | "compact";
export type NoteCategory = "personal" | "family" | "work" | "ideas" | "shopping" | "health" | "other";

export interface NoteChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

export interface NoteCipher {
  salt: string;
  iv: string;
  data: string;
}

export interface NoteDiagramNode {
  id: string;
  label: string;
  x: number;
  y: number;
  shape: "box" | "diamond" | "circle" | "oval";
}

export interface NoteDiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
}

export interface NoteDiagram {
  nodes: NoteDiagramNode[];
  edges: NoteDiagramEdge[];
}

export type NoteCanvasBlock =
  | {
      id: string;
      type: "text";
      x: number;
      y: number;
      width: number;
      height: number;
      text: string;
      textStyle: "body" | "heading" | "callout";
    }
  | {
      id: string;
      type: "shape";
      x: number;
      y: number;
      width: number;
      height: number;
      shape: "rectangle" | "ellipse" | "diamond";
      label: string;
      fill: string;
    }
  | {
      id: string;
      type: "drawing";
      x: number;
      y: number;
      width: number;
      height: number;
      paths: string[];
      stroke: string;
    }
  | {
      id: string;
      type: "media";
      x: number;
      y: number;
      width: number;
      height: number;
      mediaType: "image" | "video" | "audio";
      url: string;
      name: string;
    }
  | {
      id: string;
      type: "location";
      x: number;
      y: number;
      width: number;
      height: number;
      latitude: number;
      longitude: number;
      label: string;
    };

export interface NoteCanvas {
  version: 1;
  height: number;
  blocks: NoteCanvasBlock[];
}

export interface HubNote {
  id: string;
  ownerId: string;
  folderId: string | null;
  kind: NoteKind;
  title: string;
  body: string;
  color: string;
  category: NoteCategory;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  checklist: NoteChecklistItem[];
  diagram?: NoteDiagram | null;
  canvas?: NoteCanvas | null;
  dueDate?: string;
  calendarEventId?: string;
  addToCalendar?: boolean;
  locked: boolean;
  cipher?: NoteCipher | null;
  vault: boolean;
  sharedWith: string[];
  sharePermission?: NoteSharePermission;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NoteFolder {
  id: string;
  ownerId: string;
  name: string;
  color: string;
  emoji?: string;
  parentId?: string | null;
  sortOrder: number;
  sharedWith: string[];
  sharePermission?: NoteSharePermission;
  createdAt?: unknown;
}

export interface NoteGrant {
  id: string;
  ownerId: string;
  targetUid: string;
  permission: NoteSharePermission;
  noteId?: string;
  folderId?: string;
  title?: string;
}

export interface NotesPrefs {
  defaultView: NotesView;
  showTasksPageItems: boolean;
  showCalendarEvents: boolean;
  colorMode: NotesColorMode;
  listStyle: NotesListStyle;
  shadeHue: string;
}

export interface NotesVaultSettings {
  method: VaultUnlockMethod | null;
  pinSalt?: string;
  pinHash?: string;
  webauthnCredentialId?: string;
  updatedAt?: unknown;
}

export const NOTE_COLORS = [
  { id: "default", label: "Default", swatch: "hsl(var(--card))", text: "text-foreground" },
  { id: "yellow", label: "Yellow", swatch: "#fde68a", text: "text-amber-950 dark:text-amber-50" },
  { id: "orange", label: "Orange", swatch: "#fdba74", text: "text-orange-950 dark:text-orange-50" },
  { id: "red", label: "Red", swatch: "#fca5a5", text: "text-red-950 dark:text-red-50" },
  { id: "pink", label: "Pink", swatch: "#f9a8d4", text: "text-pink-950 dark:text-pink-50" },
  { id: "purple", label: "Purple", swatch: "#d8b4fe", text: "text-purple-950 dark:text-purple-50" },
  { id: "blue", label: "Blue", swatch: "#93c5fd", text: "text-blue-950 dark:text-blue-50" },
  { id: "teal", label: "Teal", swatch: "#5eead4", text: "text-teal-950 dark:text-teal-50" },
  { id: "green", label: "Green", swatch: "#86efac", text: "text-green-950 dark:text-green-50" },
  { id: "gray", label: "Grey", swatch: "#e2e8f0", text: "text-slate-900 dark:text-slate-100" },
] as const;

export const NOTE_CATEGORIES: { id: NoteCategory; label: string; swatch: string }[] = [
  { id: "personal", label: "Personal", swatch: "#fde68a" },
  { id: "family", label: "Family", swatch: "#fdba74" },
  { id: "work", label: "Work", swatch: "#93c5fd" },
  { id: "ideas", label: "Ideas", swatch: "#d8b4fe" },
  { id: "shopping", label: "Shopping", swatch: "#86efac" },
  { id: "health", label: "Health", swatch: "#5eead4" },
  { id: "other", label: "Other", swatch: "#e2e8f0" },
];

export const DEFAULT_NOTES_PREFS: NotesPrefs = {
  defaultView: "grid",
  showTasksPageItems: true,
  showCalendarEvents: true,
  colorMode: "note",
  listStyle: "keep",
  shadeHue: "#f59e0b",
};

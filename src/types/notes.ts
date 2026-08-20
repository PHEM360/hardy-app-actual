export type NoteKind = "note" | "checklist" | "task";
export type NotesView = "grid" | "list" | "board" | "calendar" | "agenda";
export type NoteSharePermission = "view" | "edit";
export type VaultUnlockMethod = "pin" | "webauthn" | "both";

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

export interface HubNote {
  id: string;
  ownerId: string;
  folderId: string | null;
  kind: NoteKind;
  title: string;
  body: string;
  color: string;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  checklist: NoteChecklistItem[];
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

export const DEFAULT_NOTES_PREFS: NotesPrefs = {
  defaultView: "grid",
  showTasksPageItems: true,
  showCalendarEvents: true,
};

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { usePageShares } from "@/hooks/usePageShares";
import { useAppUsers } from "@/hooks/useAppUsers";
import type {
  HubNote,
  NoteChecklistItem,
  NoteFolder,
  NoteGrant,
  NoteKind,
  NotesPrefs,
  NotesVaultSettings,
  NoteSharePermission,
} from "@/types/notes";
import { DEFAULT_NOTES_PREFS } from "@/types/notes";

function newId() {
  return `n${Date.now()}${Math.random().toString(36).slice(2, 7)}`;
}

function mapNote(id: string, ownerId: string, data: Record<string, unknown>): HubNote {
  return {
    id,
    ownerId,
    folderId: (data.folderId as string | null) ?? null,
    kind: (data.kind as NoteKind) || "note",
    title: typeof data.title === "string" ? data.title : "",
    body: typeof data.body === "string" ? data.body : "",
    color: typeof data.color === "string" ? data.color : "default",
    pinned: !!data.pinned,
    archived: !!data.archived,
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    checklist: Array.isArray(data.checklist) ? (data.checklist as NoteChecklistItem[]) : [],
    dueDate: typeof data.dueDate === "string" ? data.dueDate : undefined,
    calendarEventId: typeof data.calendarEventId === "string" ? data.calendarEventId : undefined,
    addToCalendar: !!data.addToCalendar,
    locked: !!data.locked,
    cipher: (data.cipher as HubNote["cipher"]) ?? null,
    vault: !!data.vault,
    sharedWith: Array.isArray(data.sharedWith) ? (data.sharedWith as string[]) : [],
    sharePermission: data.sharePermission as NoteSharePermission | undefined,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapFolder(id: string, ownerId: string, data: Record<string, unknown>): NoteFolder {
  return {
    id,
    ownerId,
    name: typeof data.name === "string" ? data.name : "Untitled",
    color: typeof data.color === "string" ? data.color : "default",
    emoji: typeof data.emoji === "string" ? data.emoji : undefined,
    parentId: (data.parentId as string | null) ?? null,
    sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
    sharedWith: Array.isArray(data.sharedWith) ? (data.sharedWith as string[]) : [],
    sharePermission: data.sharePermission as NoteSharePermission | undefined,
    createdAt: data.createdAt,
  };
}

export function useNotes(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const uid = scopeUserId ?? dataUid;
  const appUsers = useAppUsers();
  const { sharedWithMe } = usePageShares("notes");

  const [folders, setFolders] = useState<NoteFolder[]>([]);
  const [notes, setNotes] = useState<HubNote[]>([]);
  const [vaultNotes, setVaultNotes] = useState<HubNote[]>([]);
  const [grants, setGrants] = useState<NoteGrant[]>([]);
  const [outgoingGrants, setOutgoingGrants] = useState<NoteGrant[]>([]);
  const [sharedNotes, setSharedNotes] = useState<HubNote[]>([]);
  const [sharedFolders, setSharedFolders] = useState<NoteFolder[]>([]);
  const [prefs, setPrefs] = useState<NotesPrefs>(DEFAULT_NOTES_PREFS);
  const [vaultSettings, setVaultSettings] = useState<NotesVaultSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [vaultSubscribed, setVaultSubscribed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, "hubNotes", uid, "folders"), (snap) => {
      setFolders(snap.docs.map((d) => mapFolder(d.id, uid, d.data() as Record<string, unknown>)));
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(collection(db, "hubNotes", uid, "items"), (snap) => {
      setNotes(snap.docs.map((d) => mapNote(d.id, uid, d.data() as Record<string, unknown>)));
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    const unsub = onSnapshot(doc(db, "hubNotes", uid, "settings", "prefs"), (snap) => {
      if (snap.exists()) setPrefs({ ...DEFAULT_NOTES_PREFS, ...(snap.data() as NotesPrefs) });
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid || uid !== dataUid) {
      setVaultSettings(null);
      return;
    }
    const unsub = onSnapshot(doc(db, "hubNotes", uid, "settings", "vault"), (snap) => {
      setVaultSettings(snap.exists() ? (snap.data() as NotesVaultSettings) : null);
    });
    return unsub;
  }, [uid, dataUid]);

  useEffect(() => {
    if (!dataUid) return;
    const incoming = query(collection(db, "noteGrants"), where("targetUid", "==", dataUid));
    const outgoing = query(collection(db, "noteGrants"), where("ownerId", "==", dataUid));
    const unsubIn = onSnapshot(incoming, (snap) => {
      setGrants(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NoteGrant, "id">) })));
    });
    const unsubOut = onSnapshot(outgoing, (snap) => {
      setOutgoingGrants(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NoteGrant, "id">) })));
    });
    return () => {
      unsubIn();
      unsubOut();
    };
  }, [dataUid]);

  useEffect(() => {
    if (!grants.length) {
      setSharedNotes([]);
      setSharedFolders([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const noteDocs: HubNote[] = [];
      const folderDocs: NoteFolder[] = [];
      for (const g of grants) {
        try {
          if (g.noteId) {
            const snap = await getDoc(doc(db, "hubNotes", g.ownerId, "items", g.noteId));
            if (snap.exists()) noteDocs.push(mapNote(snap.id, g.ownerId, snap.data() as Record<string, unknown>));
          }
          if (g.folderId) {
            const snap = await getDoc(doc(db, "hubNotes", g.ownerId, "folders", g.folderId));
            if (snap.exists()) folderDocs.push(mapFolder(snap.id, g.ownerId, snap.data() as Record<string, unknown>));
          }
        } catch {
          /* grant may be stale */
        }
      }
      if (!cancelled) {
        setSharedNotes(noteDocs);
        setSharedFolders(folderDocs);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [grants]);

  const subscribeVault = useCallback(() => {
    if (!uid || uid !== dataUid) return () => {};
    setVaultSubscribed(true);
    const unsub = onSnapshot(collection(db, "hubNotes", uid, "vault"), (snap) => {
      setVaultNotes(snap.docs.map((d) => mapNote(d.id, uid, { ...d.data(), vault: true })));
    });
    return unsub;
  }, [uid, dataUid]);

  const unsubscribeVault = useCallback(() => {
    setVaultSubscribed(false);
    setVaultNotes([]);
  }, []);

  const savePrefs = useCallback(async (patch: Partial<NotesPrefs>) => {
    if (!uid) return;
    const next = { ...prefs, ...patch };
    await setDoc(doc(db, "hubNotes", uid, "settings", "prefs"), { ...next, updatedAt: serverTimestamp() }, { merge: true });
    setPrefs(next);
  }, [uid, prefs]);

  const saveVaultSettings = useCallback(async (settings: NotesVaultSettings) => {
    if (!uid) return;
    await setDoc(doc(db, "hubNotes", uid, "settings", "vault"), { ...settings, updatedAt: serverTimestamp() }, { merge: true });
    setVaultSettings(settings);
  }, [uid]);

  const addFolder = useCallback(async (name: string, color = "default") => {
    if (!uid) return;
    await addDoc(collection(db, "hubNotes", uid, "folders"), {
      name,
      color,
      sortOrder: folders.length,
      sharedWith: [],
      createdAt: serverTimestamp(),
    });
  }, [uid, folders.length]);

  const updateFolder = useCallback(async (id: string, data: Partial<NoteFolder>) => {
    if (!uid) return;
    const { id: _id, ownerId: _o, ...rest } = data as NoteFolder;
    await updateDoc(doc(db, "hubNotes", uid, "folders", id), rest);
  }, [uid]);

  const deleteFolder = useCallback(async (id: string) => {
    if (!uid) return;
    const inFolder = notes.filter((n) => n.folderId === id);
    await Promise.all(inFolder.map((n) => updateDoc(doc(db, "hubNotes", uid, "items", n.id), { folderId: null })));
    await deleteDoc(doc(db, "hubNotes", uid, "folders", id));
  }, [uid, notes]);

  const addNote = useCallback(async (input: Partial<HubNote> & { vault?: boolean }) => {
    if (!uid) return "";
    const folder = folders.find((f) => f.id === input.folderId);
    const payload = {
      folderId: input.folderId ?? null,
      kind: input.kind ?? "note",
      title: input.title ?? "",
      body: input.body ?? "",
      color: input.color ?? "default",
      pinned: !!input.pinned,
      archived: false,
      tags: input.tags ?? [],
      checklist: input.checklist ?? [],
      dueDate: input.dueDate ?? null,
      calendarEventId: input.calendarEventId ?? null,
      addToCalendar: !!input.addToCalendar,
      locked: !!input.locked,
      cipher: input.cipher ?? null,
      sharedWith: folder?.sharedWith ?? [],
      sharePermission: folder?.sharePermission ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    const col = input.vault ? "vault" : "items";
    const ref = await addDoc(collection(db, "hubNotes", uid, col), payload);
    return ref.id;
  }, [uid, folders]);

  const updateNote = useCallback(async (note: HubNote, data: Partial<HubNote>) => {
    const col = note.vault ? "vault" : "items";
    const rest: Record<string, unknown> = { ...data };
    delete rest.id;
    delete rest.ownerId;
    delete rest.vault;
    delete rest.createdAt;
    Object.keys(rest).forEach((key) => {
      if (rest[key] === undefined) delete rest[key];
    });
    await updateDoc(doc(db, "hubNotes", note.ownerId, col, note.id), {
      ...rest,
      updatedAt: serverTimestamp(),
    });
  }, []);

  const deleteNote = useCallback(async (note: HubNote) => {
    const col = note.vault ? "vault" : "items";
    await deleteDoc(doc(db, "hubNotes", note.ownerId, col, note.id));
  }, []);

  const moveNoteToVault = useCallback(async (note: HubNote) => {
    if (!uid || note.ownerId !== uid) return;
    const { id, ownerId, createdAt, ...rest } = note;
    await addDoc(collection(db, "hubNotes", uid, "vault"), {
      ...rest,
      vault: true,
      sharedWith: [],
      updatedAt: serverTimestamp(),
      createdAt: createdAt ?? serverTimestamp(),
    });
    await deleteDoc(doc(db, "hubNotes", uid, "items", note.id));
  }, [uid]);

  const moveNoteFromVault = useCallback(async (note: HubNote) => {
    if (!uid || note.ownerId !== uid) return;
    const { id, ownerId, createdAt, ...rest } = note;
    await addDoc(collection(db, "hubNotes", uid, "items"), {
      ...rest,
      vault: false,
      locked: false,
      cipher: null,
      updatedAt: serverTimestamp(),
      createdAt: createdAt ?? serverTimestamp(),
    });
    await deleteDoc(doc(db, "hubNotes", uid, "vault", note.id));
  }, [uid]);

  const findUserByEmail = useCallback((email: string) => {
    const wanted = email.trim().toLowerCase();
    return appUsers.find((u) => u.email.toLowerCase() === wanted);
  }, [appUsers]);

  const shareNote = useCallback(async (note: HubNote, email: string, permission: NoteSharePermission) => {
    if (!uid || note.ownerId !== uid) throw new Error("Only the owner can share this note");
    const target = findUserByEmail(email);
    if (!target) throw new Error("No Hardy Hub user with that email");
    if (target.id === uid) throw new Error("That's you");
    const sharedWith = Array.from(new Set([...(note.sharedWith ?? []), target.id]));
    await updateDoc(doc(db, "hubNotes", uid, "items", note.id), {
      sharedWith,
      sharePermission: permission,
      updatedAt: serverTimestamp(),
    });
    await addDoc(collection(db, "noteGrants"), {
      ownerId: uid,
      targetUid: target.id,
      permission,
      noteId: note.id,
      title: note.title || "Untitled note",
    });
  }, [uid, findUserByEmail]);

  const shareFolder = useCallback(async (folder: NoteFolder, email: string, permission: NoteSharePermission) => {
    if (!uid || folder.ownerId !== uid) throw new Error("Only the owner can share this folder");
    const target = findUserByEmail(email);
    if (!target) throw new Error("No Hardy Hub user with that email");
    if (target.id === uid) throw new Error("That's you");
    const sharedWith = Array.from(new Set([...(folder.sharedWith ?? []), target.id]));
    await updateDoc(doc(db, "hubNotes", uid, "folders", folder.id), {
      sharedWith,
      sharePermission: permission,
    });
    await addDoc(collection(db, "noteGrants"), {
      ownerId: uid,
      targetUid: target.id,
      permission,
      folderId: folder.id,
      title: folder.name,
    });
    const inFolder = notes.filter((n) => n.folderId === folder.id && n.ownerId === uid);
    await Promise.all(inFolder.map((n) => updateDoc(doc(db, "hubNotes", uid, "items", n.id), {
      sharedWith: Array.from(new Set([...(n.sharedWith ?? []), target.id])),
      sharePermission: permission,
    })));
  }, [uid, findUserByEmail, notes]);

  const unshareNote = useCallback(async (note: HubNote, targetUid: string) => {
    if (!uid) return;
    await updateDoc(doc(db, "hubNotes", uid, "items", note.id), {
      sharedWith: (note.sharedWith ?? []).filter((id) => id !== targetUid),
    });
    const match = outgoingGrants.find((g) => g.noteId === note.id && g.targetUid === targetUid);
    if (match) await deleteDoc(doc(db, "noteGrants", match.id));
  }, [uid, outgoingGrants]);

  const unshareFolder = useCallback(async (folder: NoteFolder, targetUid: string) => {
    if (!uid) return;
    await updateDoc(doc(db, "hubNotes", uid, "folders", folder.id), {
      sharedWith: (folder.sharedWith ?? []).filter((id) => id !== targetUid),
    });
    const match = outgoingGrants.find((g) => g.folderId === folder.id && g.targetUid === targetUid);
    if (match) await deleteDoc(doc(db, "noteGrants", match.id));
  }, [uid, outgoingGrants]);

  const datedNotes = useMemo(
    () => notes.filter((n) => n.dueDate && !n.archived),
    [notes]
  );

  const canEdit = uid === dataUid || sharedWithMe.some((s) => s.ownerId === uid && s.permission === "edit");

  return {
    folders,
    notes,
    vaultNotes,
    sharedNotes,
    sharedFolders,
    grants,
    prefs,
    vaultSettings,
    loading,
    vaultSubscribed,
    canEdit,
    uid,
    savePrefs,
    saveVaultSettings,
    addFolder,
    updateFolder,
    deleteFolder,
    addNote,
    updateNote,
    deleteNote,
    moveNoteToVault,
    moveNoteFromVault,
    shareNote,
    shareFolder,
    unshareNote,
    unshareFolder,
    subscribeVault,
    unsubscribeVault,
    datedNotes,
    newChecklistItem: (): NoteChecklistItem => ({ id: newId(), text: "", done: false }),
  };
}

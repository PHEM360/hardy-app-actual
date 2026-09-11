import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { formatUkNumber } from "@/lib/phoneNumbers";

export interface SoftphoneMessage {
  id: string;
  sid?: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  body: string;
  status?: string;
  createdAtIso?: string;
}

export interface SoftphoneCall {
  id: string;
  sid?: string;
  direction: "inbound" | "outbound";
  from: string;
  to: string;
  status?: string;
  via?: string;
  createdAtIso?: string;
}

export interface SoftphoneContact {
  id: string;
  name: string;
  number: string;
  favourite?: boolean;
}

export function useSoftphone() {
  const { dataUid } = useAuth();
  const [messages, setMessages] = useState<SoftphoneMessage[]>([]);
  const [calls, setCalls] = useState<SoftphoneCall[]>([]);
  const [contacts, setContacts] = useState<SoftphoneContact[]>([]);
  const [myMobile, setMyMobile] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) {
      setMessages([]);
      setCalls([]);
      setContacts([]);
      setLoading(false);
      return;
    }
    const unsubs = [
      onSnapshot(query(collection(db, `phone/${dataUid}/messages`), orderBy("createdAtIso", "desc")), (snap) => {
        setMessages(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SoftphoneMessage, "id">) })));
        setLoading(false);
      }, () => setLoading(false)),
      onSnapshot(query(collection(db, `phone/${dataUid}/calls`), orderBy("createdAtIso", "desc")), (snap) => {
        setCalls(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SoftphoneCall, "id">) })));
      }, () => undefined),
      onSnapshot(query(collection(db, `phone/${dataUid}/contacts`), orderBy("name", "asc")), (snap) => {
        setContacts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<SoftphoneContact, "id">) })));
      }, () => undefined),
      onSnapshot(doc(db, "phoneSettings", dataUid), (snap) => {
        setMyMobile(String(snap.data()?.myMobile || ""));
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [dataUid]);

  const saveMobile = async (number: string) => {
    if (!dataUid) return;
    await setDoc(doc(db, "phoneSettings", dataUid), { myMobile: formatUkNumber(number), updatedAt: serverTimestamp() }, { merge: true });
  };

  const addContact = async (name: string, number: string) => {
    if (!dataUid) return;
    await addDoc(collection(db, `phone/${dataUid}/contacts`), {
      name: name.trim(),
      number: formatUkNumber(number),
      createdAt: serverTimestamp(),
    });
  };

  const removeContact = async (id: string) => {
    if (!dataUid) return;
    await deleteDoc(doc(db, `phone/${dataUid}/contacts`, id));
  };

  const recordLocalCall = async (entry: Omit<SoftphoneCall, "id">) => {
    if (!dataUid) return;
    await addDoc(collection(db, `phone/${dataUid}/calls`), {
      ...entry,
      createdAt: serverTimestamp(),
      createdAtIso: entry.createdAtIso || new Date().toISOString(),
      ownerUid: dataUid,
    });
  };

  const threads = useMemo(() => {
    const map = new Map<string, SoftphoneMessage[]>();
    for (const message of messages) {
      const other = message.direction === "inbound" ? message.from : message.to;
      const key = formatUkNumber(other) || other;
      const list = map.get(key) || [];
      list.push(message);
      map.set(key, list);
    }
    return [...map.entries()].map(([number, items]) => ({
      number,
      items: [...items].sort((a, b) => String(a.createdAtIso).localeCompare(String(b.createdAtIso))),
      last: items[0],
    }));
  }, [messages]);

  return { messages, calls, contacts, threads, myMobile, loading, saveMobile, addContact, removeContact, recordLocalCall };
}

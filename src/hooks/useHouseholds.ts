import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
  setDoc,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export interface Household {
  id: string;
  name: string;
  createdBy: string;
  memberIds: string[];
}

/** Live list of every household the current user belongs to. */
export function useMyHouseholds() {
  const { dataUid } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) {
      setHouseholds([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "households"), where("memberIds", "array-contains", dataUid));
    const unsub = onSnapshot(q, (snap) => {
      setHouseholds(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? d.id,
          createdBy: d.data().createdBy ?? "",
          memberIds: Array.isArray(d.data().memberIds) ? d.data().memberIds : [],
        }))
      );
      setLoading(false);
    }, () => {
      setHouseholds([]);
      setLoading(false);
    });

    return unsub;
  }, [dataUid]);

  return { households, loading };
}

/** Admin-only: every household in the system (rules restrict this query to admins). */
export function useAllHouseholds() {
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "households"), (snap) => {
      setHouseholds(
        snap.docs.map((d) => ({
          id: d.id,
          name: d.data().name ?? d.id,
          createdBy: d.data().createdBy ?? "",
          memberIds: Array.isArray(d.data().memberIds) ? d.data().memberIds : [],
        }))
      );
      setLoading(false);
    }, () => {
      setHouseholds([]);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { households, loading };
}

const HOUSEHOLD_DATA_SUBCOLS = [
  "items",
  "settings",
  "documents",
  "photos",
  "financeAccounts",
  "financeEntries",
] as const;

async function copySubcollection(fromCol: ReturnType<typeof collection>, toCol: ReturnType<typeof collection>) {
  const snap = await getDocs(fromCol);
  if (snap.empty) return;
  const CHUNK = 400;
  for (let i = 0; i < snap.docs.length; i += CHUNK) {
    const batch = writeBatch(db);
    for (const d of snap.docs.slice(i, i + CHUNK)) {
      batch.set(doc(toCol, d.id), d.data());
    }
    await batch.commit();
  }
}

/** Move solo/legacy household data onto a newly created shared household. */
async function migrateHouseholdData(fromId: string, toId: string) {
  if (!fromId || fromId === toId) return;
  for (const sub of HOUSEHOLD_DATA_SUBCOLS) {
    await copySubcollection(
      collection(db, "household", fromId, sub),
      collection(db, "household", toId, sub)
    );
  }
  await copySubcollection(
    collection(db, "cameras", fromId, "list"),
    collection(db, "cameras", toId, "list")
  );
}

async function findUserIdByEmail(email: string): Promise<string> {
  const trimmed = email.trim();
  const lower = trimmed.toLowerCase();
  const candidates = Array.from(new Set([lower, trimmed]));
  for (const value of candidates) {
    const snap = await getDocs(query(collection(db, "users"), where("email", "==", value)));
    if (!snap.empty) return snap.docs[0].id;
  }
  throw new Error("No app user found with that email. They need to sign up first.");
}

export function useHouseholds() {
  const { dataUid } = useAuth();

  const createHousehold = useCallback(
    async (name: string) => {
      if (!dataUid || !name.trim()) return;
      const existing = await getDocs(
        query(collection(db, "households"), where("memberIds", "array-contains", dataUid))
      );
      const isFirstHousehold = existing.empty;

      const ref = await addDoc(collection(db, "households"), {
        name: name.trim(),
        createdBy: dataUid,
        memberIds: [dataUid],
        createdAt: serverTimestamp(),
      });

      // Own profile — so rules + Settings stay in sync with membership
      await setDoc(doc(db, "users", dataUid), {
        householdIds: arrayUnion(ref.id),
        householdId: ref.id,
      }, { merge: true }).catch(() => undefined);

      // First shared household: bring across data that was stored under the
      // user's uid (or a matching legacy name path) so the partner sees it.
      if (isFirstHousehold) {
        const sources = [dataUid];
        if (name.trim() && name.trim() !== dataUid) sources.push(name.trim());
        for (const src of sources) {
          try {
            await migrateHouseholdData(src, ref.id);
          } catch {
            // Ignore missing/unreadable legacy paths
          }
        }
      }

      return ref.id;
    },
    [dataUid]
  );

  const renameHousehold = useCallback(async (householdId: string, name: string) => {
    if (!name.trim()) return;
    await updateDoc(doc(db, "households", householdId), { name: name.trim() });
  }, []);

  const addHouseholdMember = useCallback(async (householdId: string, email: string) => {
    const targetUid = await findUserIdByEmail(email);
    await updateDoc(doc(db, "households", householdId), {
      memberIds: arrayUnion(targetUid),
    });
    await setDoc(doc(db, "users", targetUid), {
      householdIds: arrayUnion(householdId),
    }, { merge: true }).catch(() => undefined);
    return targetUid;
  }, []);

  const removeHouseholdMember = useCallback(async (householdId: string, targetUid: string) => {
    await updateDoc(doc(db, "households", householdId), {
      memberIds: arrayRemove(targetUid),
    });
  }, []);

  /** Add a known uid directly (no email lookup) — used by Admin. */
  const addHouseholdMemberById = useCallback(async (householdId: string, targetUid: string) => {
    await updateDoc(doc(db, "households", householdId), {
      memberIds: arrayUnion(targetUid),
    });
    await setDoc(doc(db, "users", targetUid), {
      householdIds: arrayUnion(householdId),
    }, { merge: true }).catch(() => undefined);
  }, []);

  /** Admin-only: create a household on behalf of a user who isn't the caller. */
  const createHouseholdFor = useCallback(async (name: string, targetUid: string) => {
    if (!name.trim()) return;
    const ref = await addDoc(collection(db, "households"), {
      name: name.trim(),
      createdBy: targetUid,
      memberIds: [targetUid],
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, "users", targetUid), {
      householdIds: arrayUnion(ref.id),
      householdId: ref.id,
    }, { merge: true }).catch(() => undefined);
    return ref.id;
  }, []);

  const deleteHousehold = useCallback(async (householdId: string) => {
    await deleteDoc(doc(db, "households", householdId));
  }, []);

  return {
    createHousehold,
    createHouseholdFor,
    renameHousehold,
    addHouseholdMember,
    addHouseholdMemberById,
    removeHouseholdMember,
    deleteHousehold,
  };
}

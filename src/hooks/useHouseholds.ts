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
  const { user } = useAuth();
  const [households, setHouseholds] = useState<Household[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setHouseholds([]);
      setLoading(false);
      return;
    }

    const q = query(collection(db, "households"), where("memberIds", "array-contains", user.uid));
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
  }, [user]);

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

export function useHouseholds() {
  const { user } = useAuth();

  const createHousehold = useCallback(
    async (name: string) => {
      if (!user || !name.trim()) return;
      const ref = await addDoc(collection(db, "households"), {
        name: name.trim(),
        createdBy: user.uid,
        memberIds: [user.uid],
        createdAt: serverTimestamp(),
      });
      return ref.id;
    },
    [user]
  );

  const renameHousehold = useCallback(async (householdId: string, name: string) => {
    if (!name.trim()) return;
    await updateDoc(doc(db, "households", householdId), { name: name.trim() });
  }, []);

  const addHouseholdMember = useCallback(async (householdId: string, email: string) => {
    const usersQ = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
    const snap = await getDocs(usersQ);
    if (snap.empty) {
      throw new Error("No app user found with that email.");
    }
    const targetUid = snap.docs[0].id;
    await updateDoc(doc(db, "households", householdId), {
      memberIds: arrayUnion(targetUid),
    });
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

import { useEffect, useState, useCallback } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export type SharePermission = "view" | "edit";

export interface PageShare {
  id: string;
  ownerId: string;
  targetUid: string;
  page: string;
  permission: SharePermission;
}

function shareDocId(ownerId: string, page: string, targetUid: string) {
  return `${ownerId}_${page}_${targetUid}`;
}

function toShare(d: { id: string; data: () => any }): PageShare {
  const data = d.data();
  return {
    id: d.id,
    ownerId: data.ownerId,
    targetUid: data.targetUid,
    page: data.page,
    permission: data.permission === "edit" ? "edit" : "view",
  };
}

/**
 * Manages sharing of one page (e.g. "finance", "tasks") between the current
 * user and other app users. `mine` = grants I've made on this page,
 * `sharedWithMe` = grants other owners have made to me on this page.
 */
export function usePageShares(page: string) {
  const { dataUid } = useAuth();
  const [mine, setMine] = useState<PageShare[]>([]);
  const [sharedWithMe, setSharedWithMe] = useState<PageShare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!dataUid) {
      setMine([]);
      setSharedWithMe([]);
      setLoading(false);
      return;
    }

    let mineLoaded = false;
    let sharedLoaded = false;
    const checkLoaded = () => {
      if (mineLoaded && sharedLoaded) setLoading(false);
    };

    const mineQ = query(
      collection(db, "pageShares"),
      where("ownerId", "==", dataUid),
      where("page", "==", page)
    );
    const unsubMine = onSnapshot(mineQ, (snap) => {
      setMine(snap.docs.map(toShare));
      mineLoaded = true;
      checkLoaded();
    });

    const sharedQ = query(
      collection(db, "pageShares"),
      where("targetUid", "==", dataUid),
      where("page", "==", page)
    );
    const unsubShared = onSnapshot(sharedQ, (snap) => {
      setSharedWithMe(snap.docs.map(toShare));
      sharedLoaded = true;
      checkLoaded();
    });

    return () => {
      unsubMine();
      unsubShared();
    };
  }, [dataUid, page]);

  const share = useCallback(
    async (email: string, permission: SharePermission) => {
      if (!dataUid) return;
      const usersQ = query(collection(db, "users"), where("email", "==", email.trim().toLowerCase()));
      const snap = await getDocs(usersQ);
      if (snap.empty) {
        throw new Error("No app user found with that email.");
      }
      const targetUid = snap.docs[0].id;
      if (targetUid === dataUid) {
        throw new Error("You already have access to your own page.");
      }
      const id = shareDocId(dataUid, page, targetUid);
      await setDoc(doc(db, "pageShares", id), {
        ownerId: dataUid,
        targetUid,
        page,
        permission,
        createdAt: serverTimestamp(),
      });
      return targetUid;
    },
    [dataUid, page]
  );

  const updatePermission = useCallback(
    async (targetUid: string, permission: SharePermission) => {
      if (!dataUid) return;
      const id = shareDocId(dataUid, page, targetUid);
      await setDoc(doc(db, "pageShares", id), { permission }, { merge: true });
    },
    [dataUid, page]
  );

  const revoke = useCallback(
    async (targetUid: string) => {
      if (!dataUid) return;
      await deleteDoc(doc(db, "pageShares", shareDocId(dataUid, page, targetUid)));
    },
    [dataUid, page]
  );

  return { mine, sharedWithMe, loading, share, updatePermission, revoke };
}

/** Admin-only: revoke any page share by its doc id, regardless of owner. */
export async function revokePageShareById(shareId: string) {
  await deleteDoc(doc(db, "pageShares", shareId));
}

/** Admin-only: every page share in the system (rules restrict this query to admins). */
export function useAllPageShares() {
  const [shares, setShares] = useState<PageShare[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "pageShares"), (snap) => {
      setShares(snap.docs.map(toShare));
      setLoading(false);
    }, () => {
      setShares([]);
      setLoading(false);
    });
    return unsub;
  }, []);

  return { shares, loading };
}

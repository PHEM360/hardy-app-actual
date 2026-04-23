import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  addDoc,
  updateDoc,
  query,
  orderBy,
  where,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export interface TreatmentOption {
  id: string;
  product: string;
  frequencyDays: number;
}

export interface TreatmentRecord {
  id: string;
  type: "flea" | "worming" | "vaccination";
  name: string;
  dateDue: string;
  dateGiven: string;
}

export interface NotificationSetting {
  id: string;
  daysBeforeDue: number;
}

export interface PetInsurance {
  provider: string;
  policyNumber: string;
  renewalDate: string;
  monthlyPremium: number;
  coverLevel: string;
  excess: number;
}

export interface Pet {
  id: string;
  name: string;
  breed: string;
  birthday: string;
  avatar: string;
  ownerId: string;
  sharedWith: string[];
  fleaOptions: TreatmentOption[];
  wormOptions: TreatmentOption[];
  selectedFlea: string;
  selectedWorm: string;
  treatmentNotes: string;
  weightHistory: { date: string; weight: number }[];
  treatmentHistory: TreatmentRecord[];
  fleaNotifications: NotificationSetting[];
  wormNotifications: NotificationSetting[];
  insurance: PetInsurance;
}

const DEFAULT_INSURANCE: PetInsurance = {
  provider: "",
  policyNumber: "",
  renewalDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    .toISOString()
    .split("T")[0],
  monthlyPremium: 0,
  coverLevel: "",
  excess: 0,
};

export function usePets() {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPets([]);
      setLoading(false);
      return;
    }

    // Listen to pets owned by user
    const ownedQ = query(collection(db, "pets"), where("ownerId", "==", user.uid), orderBy("name"));
    // Listen to pets shared with user
    const sharedQ = query(collection(db, "pets"), where("sharedWith", "array-contains", user.uid), orderBy("name"));

    const petsMap = new Map<string, Pet>();

    const toTyped = (d: any): Pet => ({
      id: d.id,
      name: d.data().name ?? "",
      breed: d.data().breed ?? "",
      birthday: d.data().birthday ?? "",
      avatar: d.data().avatar ?? "🐶",
      ownerId: d.data().ownerId ?? "",
      sharedWith: d.data().sharedWith ?? [],
      fleaOptions: d.data().fleaOptions ?? [],
      wormOptions: d.data().wormOptions ?? [],
      selectedFlea: d.data().selectedFlea ?? "",
      selectedWorm: d.data().selectedWorm ?? "",
      treatmentNotes: d.data().treatmentNotes ?? "",
      weightHistory: d.data().weightHistory ?? [],
      treatmentHistory: d.data().treatmentHistory ?? [],
      fleaNotifications: d.data().fleaNotifications ?? [],
      wormNotifications: d.data().wormNotifications ?? [],
      insurance: d.data().insurance ?? DEFAULT_INSURANCE,
    });

    const merge = () => {
      setPets([...petsMap.values()].sort((a, b) => a.name.localeCompare(b.name)));
      setLoading(false);
    };

    let ownedReady = false, sharedReady = false;

    const unsubOwned = onSnapshot(ownedQ, (snap) => {
      snap.docs.forEach(d => petsMap.set(d.id, toTyped(d)));
      // Remove docs that are no longer in owned set
      snap.docChanges().filter(c => c.type === "removed").forEach(c => {
        if (petsMap.get(c.doc.id)?.ownerId === user.uid) petsMap.delete(c.doc.id);
      });
      ownedReady = true;
      if (sharedReady) merge();
    }, () => { ownedReady = true; if (sharedReady) merge(); });

    const unsubShared = onSnapshot(sharedQ, (snap) => {
      snap.docs.forEach(d => petsMap.set(d.id, toTyped(d)));
      snap.docChanges().filter(c => c.type === "removed").forEach(c => {
        if (petsMap.get(c.doc.id)?.ownerId !== user.uid) petsMap.delete(c.doc.id);
      });
      sharedReady = true;
      if (ownedReady) merge();
    }, () => { sharedReady = true; if (ownedReady) merge(); });

    return () => { unsubOwned(); unsubShared(); };
  }, [user]);

  const addPet = useCallback(
    async (pet: Omit<Pet, "id" | "ownerId" | "sharedWith">) => {
      if (!user) return;
      await addDoc(collection(db, "pets"), {
        ...pet,
        ownerId: user.uid,
        sharedWith: [],
        createdAt: serverTimestamp(),
      });
    },
    [user]
  );

  const sharePet = useCallback(
    async (petId: string, targetUid: string) => {
      await updateDoc(doc(db, "pets", petId), {
        sharedWith: arrayUnion(targetUid),
      });
    },
    []
  );

  const updatePet = useCallback(async (petId: string, updates: Partial<Pet>) => {
    await updateDoc(doc(db, "pets", petId), updates as any);
  }, []);

  const addWeightEntry = useCallback(
    async (petId: string, entry: { date: string; weight: number }) => {
      const pet = pets.find((p) => p.id === petId);
      if (!pet) return;
      const updated = [...pet.weightHistory, entry].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      await updateDoc(doc(db, "pets", petId), { weightHistory: updated });
    },
    [pets]
  );

  const addTreatmentRecord = useCallback(
    async (petId: string, record: TreatmentRecord) => {
      const pet = pets.find((p) => p.id === petId);
      if (!pet) return;
      const updated = [record, ...pet.treatmentHistory];
      await updateDoc(doc(db, "pets", petId), { treatmentHistory: updated });
    },
    [pets]
  );

  return { pets, loading, addPet, updatePet, addWeightEntry, addTreatmentRecord, sharePet };
}

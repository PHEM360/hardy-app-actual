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
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import { is35PfpHousehold } from "@/lib/householdIds";

export interface TreatmentOption {
  id: string;
  product: string;
  frequencyDays: number;
}

export interface VaccinationOption {
  id: string;
  name: string;           // e.g. "Annual Booster", "Kennel Cough"
  frequencyMonths: number; // e.g. 12
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
  vaccinationOptions: VaccinationOption[];
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

export function usePets(scopeUserId?: string) {
  const { dataUid } = useAuth();
  const { availableHouseholds } = useActiveHousehold();
  const uid = scopeUserId ?? dataUid;
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const allowLegacy35Pfp = availableHouseholds.some((h) => is35PfpHousehold(h.name));

  useEffect(() => {
    if (!uid) {
      setPets([]);
      setLoading(false);
      return;
    }

    // Query all pets — filter client-side so legacy pets (no ownerId) remain visible
    // and new pets are scoped to owner + sharedWith
    const allQ = query(collection(db, "pets"), orderBy("name"));

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
      vaccinationOptions: d.data().vaccinationOptions ?? [],
      selectedFlea: d.data().selectedFlea ?? "",
      selectedWorm: d.data().selectedWorm ?? "",
      treatmentNotes: d.data().treatmentNotes ?? "",
      weightHistory: d.data().weightHistory ?? [],
      treatmentHistory: d.data().treatmentHistory ?? [],
      fleaNotifications: d.data().fleaNotifications ?? [],
      wormNotifications: d.data().wormNotifications ?? [],
      insurance: d.data().insurance ?? DEFAULT_INSURANCE,
    });

    const unsub = onSnapshot(allQ, (snap) => {
      const next = snap.docs
        .map(toTyped)
        .filter((p) => {
          const viewingOwn = !scopeUserId || scopeUserId === dataUid;
          if (!p.ownerId) return viewingOwn && allowLegacy35Pfp;
          if (p.ownerId === uid) return true;
          if (viewingOwn && dataUid && p.sharedWith.includes(dataUid)) return true;
          return false;
        });
      setPets(next);
      setLoading(false);
    }, () => {
      setPets([]);
      setLoading(false);
    });

    return () => unsub();
  }, [uid, dataUid, allowLegacy35Pfp, scopeUserId]);

  const addPet = useCallback(
    async (pet: Omit<Pet, "id" | "ownerId" | "sharedWith">) => {
      if (!dataUid) return;
      await addDoc(collection(db, "pets"), {
        ...pet,
        ownerId: dataUid,
        sharedWith: [],
        createdAt: serverTimestamp(),
      });
    },
    [dataUid]
  );

  const sharePet = useCallback(
    async (petId: string, targetUid: string) => {
      await updateDoc(doc(db, "pets", petId), {
        sharedWith: arrayUnion(targetUid),
      });
    },
    []
  );

  const unsharePet = useCallback(
    async (petId: string, targetUid: string) => {
      await updateDoc(doc(db, "pets", petId), {
        sharedWith: arrayRemove(targetUid),
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

  return { pets, loading, addPet, updatePet, addWeightEntry, addTreatmentRecord, sharePet, unsharePet };
}

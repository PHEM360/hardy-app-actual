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
} from "firebase/firestore";
import { db } from "@/lib/firebase";

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
  const [pets, setPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "pets"), orderBy("name"));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const next = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data.name ?? "",
            breed: data.breed ?? "",
            birthday: data.birthday ?? "",
            avatar: data.avatar ?? "🐶",
            fleaOptions: data.fleaOptions ?? [],
            wormOptions: data.wormOptions ?? [],
            selectedFlea: data.selectedFlea ?? "",
            selectedWorm: data.selectedWorm ?? "",
            treatmentNotes: data.treatmentNotes ?? "",
            weightHistory: data.weightHistory ?? [],
            treatmentHistory: data.treatmentHistory ?? [],
            fleaNotifications: data.fleaNotifications ?? [],
            wormNotifications: data.wormNotifications ?? [],
            insurance: data.insurance ?? DEFAULT_INSURANCE,
          } as Pet;
        });
        setPets(next);
        setLoading(false);
      },
      () => {
        setPets([]);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const addPet = useCallback(
    async (pet: Omit<Pet, "id">) => {
      await addDoc(collection(db, "pets"), {
        ...pet,
        createdAt: serverTimestamp(),
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

  return { pets, loading, addPet, updatePet, addWeightEntry, addTreatmentRecord };
}

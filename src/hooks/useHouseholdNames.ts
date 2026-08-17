import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Returns a sorted list of all distinct household names in use across all users. */
export function useHouseholdNames(): string[] {
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    return onSnapshot(
      collection(db, "users"),
      (snap) => {
        const all = new Set<string>();
        snap.docs.forEach((d) => {
          const data = d.data() as any;
          if (data.householdId && typeof data.householdId === "string") {
            all.add(data.householdId);
          }
          if (Array.isArray(data.householdIds)) {
            data.householdIds.forEach((n: unknown) => {
              if (typeof n === "string" && n.trim()) all.add(n.trim());
            });
          }
        });
        setNames(Array.from(all).sort());
      },
      () => setNames([])
    );
  }, []);

  return names;
}

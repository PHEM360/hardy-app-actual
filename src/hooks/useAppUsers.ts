import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "@/lib/firebase";

export interface AppUser {
  id: string;
  name: string;
  email: string;
}

/**
 * Lightweight directory of family members for share pickers.
 * Reads userDirectory (name + email only), not the privileged users collection.
 */
export function useAppUsers(): AppUser[] {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    // Ensure this device's own card exists after the directory migration.
    void httpsCallable(functions, "syncMyUserDirectory")({}).catch(() => undefined);

    return onSnapshot(
      collection(db, "userDirectory"),
      (snap) => {
        setUsers(
          snap.docs
            .map((d) => {
              const data = d.data() as { displayName?: string; email?: string };
              const name = (data.displayName || data.email || d.id).trim();
              return { id: d.id, name, email: data.email || "" };
            })
            .filter((u) => u.name)
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
      },
      () => setUsers([]),
    );
  }, []);

  return users;
}

import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AppUser {
  id: string;
  name: string;
  email: string;
}

/** Returns all registered app users from the Firestore users collection. */
export function useAppUsers(): AppUser[] {
  const [users, setUsers] = useState<AppUser[]>([]);

  useEffect(() => {
    return onSnapshot(collection(db, "users"), (snap) => {
      setUsers(
        snap.docs
          .map((d) => {
            const data = d.data() as any;
            const name = (
              data.displayName ||
              `${data.firstName || ""} ${data.surname || ""}`.trim() ||
              data.email ||
              d.id
            ).trim();
            return { id: d.id, name, email: data.email || "" };
          })
          .filter((u) => u.name)
          .sort((a, b) => a.name.localeCompare(b.name))
      );
    });
  }, []);

  return users;
}

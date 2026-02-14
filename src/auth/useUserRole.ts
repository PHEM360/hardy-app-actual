import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/auth/AuthContext";

export type UserRole = "superadmin" | "admin" | "member";

function normalizeRole(role: unknown): UserRole {
  const raw = String(role || "").toLowerCase();
  const normalized = raw.replace(/\s+/g, "").replace(/-/g, "");
  if (normalized === "superadmin") return "superadmin";
  if (normalized === "admin") return "admin";
  return "member";
}

export function useUserRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<UserRole>("member");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setRole("member");
      setLoading(false);
      return;
    }

    setLoading(true);
    const ref = doc(db, "users", user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        const data = snap.data() as any;
        // Support both styles: role string or legacy booleans
        if (data?.isSuperAdmin === true) {
          setRole("superadmin");
        } else if (data?.isAdmin === true) {
          setRole("admin");
        } else {
          setRole(normalizeRole(data?.role));
        }
        setLoading(false);
      },
      () => {
        // If we can't read role doc (rules), fall back to member.
        setRole("member");
        setLoading(false);
      }
    );

    return () => unsub();
  }, [user?.uid]);

  return { role, loading };
}

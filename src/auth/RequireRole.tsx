import { Navigate, useLocation } from "react-router-dom";
import DogLoader from "@/components/DogLoader";
import { useAuth } from "@/auth/AuthContext";
import { useUserRole, type UserRole } from "@/auth/useUserRole";

const ROLE_ORDER: Record<UserRole, number> = {
  member: 0,
  admin: 1,
  superadmin: 2,
};

export default function RequireRole({
  minRole,
  children,
}: {
  minRole: UserRole;
  children: React.ReactNode;
}) {
  const { user, initializing } = useAuth();
  const { role, loading } = useUserRole();
  const location = useLocation();

  if (initializing || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <DogLoader text="Checking access…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (ROLE_ORDER[role] < ROLE_ORDER[minRole]) {
    // Important: redirect without ever rendering the protected page content.
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

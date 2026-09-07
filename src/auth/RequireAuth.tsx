import { Navigate, useLocation } from "react-router-dom";
import DogLoader from "@/components/DogLoader";
import { useAuth } from "./AuthContext";

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <DogLoader fullPage text="Checking login…" />;
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  }

  return <>{children}</>;
}

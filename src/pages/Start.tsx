import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import DogLoader from "@/components/DogLoader";
import { useUserProfile } from "@/hooks/useUserProfile";
import { resolveLandingPath } from "@/lib/defaultLanding";

/**
 * Post-login bounce route. Sends the user to their saved default page
 * (or /dashboard so DefaultLandingGate can ask on first run).
 */
export default function Start() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading } = useUserProfile();

  useEffect(() => {
    if (loading) return;
    const from = (location.state as { from?: string } | null)?.from;
    if (from && from.startsWith("/") && !from.startsWith("//") && from !== "/start") {
      navigate(from, { replace: true });
      return;
    }
    if (!profile?.hasChosenDefaultLanding) {
      navigate("/dashboard", { replace: true });
      return;
    }
    navigate(resolveLandingPath(profile.defaultLandingPath), { replace: true });
  }, [loading, profile, navigate, location.state]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-hero">
      <DogLoader text="Opening Hardy Hub…" />
    </div>
  );
}

import { Navigate, useLocation } from "react-router-dom";
import DogLoader from "@/components/DogLoader";
import { useAuth } from "@/auth/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { FEATURE_PAGE_SHARE, hasFeatureAccess } from "@/lib/features";
import { useIncomingPageShares } from "@/hooks/usePageShares";
import type { FeatureKey } from "@/types/app";

export default function RequireFeature({
  featureKey,
  children,
}: {
  featureKey: FeatureKey;
  children: React.ReactNode;
}) {
  const { user, initializing } = useAuth();
  const { profile, loading } = useUserProfile();
  const { pages: sharedPages, loading: sharesLoading } = useIncomingPageShares();
  const location = useLocation();

  if (initializing || loading || sharesLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <DogLoader text="Checking access…" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  const hasOwnAccess = profile && hasFeatureAccess(profile.role, profile.enabledFeatures, featureKey);
  const sharedPage = FEATURE_PAGE_SHARE[featureKey];
  const hasSharedAccess = !!sharedPage && sharedPages.has(sharedPage);
  if (!hasOwnAccess && !hasSharedAccess) {
    // Important: redirect without ever rendering the protected page content.
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

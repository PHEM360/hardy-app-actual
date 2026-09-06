import { useMemo } from "react";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useIncomingPageShares } from "@/hooks/usePageShares";
import { canAccessRoute } from "@/lib/features";
import {
  LANDING_PAGE_OPTIONS,
  type LandingPageOption,
  resolveLandingPath,
} from "@/lib/defaultLanding";

/** Pages the signed-in user may choose as their post-login landing page. */
export function useAccessibleLandingPages(): {
  options: LandingPageOption[];
  loading: boolean;
  currentPath: string;
} {
  const { role, loading: roleLoading } = useEffectiveRole();
  const { profile, loading: profileLoading } = useUserProfile();
  const { pages: sharedPages, loading: sharesLoading } = useIncomingPageShares();

  const options = useMemo(() => {
    if (roleLoading || profileLoading || sharesLoading) return [];
    const features = profile?.enabledFeatures ?? [];
    return LANDING_PAGE_OPTIONS.filter((opt) => {
      if (opt.always) return true;
      return canAccessRoute(role, features, opt.path, sharedPages);
    });
  }, [role, roleLoading, profile, profileLoading, sharedPages, sharesLoading]);

  return {
    options,
    loading: roleLoading || profileLoading || sharesLoading,
    currentPath: resolveLandingPath(profile?.defaultLandingPath),
  };
}

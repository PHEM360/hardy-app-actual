import { useAuth } from "@/auth/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useUserRole, type UserRole } from "@/auth/useUserRole";

/** Role used for nav / feature gating. Follows the impersonated user when viewing as. */
export function useEffectiveRole() {
  const { viewAs } = useAuth();
  const { role: realRole, loading: roleLoading } = useUserRole();
  const { profile, loading: profileLoading } = useUserProfile();

  if (viewAs) {
    return { role: (profile?.role ?? "member") as UserRole, loading: profileLoading, isViewAs: true };
  }
  return { role: realRole, loading: roleLoading, isViewAs: false };
}

import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAccessibleLandingPages } from "@/hooks/useAccessibleLandingPages";
import { DefaultLandingChooser } from "@/components/home/DefaultLandingChooser";
import { resolveLandingPath } from "@/lib/defaultLanding";

/**
 * On first login (or until the user picks a default), show a full-screen chooser
 * for the post-login landing page. Home layout (Today vs Tiles) is asked separately
 * when they land on Home without a homeLayout yet.
 */
export function DefaultLandingGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { profile, loading, saveProfile } = useUserProfile();
  const { options, loading: optionsLoading } = useAccessibleLandingPages();

  const choose = async (path: string) => {
    const landing = resolveLandingPath(path);
    await saveProfile({
      defaultLandingPath: landing,
      hasChosenDefaultLanding: true,
    });
    navigate(landing, { replace: true });
  };

  if (loading || optionsLoading) return <>{children}</>;
  if (profile?.hasChosenDefaultLanding) return <>{children}</>;
  if (!options.length) return <>{children}</>;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-gradient-hero px-4 py-8">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-card p-6 shadow-elevated">
        <DefaultLandingChooser
          options={options}
          value={resolveLandingPath(profile?.defaultLandingPath)}
          onChoose={choose}
        />
      </div>
    </div>
  );
}

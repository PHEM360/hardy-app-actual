import type { ReactNode } from "react";
import { LayoutGrid } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { HomeLayoutChooser } from "@/components/home/HomeLayoutChooser";
import type { HomeLayoutMode } from "@/lib/homeLayout";

export function HomeLayoutGate({ children }: { children: ReactNode }) {
  const { profile, loading, saveProfile } = useUserProfile();

  const choose = async (mode: HomeLayoutMode) => {
    await saveProfile({ homeLayout: mode });
  };

  if (loading) return <>{children}</>;
  if (profile?.homeLayout) return <>{children}</>;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-gradient-hero px-4 py-8">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-white/20 bg-card p-6 shadow-elevated">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-lg">
          <LayoutGrid className="h-6 w-6" />
        </span>
        <HomeLayoutChooser onChoose={choose} />
      </div>
    </div>
  );
}

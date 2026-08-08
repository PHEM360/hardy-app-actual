import type { WidgetType } from "@/hooks/useDashboardLayout";
import { WidgetContent } from "@/components/widgets/WidgetContent";
import { useUserRole } from "@/auth/useUserRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { hasFeatureAccess, WIDGET_FEATURE_KEY } from "@/lib/features";

export function KioskWidgetGrid({ enabled }: { enabled: WidgetType[] }) {
  const { role, loading: roleLoading } = useUserRole();
  const { profile } = useUserProfile();

  const visible = enabled.filter((type) => {
    const key = WIDGET_FEATURE_KEY[type];
    if (!key) return true;
    if (roleLoading) return false;
    return hasFeatureAccess(role, profile?.enabledFeatures ?? [], key);
  });

  if (visible.length === 0) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <p className="text-white/40 text-sm">No widgets enabled — pick some in Display settings → Scenes.</p>
      </div>
    );
  }

  return (
    <div className="dark absolute inset-0 bg-zinc-950 px-10 py-10">
      <h1 className="text-3xl font-display font-bold text-white mb-6">Household overview</h1>
      <div className="grid grid-cols-3 gap-5 auto-rows-[180px] pointer-events-none">
        {visible.map((type) => (
          <div key={type} className="rounded-2xl bg-card border border-border/50 shadow-soft overflow-hidden">
            <WidgetContent type={type} />
          </div>
        ))}
      </div>
    </div>
  );
}

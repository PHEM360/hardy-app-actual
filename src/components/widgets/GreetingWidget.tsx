import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/auth/AuthContext";

export function GreetingWidget() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const name = profile?.displayName || profile?.firstName || user?.displayName || user?.email?.split("@")[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="w-full h-full p-4 flex flex-col justify-center bg-gradient-hero rounded-2xl">
      <p className="text-base font-bold font-display text-primary-foreground leading-tight">
        {greeting}, {name} 👋
      </p>
      <p className="text-xs text-primary-foreground/75 mt-1">{today}</p>
    </div>
  );
}

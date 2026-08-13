import { Sun, Sunset, Moon } from "lucide-react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/auth/AuthContext";

export function GreetingWidget() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const name = profile?.displayName || profile?.firstName || user?.displayName || user?.email?.split("@")[0] || "";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const Icon = hour < 12 ? Sun : hour < 18 ? Sunset : Moon;
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="relative w-full h-full p-4 flex items-center justify-between overflow-hidden bg-gradient-hero rounded-2xl">
      <div
        className="absolute -right-6 -top-8 w-28 h-28 rounded-full bg-gold/20 blur-2xl pointer-events-none"
        aria-hidden="true"
      />
      <div className="relative z-10 min-w-0">
        <p className="text-base font-bold font-display text-primary-foreground leading-tight truncate">
          {greeting}, {name}
        </p>
        <p className="text-xs text-primary-foreground/70 mt-1">{today}</p>
      </div>
      <span className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 flex-shrink-0 ml-3">
        <Icon className="w-5 h-5 text-gold" />
      </span>
    </div>
  );
}

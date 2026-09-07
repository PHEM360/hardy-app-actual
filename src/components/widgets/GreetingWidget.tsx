import { motion } from "framer-motion";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/auth/AuthContext";
import { useAppearance } from "@/hooks/useAppearance";
import { useDisplayWeather } from "@/hooks/useDisplayWeather";
import { useHeaderBackdrop } from "@/hooks/useHeaderBackdrop";
import { ChromeSceneLayer } from "@/components/chrome/ChromeSceneLayer";
import { ChromePhotoRotator } from "@/components/chrome/ChromePhotoRotator";
import { resolveChromeScene } from "@/lib/chromeScenes";

function firstNameOf(profileFirst: string | undefined, displayName: string | undefined, email: string | undefined) {
  const fromProfile = (profileFirst || "").trim();
  if (fromProfile) return fromProfile.split(/\s+/)[0];
  const fromDisplay = (displayName || "").trim().split(/\s+/)[0];
  if (fromDisplay) return fromDisplay;
  return (email || "").split("@")[0] || "";
}

export function GreetingWidget({ className }: { className?: string } = {}) {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const appearance = useAppearance();
  const { weather } = useDisplayWeather();
  const backdrop = useHeaderBackdrop();
  const matchHeader = appearance.greetingMatchHeader;
  const sceneId = matchHeader
    ? backdrop.scene
    : resolveChromeScene(appearance.greetingScene, {
      atmosphere: appearance.theme.atmosphere,
      isNight: new Date().getHours() >= 20 || new Date().getHours() < 6,
      fallback: "weather",
    });
  const color = matchHeader ? appearance.headerColor : appearance.greetingColor;
  const photoUrls = matchHeader
    ? backdrop.urls
    : appearance.greetingPhotoUrl
      ? [appearance.greetingPhotoUrl]
      : [];
  const firstName = firstNameOf(
    profile?.firstName,
    profile?.displayName || user?.displayName || "",
    user?.email || ""
  );
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const weatherLine = weather ? `${weather.temperature}° · ${weather.description}` : "";

  return (
    <div
      className={`relative w-full h-full p-4 flex items-center overflow-hidden rounded-2xl ${className ?? ""}`}
      style={{ background: color || "var(--gradient-hero)" }}
    >
      <ChromePhotoRotator urls={photoUrls} />
      <ChromeSceneLayer scene={sceneId} />
      <div className="relative z-10 min-w-0">
        <motion.p
          key={`${greeting}-${firstName}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="truncate font-display text-base font-bold leading-tight text-primary-foreground"
        >
          {firstName ? `${greeting} ${firstName}` : greeting}
        </motion.p>
        <p className="mt-1 text-xs text-primary-foreground/70">
          {today}{weatherLine ? ` · ${weatherLine}` : ""}{matchHeader && backdrop.eventLabel ? ` · ${backdrop.eventLabel}` : ""}
        </p>
      </div>
    </div>
  );
}

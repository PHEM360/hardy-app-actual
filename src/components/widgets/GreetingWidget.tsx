import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/auth/AuthContext";
import { useAppearance } from "@/hooks/useAppearance";
import { useDisplayWeather } from "@/hooks/useDisplayWeather";
import { ChromeSceneLayer } from "@/components/chrome/ChromeSceneLayer";
import { resolveChromeScene } from "@/lib/chromeScenes";

function firstNameOf(profileFirst: string | undefined, displayName: string | undefined, email: string | undefined) {
  const fromProfile = (profileFirst || "").trim();
  if (fromProfile) return fromProfile.split(/\s+/)[0];
  const fromDisplay = (displayName || "").trim().split(/\s+/)[0];
  if (fromDisplay) return fromDisplay;
  return (email || "").split("@")[0] || "";
}

export function GreetingWidget() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const appearance = useAppearance();
  const { weather } = useDisplayWeather();
  const matchHeader = appearance.greetingMatchHeader;
  const sceneId = resolveChromeScene(
    matchHeader ? appearance.headerScene : appearance.greetingScene,
    { atmosphere: appearance.theme.atmosphere, isNight: new Date().getHours() >= 20 || new Date().getHours() < 6, fallback: "weather" },
  );
  const color = matchHeader ? appearance.headerColor : appearance.greetingColor;
  const photoUrl = matchHeader ? appearance.headerPhotoUrl : appearance.greetingPhotoUrl;
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
      className="relative w-full h-full p-4 flex items-center overflow-hidden rounded-2xl"
      style={{ background: color || "var(--gradient-hero)" }}
    >
      {photoUrl && <img src={photoUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" />}
      {photoUrl && <div className="absolute inset-0 bg-black/25 pointer-events-none" />}
      <ChromeSceneLayer scene={sceneId} />
      <div className="relative z-10 min-w-0">
        <p className="text-base font-bold font-display text-primary-foreground leading-tight truncate">
          {firstName ? `${greeting} ${firstName}` : greeting}
        </p>
        <p className="text-xs text-primary-foreground/70 mt-1">
          {today}{weatherLine ? ` · ${weatherLine}` : ""}
        </p>
      </div>
    </div>
  );
}

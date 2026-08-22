import { useMemo } from "react";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/auth/AuthContext";
import { useLocalWeather, type WeatherScene } from "@/hooks/useLocalWeather";

function firstNameOf(profileFirst: string | undefined, displayName: string | undefined, email: string | undefined) {
  const fromProfile = (profileFirst || "").trim();
  if (fromProfile) return fromProfile.split(/\s+/)[0];
  const fromDisplay = (displayName || "").trim().split(/\s+/)[0];
  if (fromDisplay) return fromDisplay;
  return (email || "").split("@")[0] || "";
}

function seeded(i: number, salt: number, max: number) {
  return ((i * 47 + salt * 19) % 1000) / 1000 * max;
}

function WeatherLayer({ scene }: { scene: WeatherScene }) {
  const stars = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      left: `${seeded(i, 3, 96)}%`,
      top: `${seeded(i, 11, 78)}%`,
      size: 1.2 + seeded(i, 7, 2.4),
      delay: `${seeded(i, 5, 3.2).toFixed(2)}s`,
      duration: `${1.6 + seeded(i, 13, 2.4).toFixed(2)}s`,
    })),
    []
  );
  const flakes = useMemo(
    () => Array.from({ length: 20 }, (_, i) => ({
      left: `${seeded(i, 2, 100)}%`,
      delay: `${seeded(i, 8, 5).toFixed(2)}s`,
      duration: `${5.5 + seeded(i, 4, 4.5).toFixed(2)}s`,
      size: 3 + seeded(i, 6, 5),
      opacity: 0.45 + seeded(i, 9, 0.5),
    })),
    []
  );
  const drops = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({
      left: `${seeded(i, 1, 100)}%`,
      delay: `${seeded(i, 6, 1.6).toFixed(2)}s`,
      duration: `${0.7 + seeded(i, 3, 0.7).toFixed(2)}s`,
      height: 8 + seeded(i, 5, 10),
    })),
    []
  );

  return (
    <div className="greeting-weather absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      <div
        className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
        style={{ animation: "greeting-shimmer 12s ease-in-out infinite" }}
      />
      {(scene === "stars" || scene === "snow" || scene === "storm") && stars.map((s, i) => (
        <span
          key={`star-${i}`}
          className="absolute rounded-full bg-white"
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animation: `greeting-twinkle ${s.duration} ease-in-out ${s.delay} infinite`,
            boxShadow: "0 0 4px rgba(255,255,255,0.7)",
            opacity: scene === "stars" ? 1 : 0.35,
          }}
        />
      ))}

      {(scene === "sunny" || scene === "partly" || scene === "dusk") && (
        <div
          className="absolute -right-3 -top-4 w-24 h-24"
          style={{ animation: "greeting-pulse-glow 5s ease-in-out infinite" }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: scene === "dusk"
                ? "radial-gradient(circle, rgba(255,186,120,0.85) 0%, rgba(255,140,80,0.35) 42%, transparent 70%)"
                : "radial-gradient(circle, rgba(255,220,120,0.95) 0%, rgba(255,190,70,0.4) 40%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-2 rounded-full border border-white/10"
            style={{
              animation: "greeting-spin-slow 28s linear infinite",
              background: scene === "dusk"
                ? "conic-gradient(from 0deg, transparent 0 12deg, rgba(255,200,140,0.35) 12deg 16deg, transparent 16deg 42deg, rgba(255,180,110,0.25) 42deg 46deg, transparent 46deg)"
                : "conic-gradient(from 0deg, transparent 0 10deg, rgba(255,230,150,0.45) 10deg 14deg, transparent 14deg 40deg, rgba(255,210,90,0.3) 40deg 44deg, transparent 44deg)",
            }}
          />
        </div>
      )}

      {(scene === "cloudy" || scene === "partly" || scene === "fog" || scene === "rain" || scene === "storm") && (
        <>
          <div
            className="absolute -left-8 top-2 h-10 w-36 rounded-full bg-white/20 blur-md"
            style={{ animation: "greeting-drift 22s linear infinite" }}
          />
          <div
            className="absolute -left-16 top-8 h-12 w-44 rounded-full bg-white/15 blur-md"
            style={{ animation: "greeting-drift 28s linear infinite", animationDelay: "-8s" }}
          />
        </>
      )}

      {scene === "fog" && (
        <>
          <div className="absolute -left-6 bottom-0 h-16 w-2/3 rounded-full bg-white/25 blur-2xl" style={{ animation: "greeting-fog 9s ease-in-out infinite" }} />
          <div className="absolute right-0 top-0 h-14 w-1/2 rounded-full bg-white/20 blur-2xl" style={{ animation: "greeting-fog 11s ease-in-out infinite reverse" }} />
        </>
      )}

      {(scene === "rain" || scene === "storm") && drops.map((d, i) => (
        <span
          key={`drop-${i}`}
          className="absolute top-0 w-px rounded-full bg-white/70"
          style={{
            left: d.left,
            height: d.height,
            animation: `greeting-rain ${d.duration} linear ${d.delay} infinite`,
          }}
        />
      ))}

      {scene === "storm" && (
        <div
          className="absolute inset-0 bg-white"
          style={{ animation: "greeting-flash 6.5s ease-in-out infinite" }}
        />
      )}

      {scene === "snow" && flakes.map((f, i) => (
        <span
          key={`flake-${i}`}
          className="absolute -top-2 rounded-full bg-white"
          style={{
            left: f.left,
            width: f.size,
            height: f.size,
            opacity: f.opacity,
            animation: `greeting-fall ${f.duration} linear ${f.delay} infinite`,
            boxShadow: "0 0 6px rgba(255,255,255,0.55)",
          }}
        />
      ))}
    </div>
  );
}

export function GreetingWidget() {
  const { user } = useAuth();
  const { profile } = useUserProfile();
  const scene = useLocalWeather();
  const firstName = firstNameOf(
    profile?.firstName,
    profile?.displayName || user?.displayName || "",
    user?.email || ""
  );
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="relative w-full h-full p-4 flex items-center overflow-hidden bg-gradient-hero rounded-2xl">
      <WeatherLayer scene={scene} />
      <div className="relative z-10 min-w-0">
        <p className="text-base font-bold font-display text-primary-foreground leading-tight truncate">
          {firstName ? `${greeting} ${firstName}` : greeting}
        </p>
        <p className="text-xs text-primary-foreground/70 mt-1">{today}</p>
      </div>
    </div>
  );
}

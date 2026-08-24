import { useMemo } from "react";
import { useLocalWeather, type WeatherScene } from "@/hooks/useLocalWeather";
import type { DisplayBackdropKind } from "@/lib/displayPages";

type Effect = "none" | "stars" | "snow" | "rain" | "clouds" | "aurora" | "storm" | "fog" | "sun";

function effectForScene(scene: WeatherScene): Effect {
  switch (scene) {
    case "snow": return "snow";
    case "rain": return "rain";
    case "storm": return "storm";
    case "fog": return "fog";
    case "cloudy":
    case "partly": return "clouds";
    case "stars": return "stars";
    case "dusk": return "aurora";
    default: return "sun";
  }
}

function seeded(count: number, salt: number) {
  return Array.from({ length: count }, (_, index) => {
    const random = Math.abs(Math.sin((index + 1) * salt) * 10_000) % 1;
    const second = Math.abs(Math.sin((index + 3) * salt * 1.7) * 10_000) % 1;
    return { a: random, b: second };
  });
}

function Flakes({ accent, kind }: { accent: string; kind: "snow" | "rain" }) {
  const drops = useMemo(() => seeded(kind === "snow" ? 34 : 46, 12.9898), [kind]);
  return (
    <>
      {drops.map(({ a, b }, index) => (
        <span
          key={index}
          className="absolute rounded-full"
          style={{
            left: `${a * 100}%`,
            top: `${-10 + b * 20}%`,
            width: kind === "snow" ? `${0.3 + b * 0.5}vmin` : "0.15vmin",
            height: kind === "snow" ? `${0.3 + b * 0.5}vmin` : `${1.6 + b * 1.4}vmin`,
            backgroundColor: kind === "snow" ? "rgba(255,255,255,.85)" : accent,
            animation: `${kind === "snow" ? "greeting-fall" : "greeting-rain"} ${(kind === "snow" ? 7 : 2.4) + a * 4}s linear ${a * 5}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Stars() {
  const stars = useMemo(() => seeded(60, 7.233), []);
  return (
    <>
      {stars.map(({ a, b }, index) => (
        <span
          key={index}
          className="absolute rounded-full bg-white"
          style={{
            left: `${a * 100}%`,
            top: `${b * 92}%`,
            width: `${0.15 + b * 0.28}vmin`,
            height: `${0.15 + b * 0.28}vmin`,
            animation: `greeting-twinkle ${2.4 + a * 4}s ease-in-out ${a * 3}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Clouds() {
  const clouds = useMemo(() => seeded(5, 3.117), []);
  return (
    <>
      {clouds.map(({ a, b }, index) => (
        <span
          key={index}
          className="absolute rounded-full bg-white/[0.07] blur-2xl"
          style={{
            top: `${8 + b * 60}%`,
            width: `${28 + a * 34}vmin`,
            height: `${9 + b * 9}vmin`,
            animation: `greeting-drift ${70 + a * 60}s linear ${a * 25}s infinite`,
          }}
        />
      ))}
    </>
  );
}

/**
 * Ambient layer behind a page's widgets. "Match the weather" reads the local
 * forecast so a snowy morning actually snows on the screen; the rest are fixed
 * choices for screens with no location permission.
 */
export function DisplayBackdrop({ kind, accent }: { kind: DisplayBackdropKind | undefined; accent: string }) {
  const scene = useLocalWeather();
  const effect: Effect = kind === "weather" ? effectForScene(scene) : (kind && kind !== "none" ? kind : "none");
  if (effect === "none") return null;

  return (
    <div className="greeting-weather pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {effect === "aurora" && (
        <>
          <span
            className="absolute -top-1/4 left-[-10%] h-[70%] w-[70%] rounded-full blur-3xl"
            style={{ backgroundColor: accent, opacity: 0.12, animation: "greeting-pulse-glow 14s ease-in-out infinite" }}
          />
          <span
            className="absolute bottom-[-20%] right-[-10%] h-[60%] w-[60%] rounded-full bg-fuchsia-400/10 blur-3xl"
            style={{ animation: "greeting-pulse-glow 18s ease-in-out 3s infinite" }}
          />
        </>
      )}
      {effect === "sun" && (
        <span
          className="absolute -right-[12%] -top-[18%] h-[55%] w-[55%] rounded-full blur-3xl"
          style={{ backgroundColor: "#fbbf24", opacity: 0.14, animation: "greeting-pulse-glow 12s ease-in-out infinite" }}
        />
      )}
      {effect === "fog" && (
        <>
          <span className="absolute left-0 top-1/4 h-[40%] w-[120%] bg-white/10 blur-3xl" style={{ animation: "greeting-fog 22s ease-in-out infinite" }} />
          <span className="absolute left-0 bottom-0 h-[35%] w-[120%] bg-white/[0.06] blur-3xl" style={{ animation: "greeting-fog 28s ease-in-out 4s infinite" }} />
        </>
      )}
      {(effect === "clouds" || effect === "storm") && <Clouds />}
      {effect === "stars" && <Stars />}
      {(effect === "snow" || effect === "rain") && <Flakes accent={accent} kind={effect} />}
      {effect === "storm" && (
        <>
          <Flakes accent={accent} kind="rain" />
          <span className="absolute inset-0 bg-white" style={{ animation: "greeting-flash 9s ease-in-out infinite" }} />
        </>
      )}
    </div>
  );
}

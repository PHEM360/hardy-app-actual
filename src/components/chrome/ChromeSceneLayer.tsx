import { useMemo } from "react";
import { useLocalWeather, type WeatherScene } from "@/hooks/useLocalWeather";
import { seasonForDate, type ChromeSceneId, type ChromeSeason } from "@/lib/chromeScenes";

function seeded(count: number, salt: number) {
  return Array.from({ length: count }, (_, index) => {
    const a = Math.abs(Math.sin((index + 1) * salt) * 10_000) % 1;
    const b = Math.abs(Math.sin((index + 3) * salt * 1.7) * 10_000) % 1;
    const c = Math.abs(Math.sin((index + 5) * salt * 2.3) * 10_000) % 1;
    return { a, b, c };
  });
}

function Snowflake({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="drop-shadow-[0_0_3px_rgba(255,255,255,0.7)]">
      <g stroke="white" strokeWidth="1.35" strokeLinecap="round">
        <path d="M12 2v20M4.9 6.5l14.2 11M4.9 17.5l14.2-11" />
        <path d="M12 5.2l1.6-1.6M12 5.2l-1.6-1.6M12 18.8l1.6 1.6M12 18.8l-1.6 1.6" />
        <path d="M7.1 8.1l-2.2.2M7.1 8.1l.4-2.2M16.9 15.9l2.2-.2M16.9 15.9l-.4 2.2" />
        <path d="M7.1 15.9l-2.2-.2M7.1 15.9l.4 2.2M16.9 8.1l2.2.2M16.9 8.1l-.4-2.2" />
      </g>
    </svg>
  );
}

function HeartSvg({ size, color }: { size: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <path d="M12 21s-6.7-4.4-9.3-8.1C.4 9.7 2.1 5.5 6 5.1c2-.2 3.7.9 4.5 2.5C11.3 6 13 4.9 15 5.1c3.9.4 5.6 4.6 3.3 7.8C18.7 16.6 12 21 12 21z" />
    </svg>
  );
}

function Stars({ compact }: { compact: boolean }) {
  const dim = useMemo(() => seeded(compact ? 22 : 42, 7.2), [compact]);
  const bright = useMemo(() => seeded(compact ? 5 : 10, 3.8), [compact]);
  return (
    <>
      <div
        className="absolute inset-[-5%]"
        style={{
          background: "radial-gradient(ellipse at 76% 18%, rgba(93,120,205,0.2), transparent 34%), linear-gradient(180deg, rgba(3,8,28,0.42), rgba(10,18,48,0.12))",
          animation: "chrome-sky-drift 18s ease-in-out infinite",
        }}
      />
      {dim.map(({ a, b, c }, i) => (
        <span
          key={`d-${i}`}
          className="absolute rounded-full bg-white"
          style={{
            left: `${a * 100}%`,
            top: `${b * 92}%`,
            width: 1 + c * 1.6,
            height: 1 + c * 1.6,
            animation: `greeting-twinkle ${2.2 + a * 3}s ease-in-out ${b * 4}s infinite`,
            boxShadow: "0 0 3px rgba(255,255,255,0.5)",
          }}
        />
      ))}
      {bright.map(({ a, b, c }, i) => (
        <span
          key={`b-${i}`}
          className="absolute"
          style={{
            left: `${8 + a * 84}%`,
            top: `${6 + b * 70}%`,
            width: 5 + c * 4,
            height: 5 + c * 4,
            background: "radial-gradient(circle, #fff 0 18%, transparent 70%)",
            animation: `greeting-twinkle ${3 + c * 2}s ease-in-out ${a * 2}s infinite`,
          }}
        />
      ))}
      <div
        className="absolute right-[7%] top-[12%] h-9 w-9 rounded-full bg-[#fff7d4]"
        style={{
          boxShadow: "0 0 18px rgba(220,235,255,0.42), 0 0 42px rgba(130,165,255,0.2)",
          animation: "chrome-moon-breathe 7s ease-in-out infinite",
        }}
      >
        <span className="absolute -right-1 -top-1 h-9 w-9 rounded-full bg-[#16203d]" />
      </div>
      <svg className="absolute left-[21%] top-[14%] h-[54%] w-[28%] opacity-45" viewBox="0 0 120 64">
        <g stroke="rgba(190,215,255,0.55)" strokeWidth="0.6" fill="none">
          <path d="M8 46 L32 25 L58 34 L83 12 L110 29" />
          <path d="M32 25 L40 5 M58 34 L68 57" />
        </g>
        {[["8","46"],["32","25"],["58","34"],["83","12"],["110","29"],["40","5"],["68","57"]].map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r={i % 2 ? "1.8" : "1.2"} fill="white" />
        ))}
      </svg>
      <span
        className="absolute h-px w-16 origin-left"
        style={{
          left: "12%",
          top: "22%",
          background: "linear-gradient(90deg, rgba(255,255,255,0.95), transparent)",
          animation: "chrome-shoot 6.8s ease-in 2s infinite",
        }}
      />
    </>
  );
}

function Snow({ compact }: { compact: boolean }) {
  const flakes = useMemo(() => seeded(compact ? 12 : 22, 4.4), [compact]);
  return (
    <>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(180,210,255,0.12), transparent 55%)" }} />
      {flakes.map(({ a, b, c }, i) => {
        const size = 7 + c * 11;
        return (
          <span
            key={i}
            className="absolute"
            style={{
              left: `${a * 100}%`,
              top: "-18%",
              ["--drift" as string]: `${(b - 0.5) * 70}px`,
              animation: `chrome-snow-fall ${7 + b * 6}s linear ${a * 7}s infinite`,
              opacity: 0.55 + c * 0.4,
            }}
          >
            <span className="block" style={{ animation: `chrome-sway ${2.4 + c * 2}s ease-in-out ${b * 2}s infinite` }}>
              <Snowflake size={size} />
            </span>
          </span>
        );
      })}
    </>
  );
}

function Rain({ heavy }: { heavy?: boolean }) {
  const streaks = useMemo(() => seeded(heavy ? 28 : 18, 3.1), [heavy]);
  const splashes = useMemo(() => seeded(10, 9.4), []);
  return (
    <>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(20,40,70,0.18), transparent 60%)" }} />
      {streaks.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${a * 100}%`,
            top: "-10%",
            width: heavy ? 1.6 : 1.1,
            height: 14 + c * 22,
            background: "linear-gradient(180deg, transparent, rgba(220,235,255,0.85))",
            filter: "blur(0.2px)",
            animation: `chrome-rain-streak ${0.55 + b * 0.55}s linear ${a * 1.8}s infinite`,
          }}
        />
      ))}
      {splashes.map(({ a, b }, i) => (
        <span
          key={`s-${i}`}
          className="absolute bottom-[6%] rounded-full border border-white/40"
          style={{
            left: `${a * 100}%`,
            width: 6 + b * 8,
            height: 3,
            animation: `chrome-splash ${1.1 + b}s ease-out ${a * 1.4}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Lightning() {
  return (
    <>
      <div className="absolute inset-0 bg-white" style={{ animation: "greeting-flash 7.2s ease-in-out infinite" }} />
      <svg className="absolute left-[58%] top-0 h-[70%] w-16 drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" viewBox="0 0 40 120" style={{ animation: "chrome-bolt 7.2s ease-in-out infinite" }}>
        <path d="M22 0 L8 48 H20 L10 120 L32 52 H18 Z" fill="white" opacity="0.92" />
      </svg>
    </>
  );
}

function SunSky({ dusk }: { dusk?: boolean }) {
  const motes = useMemo(() => seeded(10, 2.2), []);
  return (
    <>
      <div
        className="absolute -right-[8%] -top-[40%] h-[140%] w-[70%]"
        style={{
          background: dusk
            ? "radial-gradient(circle at 70% 40%, rgba(255,150,80,0.55) 0%, rgba(255,90,70,0.18) 32%, transparent 62%)"
            : "radial-gradient(circle at 70% 40%, rgba(255,220,120,0.7) 0%, rgba(255,180,60,0.2) 34%, transparent 62%)",
        }}
      />
      <div
        className="absolute right-[4%] top-[-30%] h-[160%] w-[55%] opacity-50"
        style={{
          background: dusk
            ? "conic-gradient(from 200deg at 80% 20%, transparent 0 8%, rgba(255,170,90,0.35) 9%, transparent 12%, rgba(255,120,70,0.25) 40%, transparent 44%)"
            : "conic-gradient(from 200deg at 80% 20%, transparent 0 8%, rgba(255,230,140,0.4) 9%, transparent 12%, rgba(255,210,90,0.28) 40%, transparent 44%)",
          animation: "chrome-ray-spin 48s linear infinite",
        }}
      />
      {motes.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white/70"
          style={{
            left: `${40 + a * 55}%`,
            top: `${20 + b * 50}%`,
            width: 2 + c * 3,
            height: 2 + c * 3,
            animation: `chrome-mote ${5 + b * 4}s linear ${a * 4}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Clouds({ stormy }: { stormy?: boolean }) {
  const layers = useMemo(() => seeded(4, 5.1), []);
  return (
    <>
      {layers.map(({ a, b, c }, i) => (
        <div
          key={i}
          className="absolute rounded-full blur-2xl"
          style={{
            top: `${4 + b * 38}%`,
            width: `${34 + a * 40}%`,
            height: `${28 + c * 22}%`,
            background: stormy ? "rgba(30,40,60,0.45)" : "rgba(255,255,255,0.22)",
            animation: `greeting-drift ${28 + i * 10}s linear ${-a * 20}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Fog() {
  return (
    <>
      <div className="absolute inset-x-[-10%] top-[10%] h-[50%] rounded-full bg-white/20 blur-3xl" style={{ animation: "greeting-fog 11s ease-in-out infinite" }} />
      <div className="absolute inset-x-[-20%] bottom-[-10%] h-[55%] rounded-full bg-white/25 blur-3xl" style={{ animation: "greeting-fog 15s ease-in-out 2s infinite reverse" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, transparent, rgba(255,255,255,0.16))" }} />
    </>
  );
}

function WeatherFX({ scene, compact }: { scene: WeatherScene; compact: boolean }) {
  if (scene === "snow") return <Snow compact={compact} />;
  if (scene === "rain") return <Rain />;
  if (scene === "storm") {
    return (
      <>
        <Clouds stormy />
        <Rain heavy />
        <Lightning />
      </>
    );
  }
  if (scene === "fog") return <Fog />;
  if (scene === "cloudy" || scene === "partly") {
    return (
      <>
        {scene === "partly" && <SunSky />}
        <Clouds />
      </>
    );
  }
  if (scene === "stars") return <Stars compact={compact} />;
  if (scene === "dusk") return <SunSky dusk />;
  return <SunSky />;
}

function SeasonFX({ season, compact }: { season: ChromeSeason; compact: boolean }) {
  const bits = useMemo(() => seeded(compact ? 10 : 18, season === "autumn" ? 5.5 : 6.6), [compact, season]);
  if (season === "winter") return <Snow compact={compact} />;
  if (season === "summer") return <SunSky />;
  if (season === "spring") {
    return (
      <>
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 80% 0%, rgba(255,180,210,0.22), transparent 50%)" }} />
        {bits.map(({ a, b, c }, i) => (
          <span
            key={i}
            className="absolute text-[10px]"
            style={{
              left: `${a * 100}%`,
              top: "-12%",
              ["--drift" as string]: `${(b - 0.4) * 50}px`,
              animation: `chrome-tumble ${8 + b * 5}s linear ${a * 6}s infinite`,
              filter: `hue-rotate(${c * 40}deg)`,
            }}
          >
            {c > 0.5 ? "🌸" : "💮"}
          </span>
        ))}
      </>
    );
  }
  return (
    <>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,140,60,0.16), transparent 50%)" }} />
      {bits.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${a * 100}%`,
            top: "-14%",
            fontSize: 11 + c * 8,
            ["--drift" as string]: `${(b - 0.35) * 60}px`,
            animation: `chrome-tumble ${7 + b * 6}s linear ${a * 5}s infinite`,
          }}
        >
          {c > 0.66 ? "🍁" : c > 0.33 ? "🍂" : "🍃"}
        </span>
      ))}
    </>
  );
}

function Aurora() {
  return (
    <>
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,12,30,0.5),rgba(10,38,45,0.16))]" />
      <svg
        className="absolute -left-[8%] -top-[45%] h-[170%] w-[118%] overflow-visible mix-blend-screen"
        viewBox="0 0 600 180"
        preserveAspectRatio="none"
        style={{ animation: "chrome-aurora-wave 12s ease-in-out infinite, chrome-aurora-shimmer 8s ease-in-out infinite" }}
      >
        <defs>
          <linearGradient id="aurora-green" x1="0" x2="1">
            <stop offset="0" stopColor="#59f7c2" stopOpacity="0" />
            <stop offset=".25" stopColor="#59f7c2" stopOpacity=".74" />
            <stop offset=".62" stopColor="#60d8ff" stopOpacity=".5" />
            <stop offset="1" stopColor="#60d8ff" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="aurora-violet" x1="0" x2="1">
            <stop offset="0" stopColor="#a579ff" stopOpacity="0" />
            <stop offset=".45" stopColor="#a579ff" stopOpacity=".62" />
            <stop offset=".82" stopColor="#ec73ff" stopOpacity=".38" />
            <stop offset="1" stopColor="#ec73ff" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d="M-30 100 C80 18 150 154 266 62 C370 -18 454 128 640 28" fill="none" stroke="url(#aurora-green)" strokeWidth="42" strokeLinecap="round" />
        <path d="M-50 145 C92 65 168 178 302 92 C408 24 485 126 650 66" fill="none" stroke="url(#aurora-violet)" strokeWidth="27" strokeLinecap="round" opacity=".82" />
        <path d="M-20 70 C120 5 188 112 315 46 C420 -8 510 74 630 18" fill="none" stroke="rgba(180,255,224,.28)" strokeWidth="10" strokeLinecap="round" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[28%] opacity-40" style={{ background: "linear-gradient(180deg, transparent, rgba(30,110,92,0.28))" }} />
    </>
  );
}

function Galaxy() {
  const stars = useMemo(() => seeded(34, 11.1), []);
  return (
    <>
      <div className="absolute inset-0" style={{ background: "linear-gradient(120deg, rgba(8,3,28,.56), rgba(25,8,50,.18) 52%, rgba(4,18,48,.4))" }} />
      <div
        className="absolute -left-[18%] top-[-65%] h-[220%] w-[78%] rounded-[50%] blur-2xl mix-blend-screen"
        style={{
          background: "conic-gradient(from 20deg, transparent, rgba(235,170,255,.5), transparent 23%, rgba(80,150,255,.45), transparent 48%, rgba(255,140,210,.35), transparent 72%)",
          animation: "chrome-nebula-drift 18s ease-in-out infinite",
        }}
      />
      <div
        className="absolute left-[22%] top-[-28%] h-[150%] w-[38%] -rotate-12 blur-xl opacity-50 mix-blend-screen"
        style={{ background: "linear-gradient(90deg, transparent, rgba(255,210,250,.28), rgba(100,120,255,.3), transparent)" }}
      />
      {stars.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${a * 100}%`,
            top: `${b * 100}%`,
            width: 1 + c * 2,
            height: 1 + c * 2,
            animation: `greeting-twinkle ${2 + a * 3}s ease-in-out ${b * 2}s infinite`,
          }}
        />
      ))}
      <div className="absolute right-[8%] top-[10%] h-12 w-12" style={{ animation: "chrome-planet-float 8s ease-in-out infinite" }}>
        <span
          className="absolute inset-2 rounded-full"
          style={{
            background: "radial-gradient(circle at 32% 25%, #f2c5ff, #8b5bc7 42%, #2f255f 72%)",
            boxShadow: "inset -5px -4px 8px rgba(12,8,40,.55), 0 0 15px rgba(190,120,255,.35)",
          }}
        />
        <span className="absolute left-0 top-[21px] h-2 w-12 -rotate-12 rounded-[50%] border border-fuchsia-200/70" />
      </div>
    </>
  );
}

function Fireflies({ compact }: { compact: boolean }) {
  const bugs = useMemo(() => seeded(compact ? 7 : 12, 8.8), [compact]);
  return (
    <>
      {bugs.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${10 + a * 80}%`,
            top: `${15 + b * 65}%`,
            width: 4 + c * 3,
            height: 4 + c * 3,
            background: "radial-gradient(circle, #fff6a0 0 35%, rgba(255,210,70,0.15) 70%, transparent)",
            boxShadow: "0 0 10px 3px rgba(255,220,80,0.65)",
            animation: `chrome-wander ${4.5 + c * 3}s ease-in-out ${a * 3}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Ocean() {
  return (
    <>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(85,190,225,.12), rgba(5,85,130,.34))" }} />
      <div className="absolute right-[15%] top-[-15%] h-16 w-16 rounded-full bg-amber-100/35 blur-md" />
      <div
        className="absolute right-[8%] top-[8%] h-[85%] w-[25%] blur-sm"
        style={{ background: "linear-gradient(105deg, transparent, rgba(255,240,180,.34), transparent)", animation: "chrome-water-glint 7s ease-in-out infinite" }}
      />
      <div className="absolute inset-x-0 bottom-0 h-[68%] overflow-hidden">
        <svg className="absolute bottom-0 h-full w-[200%]" viewBox="0 0 1200 90" preserveAspectRatio="none" style={{ animation: "chrome-water-roll 12s linear infinite" }}>
          <path d="M0 38C120 62 220 14 350 39C470 62 585 12 710 40C835 67 970 14 1100 40C1145 49 1180 45 1200 40V90H0Z" fill="rgba(20,160,195,0.28)" />
          <path d="M0 38C120 62 220 14 350 39C470 62 585 12 710 40C835 67 970 14 1100 40" fill="none" stroke="rgba(230,255,255,.42)" strokeWidth="2.2" />
        </svg>
        <svg className="absolute bottom-0 h-[78%] w-[200%]" viewBox="0 0 1200 90" preserveAspectRatio="none" style={{ animation: "chrome-water-roll 18s linear infinite reverse" }}>
          <path d="M0 50C150 18 290 72 430 46C590 16 720 70 875 44C1020 20 1120 58 1200 43V90H0Z" fill="rgba(10,95,155,0.4)" />
          <path d="M0 50C150 18 290 72 430 46C590 16 720 70 875 44C1020 20 1120 58 1200 43" fill="none" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />
        </svg>
        <svg className="absolute bottom-0 h-[52%] w-[200%]" viewBox="0 0 1200 90" preserveAspectRatio="none" style={{ animation: "chrome-water-roll 8s linear infinite" }}>
          <path d="M0 58C90 40 170 72 270 56C390 37 485 72 600 56C720 38 815 70 930 54C1040 40 1120 63 1200 52V90H0Z" fill="rgba(255,255,255,0.17)" />
        </svg>
      </div>
      <svg className="absolute left-[-20px] top-[18%] h-4 w-12 opacity-0" viewBox="0 0 48 16" style={{ animation: "chrome-gull 12s linear 1s infinite" }}>
        <path d="M2 12 Q10 3 20 10 Q29 1 46 9" fill="none" stroke="rgba(255,255,255,.7)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </>
  );
}

function Meadow() {
  const blades = useMemo(() => seeded(22, 1.4), []);
  const pollen = useMemo(() => seeded(8, 2.9), []);
  return (
    <>
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(255,220,120,.1), rgba(90,155,60,.23))" }} />
      <svg className="absolute inset-x-0 bottom-0 h-[58%] w-full" viewBox="0 0 600 70" preserveAspectRatio="none">
        <path d="M0 48 Q110 8 235 47 Q365 5 600 44 V70 H0Z" fill="rgba(50,100,55,.22)" />
        <path d="M0 57 Q145 25 300 56 Q440 27 600 53 V70 H0Z" fill="rgba(30,82,48,.34)" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-[42%] flex items-end justify-around px-1">
        {blades.map(({ a, c }, i) => (
          <span
            key={i}
            className="origin-bottom rounded-full bg-white/35"
            style={{
              width: 2,
              height: `${28 + c * 48}%`,
              ["--lean" as string]: `${-8 + a * 10}deg`,
              animation: `chrome-grass ${2.2 + a}s ease-in-out ${a * 1.4}s infinite`,
              opacity: 0.35 + c * 0.4,
            }}
          />
        ))}
      </div>
      {pollen.map(({ a, b, c }, i) => (
        <span
          key={`p-${i}`}
          className="absolute rounded-full bg-amber-100/80"
          style={{
            left: `${a * 100}%`,
            top: `${30 + b * 40}%`,
            width: 3 + c * 3,
            height: 3 + c * 3,
            animation: `chrome-mote ${7 + b * 4}s linear ${a * 3}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Harbour() {
  return (
    <>
      <Ocean />
      <div className="absolute right-[5%] bottom-[30%] h-8 w-16 origin-right" style={{ background: "linear-gradient(90deg, rgba(255,235,170,.28), transparent)", clipPath: "polygon(100% 42%, 0 0, 0 100%)", animation: "chrome-lighthouse-beam 8s ease-in-out infinite" }} />
      <svg className="absolute right-[4%] bottom-[18%] h-10 w-7" viewBox="0 0 28 40">
        <path d="M9 11h10l3 29H6z" fill="rgba(245,245,240,.82)" />
        <path d="M8 11h12l-2-6H10z" fill="rgba(230,90,70,.9)" />
        <rect x="11" y="6" width="6" height="4" rx="1" fill="#ffe49a" />
        <path d="M7 22h14" stroke="rgba(210,60,55,.75)" strokeWidth="3" />
      </svg>
      <div className="absolute bottom-[16%] left-[12%] origin-bottom" style={{ animation: "chrome-boat 5s ease-in-out infinite" }}>
        <svg width="42" height="28" viewBox="0 0 42 28" fill="none">
          <path d="M20 1V18" stroke="rgba(255,255,255,.8)" />
          <path d="M19 3 L19 16 L7 16 Z" fill="rgba(255,255,255,0.82)" />
          <path d="M21 5 L21 16 L33 16 Z" fill="rgba(150,215,230,0.72)" />
          <path d="M5 18 L37 18 L32 25 L10 25 Z" fill="rgba(255,255,255,0.88)" />
        </svg>
      </div>
    </>
  );
}

function Bokeh({ compact }: { compact: boolean }) {
  const orbs = useMemo(() => seeded(compact ? 7 : 11, 14.2), [compact]);
  const colors = ["rgba(255,180,200,0.35)", "rgba(180,210,255,0.32)", "rgba(255,220,150,0.3)", "rgba(190,255,210,0.28)"];
  return (
    <>
      {orbs.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${a * 90}%`,
            top: `${b * 80}%`,
            width: 18 + c * 36,
            height: 18 + c * 36,
            background: `radial-gradient(circle at 34% 30%, rgba(255,255,255,.65), ${colors[i % colors.length]} 35%, transparent 70%)`,
            border: "1px solid rgba(255,255,255,.12)",
            boxShadow: `0 0 ${10 + c * 18}px ${colors[i % colors.length]}`,
            animation: `chrome-bokeh-focus ${6 + b * 5}s ease-in-out ${a * 4}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Embers({ compact }: { compact: boolean }) {
  const bits = useMemo(() => seeded(compact ? 10 : 16, 6.7), [compact]);
  return (
    <>
      <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: "linear-gradient(180deg, transparent, rgba(255,80,20,0.18))" }} />
      {bits.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute bottom-[8%] rounded-full"
          style={{
            left: `${8 + a * 84}%`,
            width: 3 + c * 4,
            height: 3 + c * 4,
            background: c > 0.5 ? "#ffb020" : "#ff6a20",
            boxShadow: "0 0 8px rgba(255,140,40,0.8)",
            ["--drift" as string]: `${(b - 0.5) * 28}px`,
            animation: `chrome-ember ${3.2 + b * 3}s ease-out ${a * 3}s infinite, chrome-flicker ${1 + c}s ease-in-out ${b}s infinite`,
          }}
        />
      ))}
    </>
  );
}

function Lanterns({ compact }: { compact: boolean }) {
  const lamps = useMemo(() => seeded(compact ? 5 : 8, 12.4), [compact]);
  return (
    <>
      {lamps.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute bottom-[-8%] flex flex-col items-center"
          style={{
            left: `${a * 92}%`,
            animation: `chrome-lantern ${9 + b * 5}s linear ${a * 6}s infinite`,
          }}
        >
          <span className="h-3 w-px bg-white/40" />
          <span
            className="rounded-md"
            style={{
              width: 10 + c * 6,
              height: 14 + c * 6,
              background: "linear-gradient(180deg, #ffd27a, #ff7a3a)",
              boxShadow: "0 0 12px rgba(255,140,60,0.7)",
            }}
          />
        </span>
      ))}
    </>
  );
}

function Fireworks({ compact }: { compact: boolean }) {
  const bursts = useMemo(() => [
    { x: 28, y: 38, delay: 0, color: "#fbbf24" },
    { x: 68, y: 28, delay: 1.4, color: "#f472b6" },
    ...(!compact ? [{ x: 50, y: 52, delay: 2.6, color: "#60a5fa" }] : []),
  ], [compact]);
  return (
    <>
      {bursts.map((burst) => (
        <span key={`${burst.x}-${burst.delay}`} className="absolute" style={{ left: `${burst.x}%`, top: `${burst.y}%` }}>
          {Array.from({ length: 12 }, (_, i) => (
            <span
              key={i}
              className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full"
              style={{
                background: burst.color,
                boxShadow: `0 0 6px ${burst.color}`,
                ["--a" as string]: `${i * 30}deg`,
                animation: `chrome-burst 1.8s ease-out ${burst.delay}s infinite`,
              }}
            />
          ))}
        </span>
      ))}
    </>
  );
}

function Confetti({ compact }: { compact: boolean }) {
  const bits = useMemo(() => seeded(compact ? 12 : 20, 6.2), [compact]);
  const colors = ["#f472b6", "#fbbf24", "#34d399", "#60a5fa", "#c084fc", "#fb7185"];
  return (
    <>
      {bits.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute"
          style={{
            left: `${a * 100}%`,
            top: "-12%",
            width: c > 0.6 ? 8 : 5,
            height: c > 0.6 ? 5 : 10,
            borderRadius: c > 0.8 ? 999 : 1,
            background: colors[i % colors.length],
            ["--drift" as string]: `${(b - 0.4) * 50}px`,
            animation: `chrome-tumble ${4.5 + b * 3}s linear ${a * 4}s infinite`,
            boxShadow: "0 0 4px rgba(0,0,0,0.12)",
          }}
        />
      ))}
    </>
  );
}

function Hearts({ compact }: { compact: boolean }) {
  const bits = useMemo(() => seeded(compact ? 7 : 12, 1.9), [compact]);
  const colors = ["#fb7185", "#f472b6", "#fda4af", "#fff"];
  return (
    <>
      {bits.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute bottom-[-6%]"
          style={{
            left: `${a * 92}%`,
            animation: `chrome-wobble-up ${5.5 + b * 3}s ease-in ${a * 4}s infinite`,
            opacity: 0.75,
          }}
        >
          <HeartSvg size={10 + c * 10} color={colors[i % colors.length]} />
        </span>
      ))}
    </>
  );
}

function Balloons({ compact }: { compact: boolean }) {
  const bits = useMemo(() => seeded(compact ? 4 : 7, 11.3), [compact]);
  const colors = ["#fb7185", "#60a5fa", "#fbbf24", "#c084fc", "#34d399"];
  return (
    <>
      {bits.map(({ a, b, c }, i) => (
        <span
          key={i}
          className="absolute bottom-[-10%] flex flex-col items-center"
          style={{
            left: `${8 + a * 80}%`,
            animation: `chrome-lantern ${10 + b * 4}s linear ${a * 5}s infinite, chrome-bob ${2.4 + c}s ease-in-out ${b}s infinite`,
          }}
        >
          <span
            className="rounded-full"
            style={{
              width: 12 + c * 8,
              height: 16 + c * 10,
              background: colors[i % colors.length],
              boxShadow: "inset -3px -4px 6px rgba(255,255,255,0.45)",
            }}
          />
          <span className="h-5 w-px bg-white/50" />
        </span>
      ))}
    </>
  );
}

function PawTrail({ compact }: { compact: boolean }) {
  const steps = useMemo(() => Array.from({ length: compact ? 5 : 7 }, (_, i) => i), [compact]);
  return (
    <>
      {steps.map((i) => (
        <span
          key={i}
          className="absolute text-lg opacity-0"
          style={{
            left: `${8 + i * 12}%`,
            top: `${i % 2 === 0 ? 38 : 52}%`,
            animation: `chrome-paw ${2.8}s ease-in-out ${i * 0.22}s infinite`,
            filter: "drop-shadow(0 0 4px rgba(255,255,255,0.4))",
          }}
        >
          🐾
        </span>
      ))}
    </>
  );
}

function Bubbles({ compact }: { compact: boolean }) {
  const bits = useMemo(() => seeded(compact ? 8 : 14, 2.7), [compact]);
  return (
    <>
      {bits.map(({ a, b, c }, i) => {
        const size = 8 + c * 16;
        return (
          <span
            key={i}
            className="absolute bottom-[-8%] rounded-full"
            style={{
              left: `${a * 92}%`,
              width: size,
              height: size,
              background: "radial-gradient(circle at 30% 28%, rgba(255,255,255,0.7), rgba(255,255,255,0.08) 42%, rgba(180,220,255,0.15))",
              border: "1px solid rgba(255,255,255,0.35)",
              animation: `chrome-wobble-up ${6 + b * 4}s linear ${a * 5}s infinite, chrome-pop ${6 + b * 4}s linear ${a * 5}s infinite`,
            }}
          />
        );
      })}
    </>
  );
}

function StainedGlass() {
  return (
    <>
      <svg className="absolute inset-0 h-full w-full opacity-55" viewBox="0 0 600 120" preserveAspectRatio="none">
        <g stroke="rgba(10,12,28,.58)" strokeWidth="4">
          <path d="M-20-10H150L102 62L-20 42Z" fill="rgba(74,190,205,.46)" />
          <path d="M150-10H290L238 55L102 62Z" fill="rgba(155,90,220,.52)" />
          <path d="M290-10H430L390 65L238 55Z" fill="rgba(245,175,70,.55)" />
          <path d="M430-10H620V45L510 72L390 65Z" fill="rgba(220,75,130,.48)" />
          <path d="M-20 42L102 62L160 130H-20Z" fill="rgba(245,105,75,.42)" />
          <path d="M102 62L238 55L286 130H160Z" fill="rgba(75,135,230,.48)" />
          <path d="M238 55L390 65L406 130H286Z" fill="rgba(80,200,145,.45)" />
          <path d="M390 65L510 72L620 45V130H406Z" fill="rgba(180,95,220,.48)" />
        </g>
      </svg>
      <div
        className="absolute inset-y-[-20%] left-[-20%] w-[38%] blur-lg"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,.5), rgba(255,230,160,.22), transparent)",
          animation: "chrome-prism-slide 11s ease-in-out infinite",
        }}
      />
      <div className="absolute inset-0 opacity-35 mix-blend-screen" style={{ background: "radial-gradient(circle at 45% 45%, rgba(255,255,255,.48), transparent 32%)" }} />
    </>
  );
}

export function ChromeSceneLayer({
  scene,
  density = "full",
}: {
  scene: ChromeSceneId;
  density?: "compact" | "full";
}) {
  const weather = useLocalWeather();
  const compact = density === "compact";
  if (scene === "none") return null;

  return (
    <div className="greeting-weather pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {scene === "weather" && <WeatherFX scene={weather} compact={compact} />}
      {scene === "seasons" && <SeasonFX season={seasonForDate()} compact={compact} />}
      {scene === "stars" && <Stars compact={compact} />}
      {scene === "aurora" && <Aurora />}
      {scene === "galaxy" && <Galaxy />}
      {scene === "fireflies" && <Fireflies compact={compact} />}
      {scene === "ocean" && <Ocean />}
      {scene === "meadow" && <Meadow />}
      {scene === "harbour" && <Harbour />}
      {scene === "bokeh" && <Bokeh compact={compact} />}
      {scene === "embers" && <Embers compact={compact} />}
      {scene === "lanterns" && <Lanterns compact={compact} />}
      {scene === "fireworks" && <Fireworks compact={compact} />}
      {scene === "confetti" && <Confetti compact={compact} />}
      {scene === "hearts" && <Hearts compact={compact} />}
      {scene === "balloons" && <Balloons compact={compact} />}
      {scene === "pawprints" && <PawTrail compact={compact} />}
      {scene === "bubbles" && <Bubbles compact={compact} />}
      {scene === "glass" && <StainedGlass />}
      <div className="absolute inset-0 bg-gradient-to-b from-white/[0.035] via-transparent to-black/[0.08]" />
      <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" style={{ animation: "greeting-shimmer 14s ease-in-out infinite" }} />
    </div>
  );
}

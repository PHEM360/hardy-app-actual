import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useAppearance } from "@/hooks/useAppearance";
import { getLoaderPreset, ROTATE_LOADER_PRESETS, type LoaderMotion } from "@/lib/appThemes";

function CinematicLoader({ motionKind }: { motionKind: LoaderMotion }) {
  if (motionKind === "orbit") {
    return (
      <div className="relative h-16 w-16">
        <span className="absolute inset-3 rounded-full bg-primary/20" />
        <motion.span
          className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 32px" }}
        />
        <motion.span
          className="absolute left-1/2 top-1 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-foreground/70"
          animate={{ rotate: -360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "50% 28px" }}
        />
      </div>
    );
  }
  if (motionKind === "bloom") {
    return (
      <div className="relative h-16 w-16">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute inset-0 rounded-full border border-primary/50"
            animate={{ scale: [0.35, 1.15], opacity: [0.7, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.45, ease: "easeOut" }}
          />
        ))}
        <span className="absolute inset-[22px] rounded-full bg-gradient-primary shadow-card" />
      </div>
    );
  }
  if (motionKind === "constellation") {
    const dots = [
      { x: 8, y: 28 },
      { x: 26, y: 10 },
      { x: 44, y: 22 },
      { x: 36, y: 44 },
      { x: 16, y: 48 },
    ];
    return (
      <svg className="h-16 w-16" viewBox="0 0 64 64">
        <motion.path
          d="M8 28 L26 10 L44 22 L36 44 L16 48 Z"
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="1.2"
          initial={{ pathLength: 0, opacity: 0.3 }}
          animate={{ pathLength: [0.15, 1, 0.2], opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
        {dots.map((dot, i) => (
          <motion.circle
            key={`${dot.x}-${dot.y}`}
            cx={dot.x}
            cy={dot.y}
            r="2.4"
            fill="hsl(var(--primary))"
            animate={{ opacity: [0.3, 1, 0.3], r: [2, 3.2, 2] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </svg>
    );
  }
  if (motionKind === "ripple") {
    return (
      <div className="relative h-16 w-16">
        {[0, 1, 2, 3].map((i) => (
          <motion.span
            key={i}
            className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/60"
            animate={{ scale: [1, 6], opacity: [0.65, 0] }}
            transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
          />
        ))}
      </div>
    );
  }
  if (motionKind === "silkspin") {
    return (
      <motion.div
        className="relative h-16 w-16 rounded-full"
        style={{
          background: "conic-gradient(from 90deg, hsl(var(--primary)), #f9a8d4, #93c5fd, hsl(var(--primary)))",
          filter: "blur(0.2px)",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute inset-2 rounded-full bg-background/90" />
      </motion.div>
    );
  }
  return (
    <div className="relative h-16 w-16 overflow-hidden rounded-2xl">
      <motion.div
        className="absolute inset-[-30%]"
        style={{ background: "linear-gradient(120deg, #34d399, #60a5fa, #c084fc, #34d399)" }}
        animate={{ x: ["-10%", "10%", "-10%"], y: ["-8%", "8%", "-8%"] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background/40" />
    </div>
  );
}

const DogLoader = ({
  text = "Loading...",
  fullPage = false,
}: {
  text?: string;
  fullPage?: boolean;
}) => {
  const { loader, loaderPresetRotate } = useAppearance();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!loaderPresetRotate) return;
    const id = window.setInterval(() => setTick((n) => n + 1), 2200);
    return () => window.clearInterval(id);
  }, [loaderPresetRotate]);

  const live = loaderPresetRotate
    ? getLoaderPreset(ROTATE_LOADER_PRESETS[tick % ROTATE_LOADER_PRESETS.length])
    : loader;
  const cinematic = live.motion && live.motion !== "pair" && live.motion !== "trail";

  const inner = (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      {cinematic ? (
        <CinematicLoader motionKind={live.motion!} />
      ) : (
        <div className="relative h-16 w-16">
          {live.motion === "trail" ? (
            [0, 1, 2, 3].map((i) => (
              <motion.span
                key={i}
                className="absolute left-0 text-2xl"
                style={{ top: i % 2 === 0 ? 2 : 22 }}
                animate={{ x: [-8, 40], opacity: [0, 1, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.28, ease: "easeInOut" }}
              >
                {live.left}
              </motion.span>
            ))
          ) : (
            <>
              <motion.span
                className="absolute left-0 text-4xl"
                animate={{ x: [0, 30, 0], rotateY: [0, 0, 180, 180, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {live.left}
              </motion.span>
              <motion.span
                className="absolute right-0 text-3xl"
                animate={{ x: [0, -30, 0], rotateY: [180, 180, 0, 0, 180] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
              >
                {live.right}
              </motion.span>
            </>
          )}
        </div>
      )}
      <motion.p
        className="text-xs font-medium text-muted-foreground"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {text}
      </motion.p>
    </div>
  );

  if (!fullPage) return inner;

  return (
    <div
      className="flex h-[100svh] min-h-[100dvh] w-full items-center justify-center overflow-hidden px-4"
      style={{
        paddingTop: "max(1rem, env(safe-area-inset-top, 0px))",
        paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
      }}
    >
      {inner}
    </div>
  );
};

export default DogLoader;

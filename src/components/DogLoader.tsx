import { motion } from "framer-motion";
import { useAppearance } from "@/hooks/useAppearance";

const DogLoader = ({
  text = "Loading...",
  fullPage = false,
}: {
  text?: string;
  fullPage?: boolean;
}) => {
  const { loader } = useAppearance();
  const trail = loader.motion === "trail";

  const inner = (
    <div className="flex flex-col items-center justify-center gap-3 py-12">
      <div className="relative h-16 w-16">
        {trail ? (
          [0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="absolute left-0 text-2xl"
              style={{ top: i % 2 === 0 ? 2 : 22 }}
              animate={{ x: [-8, 40], opacity: [0, 1, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.28, ease: "easeInOut" }}
            >
              {loader.left}
            </motion.span>
          ))
        ) : (
          <>
            <motion.span
              className="absolute left-0 text-4xl"
              animate={{ x: [0, 30, 0], rotateY: [0, 0, 180, 180, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {loader.left}
            </motion.span>
            <motion.span
              className="absolute right-0 text-3xl"
              animate={{ x: [0, -30, 0], rotateY: [180, 180, 0, 0, 180] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            >
              {loader.right}
            </motion.span>
          </>
        )}
      </div>
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

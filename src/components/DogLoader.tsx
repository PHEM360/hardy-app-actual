import { motion } from "framer-motion";
import { useAppearance } from "@/hooks/useAppearance";

const DogLoader = ({ text = "Loading..." }: { text?: string }) => {
  const { loader } = useAppearance();
  const trail = loader.motion === "trail";

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <div className="relative w-16 h-16">
        {trail ? (
          [0, 1, 2, 3].map((i) => (
            <motion.span
              key={i}
              className="absolute text-2xl left-0"
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
              className="absolute text-4xl left-0"
              animate={{ x: [0, 30, 0], rotateY: [0, 0, 180, 180, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              {loader.left}
            </motion.span>
            <motion.span
              className="absolute text-3xl right-0"
              animate={{ x: [0, -30, 0], rotateY: [180, 180, 0, 0, 180] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
            >
              {loader.right}
            </motion.span>
          </>
        )}
      </div>
      <motion.p
        className="text-xs text-muted-foreground font-medium"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        {text}
      </motion.p>
    </div>
  );
};

export default DogLoader;

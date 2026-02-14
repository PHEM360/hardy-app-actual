import { motion } from "framer-motion";

const DogLoader = ({ text = "Loading..." }: { text?: string }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-3">
    <div className="relative w-16 h-16">
      <motion.span
        className="absolute text-4xl left-0"
        animate={{ x: [0, 30, 0], rotateY: [0, 0, 180, 180, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
      >
        🐕
      </motion.span>
      <motion.span
        className="absolute text-3xl right-0"
        animate={{ x: [0, -30, 0], rotateY: [180, 180, 0, 0, 180] }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      >
        🐶
      </motion.span>
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

export default DogLoader;

import { motion, AnimatePresence } from "framer-motion";
import { Cake, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUrgentOccasions } from "@/hooks/useUrgentOccasions";
import { JEWEL, jewelGradient } from "@/lib/brandPalette";

const SPARKS = [
  { x: "8%", y: "18%", size: 7, delay: 0 },
  { x: "86%", y: "14%", size: 5, delay: 0.12 },
  { x: "14%", y: "78%", size: 6, delay: 0.2 },
  { x: "78%", y: "72%", size: 8, delay: 0.08 },
  { x: "50%", y: "8%", size: 4, delay: 0.18 },
  { x: "92%", y: "48%", size: 5, delay: 0.28 },
];

export function UrgentOccasionOverlay() {
  const { current, acknowledge } = useUrgentOccasions();
  const birthday = current?.kind === "birthday";

  return (
    <AnimatePresence>
      {current && (
        <motion.div
          key={current.id}
          className="fixed inset-0 z-[420] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            className="absolute inset-0 bg-[#1A1814]/78"
            aria-label="Dismiss later"
            onClick={acknowledge}
          />
          {SPARKS.map((spark, index) => (
            <motion.span
              key={index}
              className="pointer-events-none absolute rounded-full"
              style={{
                left: spark.x,
                top: spark.y,
                width: spark.size,
                height: spark.size,
                background: index % 2 === 0 ? "#C6A15B" : "#F8F4EC",
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{ opacity: [0.2, 1, 0.35], y: [0, -10, 0], scale: [0.7, 1.15, 0.85] }}
              transition={{ duration: 1.8, repeat: Infinity, delay: spark.delay }}
            />
          ))}
          <motion.div
            role="dialog"
            aria-labelledby="urgent-occasion-title"
            initial={{ opacity: 0, scale: 0.92, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 10 }}
            transition={{ duration: 0.18 }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/20 shadow-card"
            style={{ background: jewelGradient(birthday ? JEWEL.plum : JEWEL.oxblood) }}
          >
            <div className="band px-5 py-2.5 text-white">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em]">
                {birthday ? "Birthday today" : "Urgent today"}
              </p>
            </div>
            <div className="px-5 pb-5 pt-7 text-center text-white">
              <motion.div
                className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-xl bg-white/15 ring-1 ring-inset ring-white/25"
                animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }}
              >
                {birthday ? <Cake className="h-8 w-8" /> : <PartyPopper className="h-8 w-8" />}
              </motion.div>
              <h2 id="urgent-occasion-title" className="font-display text-[1.7rem] font-semibold leading-tight">
                {current.title}
              </h2>
              {current.subtitle && (
                <p className="mt-2 text-sm text-white/80">{current.subtitle}</p>
              )}
              <div className="mt-6">
                <Button type="button" variant="gold" className="w-full" onClick={acknowledge}>
                  Acknowledge
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Palette, Check } from "lucide-react";
import { motion } from "framer-motion";

interface Theme {
  id: string;
  name: string;
  description: string;
  preview: string;
  icon: string;
  colors: { primary: string; accent: string; bg: string };
}

const THEMES: Theme[] = [
  {
    id: "default", name: "Hardy Hub", description: "Clean teal & amber — the default feel",
    icon: "🏠", preview: "Default",
    colors: { primary: "hsl(168, 55%, 38%)", accent: "hsl(36, 80%, 56%)", bg: "hsl(40, 33%, 97%)" },
  },
  {
    id: "farming", name: "Country Life", description: "Earthy greens & warm browns — fields & hedgerows",
    icon: "🚜", preview: "Farming",
    colors: { primary: "hsl(120, 35%, 35%)", accent: "hsl(30, 60%, 45%)", bg: "hsl(45, 30%, 96%)" },
  },
  {
    id: "aviation", name: "Clear Skies", description: "Aviation blues & cloud whites — cockpit inspired",
    icon: "✈️", preview: "Aviation",
    colors: { primary: "hsl(210, 60%, 40%)", accent: "hsl(45, 90%, 55%)", bg: "hsl(210, 20%, 97%)" },
  },
  {
    id: "ocean", name: "Deep Blue", description: "Ocean depths & coral accents — seaside vibes",
    icon: "🌊", preview: "Ocean",
    colors: { primary: "hsl(195, 55%, 35%)", accent: "hsl(15, 80%, 55%)", bg: "hsl(200, 25%, 97%)" },
  },
  {
    id: "sunset", name: "Golden Hour", description: "Warm oranges & deep purples — evening glow",
    icon: "🌅", preview: "Sunset",
    colors: { primary: "hsl(25, 75%, 50%)", accent: "hsl(280, 50%, 50%)", bg: "hsl(30, 30%, 97%)" },
  },
];

const Themes = () => {
  const [activeTheme, setActiveTheme] = useState("default");

  return (
    <FeaturePageShell title="Themes" subtitle="Choose your visual experience" icon={<Palette className="w-5 h-5" />}>
      <p className="text-xs text-muted-foreground mb-5 px-1">
        Themes change icons, colours, and the overall feel of the app. Pick one that suits you.
      </p>

      <div className="space-y-3">
        {THEMES.map((theme, i) => {
          const isActive = activeTheme === theme.id;
          return (
            <motion.button
              key={theme.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 * i }}
              onClick={() => setActiveTheme(theme.id)}
              className={`w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] ${
                isActive ? "border-primary shadow-card bg-card" : "border-border/50 bg-card/50 hover:bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{theme.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-card-foreground">{theme.name}</p>
                    {isActive && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{theme.description}</p>
                </div>
              </div>
              {/* Color preview */}
              <div className="flex gap-2 mt-3">
                <div className="h-6 flex-1 rounded-lg" style={{ backgroundColor: theme.colors.primary }} />
                <div className="h-6 flex-1 rounded-lg" style={{ backgroundColor: theme.colors.accent }} />
                <div className="h-6 flex-1 rounded-lg border border-border" style={{ backgroundColor: theme.colors.bg }} />
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-5">
        Full theme switching will apply once connected to your backend.
      </p>
    </FeaturePageShell>
  );
};

export default Themes;

import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Palette, Check } from "lucide-react";
import { motion } from "framer-motion";
import { APP_THEMES, LOADER_PRESETS, hexToHsl, hslToHex } from "@/lib/appThemes";
import { useAppearance } from "@/hooks/useAppearance";

const Themes = () => {
  const {
    themeId, customPrimary, customAccent, loader,
    theme, setThemeId, setCustomColors, setLoaderPreset, setLoaderEmojis,
  } = useAppearance();

  const lifestyle = APP_THEMES.filter((t) => t.kind === "lifestyle");
  const colours = APP_THEMES.filter((t) => t.kind === "colour");
  const primaryHex = hslToHex(customPrimary || theme.light.primary);
  const accentHex = hslToHex(customAccent || theme.light.gold);

  return (
    <FeaturePageShell title="Themes" subtitle="Choose your visual experience" icon={<Palette className="w-5 h-5" />}>
      <p className="text-xs text-muted-foreground mb-5 px-1">
        Themes change the header, navigation, colours, decorations and loading animals — not just the page background.
      </p>

      <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Lifestyle</h2>
      <div className="space-y-3 mb-6">
        {lifestyle.map((t, i) => {
          const isActive = themeId === t.id;
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i }}
              onClick={() => setThemeId(t.id)}
              className={`w-full p-4 rounded-xl border text-left transition-all active:scale-[0.98] ${
                isActive ? "border-primary shadow-card bg-card" : "border-border/50 bg-card/50 hover:bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-card-foreground">{t.name}</p>
                    {isActive && (
                      <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        <Check className="w-3 h-3" /> Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <div className="h-6 flex-1 rounded-lg" style={{ backgroundColor: `hsl(${t.light.primary})` }} />
                <div className="h-6 flex-1 rounded-lg" style={{ backgroundColor: `hsl(${t.light.gold})` }} />
                <div className="h-6 flex-1 rounded-lg border border-border" style={{ backgroundColor: `hsl(${t.light.background})` }} />
              </div>
            </motion.button>
          );
        })}
      </div>

      <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Colours</h2>
      <div className="grid grid-cols-2 gap-2 mb-6">
        {colours.map((t) => {
          const isActive = themeId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setThemeId(t.id)}
              className={`p-3 rounded-xl border text-left transition-all ${
                isActive ? "border-primary shadow-card bg-card" : "border-border/50 bg-card/50 hover:bg-card"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{t.icon}</span>
                <p className="text-sm font-semibold">{t.name}</p>
                {isActive && <Check className="w-3.5 h-3.5 text-primary ml-auto" />}
              </div>
              <div className="flex gap-1.5">
                <div className="h-5 flex-1 rounded-md" style={{ backgroundColor: `hsl(${t.light.primary})` }} />
                <div className="h-5 flex-1 rounded-md" style={{ backgroundColor: `hsl(${t.light.gold})` }} />
              </div>
            </button>
          );
        })}
      </div>

      <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Edit colours</h2>
      <div className="rounded-xl border border-border/50 bg-card p-4 mb-6 space-y-3">
        <p className="text-xs text-muted-foreground">Fine-tune the active theme. Changes apply everywhere.</p>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="color"
              value={primaryHex}
              onChange={(e) => setCustomColors(hexToHsl(e.target.value), customAccent)}
              className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-transparent"
            />
            Primary
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="color"
              value={accentHex}
              onChange={(e) => setCustomColors(customPrimary, hexToHsl(e.target.value))}
              className="w-9 h-9 rounded-lg border border-border cursor-pointer bg-transparent"
            />
            Accent
          </label>
        </div>
        {(customPrimary || customAccent) && (
          <button
            onClick={() => setCustomColors("", "")}
            className="text-xs font-semibold text-primary hover:underline"
          >
            Reset to theme defaults
          </button>
        )}
      </div>

      <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Loading animals</h2>
      <p className="text-xs text-muted-foreground mb-3">
        Shown while pages load. Lifestyle themes pick a matching pair — you can change it any time, or type your own emojis.
      </p>
      <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 pb-4">
        {LOADER_PRESETS.map((p) => {
          const selected = loader.left === p.left && loader.right === p.right;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setLoaderPreset(p.id)}
              className={`relative z-10 p-3 rounded-xl border text-center transition-all cursor-pointer ${
                selected ? "border-primary bg-primary/10 shadow-card" : "border-border/50 bg-card hover:bg-muted"
              }`}
            >
              <p className="text-2xl leading-none mb-1.5 pointer-events-none">{p.left}{p.right}</p>
              <p className="text-[11px] font-semibold pointer-events-none">{p.label}</p>
            </button>
          );
        })}
      </div>
      <div className="relative z-10 rounded-xl border border-border/50 bg-card p-4 space-y-2">
        <p className="text-xs font-semibold">Custom pair</p>
        <div className="flex items-center gap-2">
          <input
            value={loader.left}
            onChange={(e) => setLoaderEmojis(e.target.value, loader.right)}
            className="h-12 w-16 rounded-xl border border-border bg-background text-center text-2xl"
            maxLength={8}
          />
          <input
            value={loader.right}
            onChange={(e) => setLoaderEmojis(loader.left, e.target.value)}
            className="h-12 w-16 rounded-xl border border-border bg-background text-center text-2xl"
            maxLength={8}
          />
          <p className="text-xs text-muted-foreground">Tap a preset above, or type any two emojis.</p>
        </div>
      </div>
    </FeaturePageShell>
  );
};

export default Themes;

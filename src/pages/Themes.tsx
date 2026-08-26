import { useState } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Palette, Check, PanelTop, Sun, Loader2, CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { APP_THEMES, LOADER_PRESETS, hexToHsl, hslToHex } from "@/lib/appThemes";
import { HEADER_COLOR_PRESETS } from "@/lib/chromeScenes";
import { useAppearance } from "@/hooks/useAppearance";
import { ChromeScenePicker, ChromeColorPicker } from "@/components/chrome/ChromeScenePicker";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import { useHouseholdPhotos } from "@/hooks/useHouseholdPhotos";
import { useNavigate } from "react-router-dom";

type SectionId = "themes" | "header" | "greeting" | "loader" | "today";

const SECTIONS: { id: SectionId; label: string; icon: typeof Palette }[] = [
  { id: "themes", label: "Themes", icon: Palette },
  { id: "header", label: "Header", icon: PanelTop },
  { id: "greeting", label: "Greeting", icon: Sun },
  { id: "loader", label: "Loading", icon: Loader2 },
  { id: "today", label: "Today", icon: CalendarDays },
];

function PhotoField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const { activeHouseholdId } = useActiveHousehold();
  const { photos } = useHouseholdPhotos(activeHouseholdId);

  return (
    <div className="space-y-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Picture URL (optional)"
        className="h-10 rounded-xl"
      />
      {photos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => onChange("")}
            className={`h-12 w-12 shrink-0 rounded-xl border text-[10px] font-semibold ${!value ? "border-primary" : "border-border"}`}
          >
            None
          </button>
          {photos.slice(0, 12).map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onChange(photo.url)}
              className={`h-12 w-12 shrink-0 overflow-hidden rounded-xl border ${value === photo.url ? "border-primary ring-2 ring-primary/30" : "border-border"}`}
            >
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const Themes = () => {
  const navigate = useNavigate();
  const [section, setSection] = useState<SectionId>("themes");
  const {
    themeId, customPrimary, customAccent, loader,
    theme, setThemeId, setCustomColors, setLoaderPreset, setLoaderEmojis,
    headerScene, headerColor, headerPhotoUrl, headerShowWeather, headerShowDate, headerShowTime, setHeaderDisplay,
    greetingScene, greetingColor, greetingPhotoUrl, greetingMatchHeader, setGreetingDisplay,
  } = useAppearance();

  const lifestyle = APP_THEMES.filter((t) => t.kind === "lifestyle");
  const colours = APP_THEMES.filter((t) => t.kind === "colour");
  const primaryHex = hslToHex(customPrimary || theme.light.primary);
  const accentHex = hslToHex(customAccent || theme.light.gold);

  return (
    <FeaturePageShell title="Display / Themes" subtitle="Colours, header, loading icons and Today" icon={<Palette className="w-5 h-5" />}>
      <div className="flex min-w-0 gap-3 lg:gap-4">
        <aside className="w-[3.5rem] shrink-0 sm:w-[10.75rem]">
          <nav aria-label="Display sections" className="sticky top-2 space-y-1 rounded-2xl border border-border/50 bg-card p-1.5 shadow-card">
            {SECTIONS.map((item) => {
              const Icon = item.icon;
              const active = section === item.id;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setSection(item.id)}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-2 rounded-xl border px-1.5 py-2 text-left transition sm:px-2 ${
                    active ? "border-primary/45 bg-primary/10 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  }`}
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${active ? "bg-gradient-primary text-primary-foreground" : "bg-muted"}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="hidden min-w-0 text-xs font-semibold sm:block">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 flex-1">
          {section === "themes" && (
            <>
              <p className="text-xs text-muted-foreground mb-5 px-1">
                Themes change the app colours and decorations. Header, greeting and loading icons have their own sections.
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
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
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
                  <button onClick={() => setCustomColors("", "")} className="text-xs font-semibold text-primary hover:underline">
                    Reset to theme defaults
                  </button>
                )}
              </div>
            </>
          )}

          {section === "header" && (
            <div className="space-y-6">
              <p className="text-xs text-muted-foreground">
                Live weather follows what’s outside. Seasons follow the time of year. The rest are atmospheres — not extra weather types.
              </p>
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Animation</h2>
                <ChromeScenePicker value={headerScene} includeAuto onChange={(id) => setHeaderDisplay({ headerScene: id })} />
              </div>
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Colour</h2>
                <ChromeColorPicker value={headerColor} presets={HEADER_COLOR_PRESETS} onChange={(value) => setHeaderDisplay({ headerColor: value })} />
              </div>
              <div>
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Picture</h2>
                <PhotoField value={headerPhotoUrl} onChange={(url) => setHeaderDisplay({ headerPhotoUrl: url })} />
              </div>
              <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                <label className="flex items-center justify-between gap-3 text-sm font-medium">
                  Show date
                  <Switch checked={headerShowDate} onCheckedChange={(v) => setHeaderDisplay({ headerShowDate: v })} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm font-medium">
                  Show time
                  <Switch checked={headerShowTime} onCheckedChange={(v) => setHeaderDisplay({ headerShowTime: v })} />
                </label>
                <label className="flex items-center justify-between gap-3 text-sm font-medium">
                  Show current weather
                  <Switch checked={headerShowWeather} onCheckedChange={(v) => setHeaderDisplay({ headerShowWeather: v })} />
                </label>
              </div>
            </div>
          )}

          {section === "greeting" && (
            <div className="space-y-6">
              <p className="text-xs text-muted-foreground">
                The Good morning / Good evening box on the dashboard. Same atmospheres as the header — live weather and seasons included.
              </p>
              <div className="rounded-xl border border-border/50 bg-card p-4">
                <label className="flex items-center justify-between gap-3 text-sm font-medium">
                  Match header
                  <Switch checked={greetingMatchHeader} onCheckedChange={(v) => setGreetingDisplay({ greetingMatchHeader: v })} />
                </label>
                <p className="text-xs text-muted-foreground mt-1">Use the same animation, colour and picture as the header.</p>
              </div>
              {!greetingMatchHeader && (
                <>
                  <div>
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Animation</h2>
                    <ChromeScenePicker value={greetingScene} onChange={(id) => setGreetingDisplay({ greetingScene: id })} />
                  </div>
                  <div>
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Colour</h2>
                    <ChromeColorPicker value={greetingColor} presets={HEADER_COLOR_PRESETS} onChange={(value) => setGreetingDisplay({ greetingColor: value })} />
                  </div>
                  <div>
                    <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Picture</h2>
                    <PhotoField value={greetingPhotoUrl} onChange={(url) => setGreetingDisplay({ greetingPhotoUrl: url })} />
                  </div>
                </>
              )}
            </div>
          )}

          {section === "loader" && (
            <>
              <h2 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Loading icons</h2>
              <p className="text-xs text-muted-foreground mb-3">
                Shown while pages load. Tap a pair, or type your own emojis.
              </p>
              <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-2 pb-4">
                {LOADER_PRESETS.map((p) => {
                  const selected = loader.id === p.id && loader.left === p.left && loader.right === p.right;
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
            </>
          )}

          {section === "today" && (
            <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-card space-y-3">
              <p className="text-sm font-semibold">Today page</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Add, hide and rearrange widgets on Today itself. Edit mode also lets you tint each tile. New widgets include calendar, birthdays, weather, photos, bills and the family message board.
              </p>
              <button
                type="button"
                onClick={() => navigate("/today")}
                className="w-full h-11 rounded-xl bg-gradient-primary text-primary-foreground text-sm font-semibold shadow-card"
              >
                Open Today
              </button>
            </div>
          )}
        </div>
      </div>
    </FeaturePageShell>
  );
};

export default Themes;

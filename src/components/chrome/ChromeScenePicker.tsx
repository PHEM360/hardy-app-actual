import { CHROME_SCENES, normalizeChromeScene, type ChromeSceneId } from "@/lib/chromeScenes";

export function ChromeScenePicker({
  value,
  onChange,
  includeAuto,
}: {
  value: string;
  onChange: (id: string) => void;
  includeAuto?: boolean;
}) {
    const options = includeAuto
    ? [{ id: "auto" as const, label: "Match theme", emoji: "🎨", hint: undefined as string | undefined }, ...CHROME_SCENES]
    : CHROME_SCENES;
  const current = value === "auto" ? "auto" : (normalizeChromeScene(value) ?? value);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {options.map((scene) => {
        const selected = current === scene.id;
        return (
          <button
            key={scene.id}
            type="button"
            onClick={() => onChange(scene.id)}
            className={`p-3 rounded-xl border text-left transition-all ${
              selected ? "border-primary bg-primary/10 shadow-card" : "border-border/50 bg-card hover:bg-muted"
            }`}
          >
            <p className="text-lg leading-none mb-1">{scene.emoji}</p>
            <p className="text-[11px] font-semibold">{scene.label}</p>
            {"hint" in scene && scene.hint && (
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{scene.hint}</p>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ChromeColorPicker({
  value,
  presets,
  onChange,
}: {
  value: string;
  presets: { id: string; label: string; value: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => {
        const selected = (value || "") === preset.value;
        return (
          <button
            key={preset.id}
            type="button"
            title={preset.label}
            onClick={() => onChange(preset.value)}
            className={`h-9 min-w-9 px-2 rounded-xl border text-[10px] font-semibold transition ${
              selected ? "border-primary ring-2 ring-primary/30" : "border-border/60"
            }`}
            style={{
              background: preset.value || "var(--chrome-header, var(--gradient-hero))",
              color: "#fff",
            }}
          >
            {preset.label}
          </button>
        );
      })}
      <label className="h-9 w-9 rounded-xl border border-border overflow-hidden cursor-pointer">
        <input
          type="color"
          aria-label="Custom colour"
          value={value.startsWith("#") ? value : "#1f4d4a"}
          onChange={(e) => onChange(e.target.value)}
          className="h-12 w-12 -m-1 cursor-pointer border-0 bg-transparent"
        />
      </label>
    </div>
  );
}

export type { ChromeSceneId };

import { ChromeSceneLayer } from "@/components/chrome/ChromeSceneLayer";
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
  const previewId = current === "auto" ? "silk" : (current as ChromeSceneId);

  return (
    <div className="space-y-3">
      <div className="relative h-32 overflow-hidden rounded-2xl border border-border/40 shadow-card sm:h-40">
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, #1a2844, #0c1224)" }}
        />
        {previewId !== "none" && <ChromeSceneLayer scene={previewId} density="full" />}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent px-3 py-2">
          <p className="text-xs font-semibold text-white">
            {options.find((scene) => scene.id === current)?.label ?? "Header"}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((scene) => {
          const selected = current === scene.id;
          return (
            <button
              key={scene.id}
              type="button"
              onClick={() => onChange(scene.id)}
              className={`rounded-xl border p-3 text-left transition-all ${
                selected ? "border-primary bg-primary/10 shadow-card" : "border-border/50 bg-card hover:bg-muted"
              }`}
            >
              <p className="mb-1 text-lg leading-none">{scene.emoji}</p>
              <p className="text-[11px] font-semibold">{scene.label}</p>
              {"hint" in scene && scene.hint && (
                <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground">{scene.hint}</p>
              )}
            </button>
          );
        })}
      </div>
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
            className={`h-9 min-w-9 rounded-xl border px-2 text-[10px] font-semibold transition ${
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
      <label className="h-9 w-9 cursor-pointer overflow-hidden rounded-xl border border-border">
        <input
          type="color"
          aria-label="Custom colour"
          value={value.startsWith("#") ? value : "#1f4d4a"}
          onChange={(e) => onChange(e.target.value)}
          className="-m-1 h-12 w-12 cursor-pointer border-0 bg-transparent"
        />
      </label>
    </div>
  );
}

export type { ChromeSceneId };

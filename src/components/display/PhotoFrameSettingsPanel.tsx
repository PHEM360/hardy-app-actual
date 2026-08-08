import { useRef, useState } from "react";
import { Upload, Trash2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import type { PhotoFrameSettings } from "@/hooks/useDeviceSettings";
import type { HouseholdPhoto } from "@/hooks/useHouseholdPhotos";

export function PhotoFrameSettingsPanel({
  settings,
  onChange,
  photos,
  photosLoading,
  onAddPhotos,
  onDeletePhoto,
  hasHousehold,
}: {
  settings: PhotoFrameSettings;
  onChange: (patch: Partial<PhotoFrameSettings>) => void;
  photos: HouseholdPhoto[];
  photosLoading: boolean;
  onAddPhotos: (files: File[]) => Promise<void>;
  onDeletePhoto: (photo: HouseholdPhoto) => void;
  hasHousehold: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  if (!hasHousehold) {
    return (
      <p className="text-sm text-muted-foreground">
        This display isn't linked to a household yet, so there's nowhere to store shared photos.
      </p>
    );
  }

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      await onAddPhotos(Array.from(files));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-sm">Show photo frame</span>
        <Switch checked={settings.enabled} onCheckedChange={(v) => onChange({ enabled: v })} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm">Time per photo</span>
          <span className="text-xs text-muted-foreground">{settings.intervalSeconds}s</span>
        </div>
        <Slider
          value={[settings.intervalSeconds]}
          min={5}
          max={60}
          step={5}
          onValueChange={([v]) => onChange({ intervalSeconds: v })}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm">Shuffle</span>
        <Switch checked={settings.shuffle} onCheckedChange={(v) => onChange({ shuffle: v })} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm">Show captions</span>
        <Switch checked={settings.showCaptions} onCheckedChange={(v) => onChange({ showCaptions: v })} />
      </div>

      <div className="pt-2 border-t border-border space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">
            Household photos ({photos.length})
          </Label>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Uploading…" : "Add photos"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        {photosLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!photosLoading && photos.length === 0 && (
          <p className="text-xs text-muted-foreground">No photos yet — add some to enable the frame.</p>
        )}

        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((photo) => (
              <div key={photo.id} className="relative aspect-square rounded-lg overflow-hidden group bg-muted">
                <img src={photo.url} alt={photo.caption || ""} className="w-full h-full object-cover" />
                <button
                  onClick={() => onDeletePhoto(photo)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Delete photo"
                >
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

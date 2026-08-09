import { useState } from "react";
import { Plus, Tag as TagIcon, QrCode, MapPin } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/auth/AuthContext";
import { useDogTags, DEFAULT_TAG_PROFILE, type DogTag } from "@/hooks/useDogTags";
import { DogTagDesigner } from "@/components/pets/DogTagDesigner";
import { dogTagShapeStyle } from "@/lib/dogTagShapes";
import type { Pet } from "@/hooks/usePets";

function TagCard({ tag, onEdit }: { tag: DogTag; onEdit: () => void }) {
  const summary = [
    tag.profile.message && "Message",
    tag.profile.phones.length > 0 && `${tag.profile.phones.length} phone${tag.profile.phones.length > 1 ? "s" : ""}`,
    tag.profile.address && "Address",
    tag.profile.vetName && "Vet",
    tag.profile.sendLocation && "Location",
  ]
    .filter(Boolean)
    .join(" · ") || "No details set yet";

  const lastScan = tag.lastScanLocation;
  const lastScanAt =
    lastScan?.at && typeof (lastScan.at as { toDate?: () => Date }).toDate === "function"
      ? (lastScan.at as { toDate: () => Date }).toDate()
      : null;

  return (
    <div className="rounded-2xl border border-border/50 bg-card shadow-soft overflow-hidden">
      <button
        onClick={onEdit}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
      >
        <div
          className="w-11 h-11 flex-shrink-0 flex items-center justify-center border border-black/10 shadow-sm"
          style={{ backgroundColor: tag.bgColor, ...dogTagShapeStyle(tag.shape) }}
        >
          <QrCode className="w-5 h-5" style={{ color: tag.fgColor }} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">{tag.label}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {tag.slug ? `/p/${tag.slug} · ` : ""}
            {summary}
          </p>
        </div>
      </button>
      {lastScan && (
        <a
          href={`https://www.google.com/maps?q=${lastScan.lat},${lastScan.lng}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-3 py-2 bg-amber-50 dark:bg-amber-950/30 border-t border-amber-200/60 dark:border-amber-900/50 text-[11px] text-amber-700 dark:text-amber-400"
        >
          <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">
            Last scanned {lastScanAt ? formatDistanceToNow(lastScanAt, { addSuffix: true }) : "recently"}
            {lastScan.placeName ? ` near ${lastScan.placeName}` : ""} · View on map
          </span>
        </a>
      )}
    </div>
  );
}

function PetTagsGroup({ pet }: { pet: Pet }) {
  const { user } = useAuth();
  const { tags, loading, addTag, updateTag, regenerateCode, deleteTag, claimSlug } = useDogTags(pet.id);
  const [editingTag, setEditingTag] = useState<DogTag | null>(null);
  const [creating, setCreating] = useState(false);

  const handleNewTag = async () => {
    setCreating(true);
    try {
      const ownerId = pet.ownerId || user?.uid || "";
      const label = tags.length > 0 ? `Tag ${tags.length + 1}` : "Collar tag";
      const id = await addTag(ownerId, { label, stickerText: pet.name });
      if (id) {
        setEditingTag({
          id,
          petId: pet.id,
          ownerId,
          label,
          code: "",
          slug: "",
          shape: "rounded",
          bgColor: "#ffffff",
          fgColor: "#000000",
          stickerText: pet.name,
          sizeCm: 3.5,
          qrSizeCm: 1.8,
          stickerTextSizeCm: 0.35,
          backText: "",
          backTextSizeCm: 0.4,
          profile: DEFAULT_TAG_PROFILE,
          lastScanLocation: null,
        });
      }
    } finally {
      setCreating(false);
    }
  };

  // Once the live listener catches up with a freshly-created tag (which has
  // a real `code`), swap the editor over to that synced copy so "Regenerate"
  // etc. always act on real Firestore data, not the optimistic placeholder.
  const liveEditingTag = editingTag ? tags.find((t) => t.id === editingTag.id) ?? editingTag : null;

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span>{pet.avatar}</span>
          <p className="text-sm font-semibold">{pet.name}</p>
        </div>
        <Button
          size="sm"
          onClick={handleNewTag}
          disabled={creating}
          className="h-8 rounded-xl gap-1.5 text-xs px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white border-0"
        >
          <Plus className="w-3.5 h-3.5" /> {creating ? "Creating…" : "New tag"}
        </Button>
      </div>

      {!loading && tags.length === 0 && (
        <p className="text-xs text-muted-foreground pl-0.5">No tags yet for {pet.name}.</p>
      )}

      {tags.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {tags.map((tag) => (
            <TagCard key={tag.id} tag={tag} onEdit={() => setEditingTag(tag)} />
          ))}
        </div>
      )}

      {liveEditingTag && (
        <DogTagDesigner
          pet={pet}
          tag={liveEditingTag}
          onClose={() => setEditingTag(null)}
          onSave={async (patch) => {
            await updateTag(liveEditingTag.id, patch);
          }}
          onRegenerate={async () => {
            await regenerateCode(liveEditingTag.id);
          }}
          onDelete={() => {
            deleteTag(liveEditingTag.id);
            setEditingTag(null);
          }}
          onClaimSlug={(rawSlug) => claimSlug(liveEditingTag.ownerId, liveEditingTag.id, rawSlug)}
        />
      )}
    </div>
  );
}

export function DogTagsSection({ pets }: { pets: Pet[] }) {
  if (pets.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
        <span className="w-5 h-5 rounded-md bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
          <TagIcon className="w-3 h-3" />
        </span>
        Dog Tags
      </h3>
      <div className="p-4 rounded-xl bg-card border border-orange-200/50 dark:border-orange-900/40 shadow-soft space-y-5">
        <p className="text-xs text-muted-foreground -mt-1">
          Printable QR stickers for a collar. Scanning one shows a message, phone numbers, address, vet
          details and more — and can email you the finder's location.
        </p>
        {pets.map((pet) => (
          <PetTagsGroup key={pet.id} pet={pet} />
        ))}
      </div>
    </div>
  );
}

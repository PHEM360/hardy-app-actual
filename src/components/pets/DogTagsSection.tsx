import { useState } from "react";
import { Plus, Tag as TagIcon, QrCode } from "lucide-react";
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

  return (
    <button
      onClick={onEdit}
      className="flex items-center gap-3 p-3 rounded-2xl border border-border/50 bg-card shadow-soft text-left hover:border-primary/40 transition-colors"
    >
      <div
        className="w-11 h-11 flex-shrink-0 flex items-center justify-center border border-border/40"
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
          profile: DEFAULT_TAG_PROFILE,
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
        <Button size="sm" variant="outline" onClick={handleNewTag} disabled={creating} className="h-8 rounded-xl gap-1.5 text-xs px-3">
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
        <span className="w-5 h-5 rounded-md bg-amber-600 flex items-center justify-center text-white">
          <TagIcon className="w-3 h-3" />
        </span>
        Dog Tags
      </h3>
      <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-5">
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

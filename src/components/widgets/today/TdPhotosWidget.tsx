import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import { useHouseholdPhotos } from "@/hooks/useHouseholdPhotos";
import { TdHead } from "./TdHead";

export function TdPhotosWidget() {
  const navigate = useNavigate();
  const { activeHouseholdId } = useActiveHousehold();
  const { photos, loading } = useHouseholdPhotos(activeHouseholdId);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (photos.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), 8000);
    return () => window.clearInterval(timer);
  }, [photos.length]);

  const photo = photos[index];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-3 pt-3">
        <TdHead
          emoji="🖼️"
          title="Photos"
          action={
            <button type="button" onClick={() => navigate("/households")} className="text-[11px] text-primary font-medium">
              Album
            </button>
          }
        />
      </div>
      <div className="flex-1 min-h-0 mx-3 mb-3 rounded-xl overflow-hidden bg-muted">
        {loading && <p className="text-xs text-muted-foreground p-3">Loading…</p>}
        {!loading && !photo && (
          <button type="button" onClick={() => navigate("/households")} className="w-full h-full text-xs text-muted-foreground">
            No household photos yet
          </button>
        )}
        {photo && (
          <img src={photo.url} alt={photo.caption || "Family photo"} className="w-full h-full object-cover" />
        )}
      </div>
    </div>
  );
}

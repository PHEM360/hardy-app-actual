import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { getDogTagProfileBySlug, reportDogTagScan, type DogTagPublicInfoBySlug } from "@/lib/dogTagApi";
import { DogTagInvalidCard, DogTagProfileView, type LocationPhase } from "@/components/pets/DogTagProfileView";

export default function TagScanBySlug() {
  const { slug } = useParams<{ slug: string }>();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<DogTagPublicInfoBySlug | null>(null);
  const [locationPhase, setLocationPhase] = useState<LocationPhase>("idle");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!slug) {
        setLoading(false);
        return;
      }
      try {
        const result = await getDogTagProfileBySlug(slug);
        if (!cancelled) setInfo(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const requestLocation = useCallback(() => {
    if (!info?.petId || !info?.tagId) return;
    if (!navigator.geolocation) {
      setLocationPhase("error");
      return;
    }
    setLocationPhase("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await reportDogTagScan(info.petId!, info.tagId!, pos.coords.latitude, pos.coords.longitude);
          setLocationPhase("sent");
        } catch {
          setLocationPhase("error");
        }
      },
      (err) => {
        setLocationPhase(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [info]);

  useEffect(() => {
    if (info?.valid && info.profile?.sendLocation) requestLocation();
    // Only auto-run once when the tag info first loads — retries are manual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {loading ? (
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      ) : !info?.valid ? (
        <DogTagInvalidCard />
      ) : (
        <DogTagProfileView info={info} locationPhase={locationPhase} onRetryLocation={requestLocation} />
      )}
    </div>
  );
}

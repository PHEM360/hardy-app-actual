import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  getDogTagProfileBySlug,
  getDogTagProfileByShortCode,
  reportDogTagScan,
  type DogTagPublicInfoBySlug,
} from "@/lib/dogTagApi";
import { DogTagInvalidCard, DogTagProfileView, type LocationPhase } from "@/components/pets/DogTagProfileView";

/**
 * Serves both friendly /p/:slug links and the short /t/:code links that dog
 * tag QR codes encode. Short codes arrive uppercase from the QR (see
 * tagQrValue) but are normalised so a hand-typed lowercase one works too.
 */
export default function TagScanBySlug({ kind = "slug" }: { kind?: "slug" | "short" }) {
  const { slug: rawSlug } = useParams<{ slug: string }>();
  const slug = kind === "short" ? rawSlug?.toUpperCase() : rawSlug;

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
        const result = kind === "short" ? await getDogTagProfileByShortCode(slug) : await getDogTagProfileBySlug(slug);
        if (!cancelled) setInfo(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [slug, kind]);

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
          await reportDogTagScan(
            info.petId!,
            info.tagId!,
            pos.coords.latitude,
            pos.coords.longitude,
            undefined,
            kind === "short" ? slug : undefined
          );
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
  }, [info, kind, slug]);

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

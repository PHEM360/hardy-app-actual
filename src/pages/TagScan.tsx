import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { PawPrint, Phone, MessageSquare, Globe, MapPin, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDogTagPublicInfo, reportDogTagScan, type DogTagPublicInfo } from "@/lib/dogTagApi";
import { dogTagShapeStyle } from "@/lib/dogTagShapes";

type LocationPhase = "idle" | "requesting" | "sent" | "denied" | "error";

export default function TagScan() {
  const { petId, tagId } = useParams<{ petId: string; tagId: string }>();
  const [params] = useSearchParams();
  const code = params.get("c") || "";

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<DogTagPublicInfo | null>(null);
  const [locationPhase, setLocationPhase] = useState<LocationPhase>("idle");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!petId || !tagId || !code) {
        setLoading(false);
        return;
      }
      try {
        const result = await getDogTagPublicInfo(petId, tagId, code);
        if (cancelled) return;
        setInfo(result);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [petId, tagId, code]);

  const requestLocation = useCallback(() => {
    if (!petId || !tagId) return;
    if (!navigator.geolocation) {
      setLocationPhase("error");
      return;
    }
    setLocationPhase("requesting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          await reportDogTagScan(petId, tagId, code, pos.coords.latitude, pos.coords.longitude);
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
  }, [petId, tagId, code]);

  useEffect(() => {
    if (info?.valid && info.actions?.sendLocation) requestLocation();
    // Only auto-run once when the tag info first loads — retries are manual (see "Try again").
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!info?.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-border/40 p-6 text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-amber-500" />
          </div>
          <p className="font-semibold text-sm">This tag isn't active</p>
          <p className="text-xs text-muted-foreground">
            It may have been replaced with a new one. There's nothing more to do here.
          </p>
        </div>
      </div>
    );
  }

  const { actions } = info;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-border/40 overflow-hidden">
        <div
          className="px-6 py-6 flex flex-col items-center gap-2 text-center"
          style={{ backgroundColor: info.bgColor || "#f5f5f5" }}
        >
          <div
            className="w-14 h-14 flex items-center justify-center border border-black/10"
            style={dogTagShapeStyle(info.shape || "rounded")}
          >
            <PawPrint className="w-7 h-7" style={{ color: info.fgColor || "#000" }} />
          </div>
          <p className="font-bold text-lg" style={{ color: info.fgColor || "#000" }}>
            {info.petName}
          </p>
        </div>

        <div className="px-6 py-6 space-y-4">
          {actions?.showMessage && actions.message && (
            <div className="flex items-start gap-3">
              <MessageSquare className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground leading-relaxed">{actions.message}</p>
            </div>
          )}

          {actions?.showPhone && actions.phoneNumber && (
            <a
              href={`tel:${actions.phoneNumber.replace(/\s/g, "")}`}
              className="flex items-center gap-3 p-3 rounded-2xl bg-primary/5 border border-primary/20"
            >
              <Phone className="w-4 h-4 text-primary flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{actions.phoneNumber}</p>
                {actions.contactName && <p className="text-xs text-muted-foreground">{actions.contactName}</p>}
              </div>
            </a>
          )}

          {actions?.showWebpage && actions.webpageUrl && (
            <a
              href={actions.webpageUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-3 rounded-2xl border border-border"
            >
              <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <p className="text-sm text-foreground truncate">{actions.webpageUrl}</p>
            </a>
          )}

          {actions?.sendLocation && (
            <div className="flex items-start gap-3 pt-2 border-t border-border/50">
              <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                {locationPhase === "requesting" && (
                  <p className="text-xs text-muted-foreground">Getting your location to let the owner know…</p>
                )}
                {locationPhase === "sent" && (
                  <p className="text-xs text-green-600 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Thanks — {info.petName}'s family have been sent your location.
                  </p>
                )}
                {locationPhase === "denied" && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Location access was denied, so the owner hasn't been sent your location.
                    </p>
                    <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={requestLocation}>
                      Try again
                    </Button>
                  </div>
                )}
                {locationPhase === "error" && (
                  <p className="text-xs text-muted-foreground">Couldn't get your location right now.</p>
                )}
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground text-center pt-2">Thank you for helping reunite a lost pet 🐾</p>
        </div>
      </div>
    </div>
  );
}

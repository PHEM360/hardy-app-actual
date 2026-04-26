import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MapPin, Mail, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const REPORT_EMAIL = "contact@bgm-medical.com";

type Phase = "idle" | "requesting" | "building" | "done" | "error" | "denied";

export default function Locate() {
  const [params] = useSearchParams();
  const qrName = params.get("n") || "QR Code";

  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [mapsUrl, setMapsUrl] = useState("");

  const requestAndSend = () => {
    if (!navigator.geolocation) {
      setPhase("error");
      setErrorMsg("Your device does not support location services.");
      return;
    }
    setPhase("requesting");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPhase("building");
        const { latitude: lat, longitude: lng, accuracy } = pos.coords;
        const mapsLink = `https://www.google.com/maps?q=${lat},${lng}`;
        setMapsUrl(mapsLink);

        const now = new Date().toLocaleString("en-GB", {
          dateStyle: "full",
          timeStyle: "short",
        });

        const subject = encodeURIComponent(`📍 Location Report — ${qrName}`);
        const body = encodeURIComponent(
          `A QR code was scanned and location has been shared.\n\n` +
          `QR Code: ${qrName}\n` +
          `Time: ${now}\n\n` +
          `Coordinates: ${lat.toFixed(6)}, ${lng.toFixed(6)}\n` +
          `Accuracy: ±${Math.round(accuracy)} metres\n\n` +
          `View on Google Maps:\n${mapsLink}\n`
        );

        const mailto = `mailto:${REPORT_EMAIL}?subject=${subject}&body=${body}`;
        window.location.href = mailto;
        setPhase("done");
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setPhase("denied");
        } else {
          setPhase("error");
          setErrorMsg(err.message || "Could not get location.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  // Auto-trigger on mount
  useEffect(() => {
    requestAndSend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-border/40 overflow-hidden">

        {/* Header band */}
        <div className="bg-primary px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Location Report</p>
            <p className="text-white/70 text-[11px] leading-tight mt-0.5">{qrName}</p>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">

          {/* Idle / requesting */}
          {(phase === "idle" || phase === "requesting") && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-7 h-7 text-primary animate-spin" />
              </div>
              <div>
                <p className="font-semibold text-sm">Getting your location…</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Please allow location access when prompted.
                </p>
              </div>
            </div>
          )}

          {/* Building mailto */}
          {phase === "building" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center">
                <Mail className="w-7 h-7 text-blue-500" />
              </div>
              <div>
                <p className="font-semibold text-sm">Opening your mail app…</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  A pre-filled email is ready to send to {REPORT_EMAIL}.
                  Tap <strong>Send</strong> to share your location.
                </p>
              </div>
            </div>
          )}

          {/* Done */}
          {phase === "done" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-sm">Location ready to send</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Your mail app should have opened. Tap <strong>Send</strong> to report your location.
                </p>
              </div>
              <div className="w-full flex flex-col gap-2">
                {mapsUrl && (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
                  >
                    <MapPin className="w-4 h-4" /> View my location
                  </a>
                )}
                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={requestAndSend}
                >
                  Resend
                </Button>
              </div>
            </div>
          )}

          {/* Permission denied */}
          {phase === "denied" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-amber-500" />
              </div>
              <div>
                <p className="font-semibold text-sm">Location access denied</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Please allow location access in your browser settings, then try again.
                </p>
              </div>
              <Button className="w-full rounded-xl" onClick={requestAndSend}>
                Try again
              </Button>
            </div>
          )}

          {/* Error */}
          {phase === "error" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-sm">Could not get location</p>
                <p className="text-[12px] text-muted-foreground mt-1">{errorMsg}</p>
              </div>
              <Button className="w-full rounded-xl" onClick={requestAndSend}>
                Try again
              </Button>
            </div>
          )}

          {/* Footer note */}
          <p className="text-[10px] text-muted-foreground text-center">
            Location data is sent only to {REPORT_EMAIL} and is not stored.
          </p>
        </div>
      </div>
    </div>
  );
}

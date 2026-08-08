import { PawPrint, Phone, MessageCircle, MapPin, Stethoscope, Globe, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dogTagShapeStyle } from "@/lib/dogTagShapes";
import type { DogTagPublicInfo } from "@/lib/dogTagApi";

export type LocationPhase = "idle" | "requesting" | "sent" | "denied" | "error";

export function DogTagInvalidCard() {
  return (
    <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-border/40 p-6 text-center space-y-3">
      <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto">
        <AlertCircle className="w-7 h-7 text-amber-500" />
      </div>
      <p className="font-semibold text-sm">This tag isn't active</p>
      <p className="text-xs text-muted-foreground">
        It may have been replaced with a new one. There's nothing more to do here.
      </p>
    </div>
  );
}

function telHref(number: string) {
  return `tel:${number.replace(/\s/g, "")}`;
}
function smsHref(number: string) {
  return `sms:${number.replace(/\s/g, "")}`;
}

export function DogTagProfileView({
  info,
  locationPhase,
  onRetryLocation,
}: {
  info: DogTagPublicInfo;
  locationPhase: LocationPhase;
  onRetryLocation: () => void;
}) {
  const profile = info.profile;

  return (
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
        {profile?.message && (
          <div className="flex items-start gap-3">
            <MessageCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground leading-relaxed">{profile.message}</p>
          </div>
        )}

        {profile && profile.phones.length > 0 && (
          <div className="space-y-2">
            {profile.phones.map((phone) => (
              <div key={phone.id} className="flex items-center gap-2 p-3 rounded-2xl bg-primary/5 border border-primary/20">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{phone.number}</p>
                  {phone.label && <p className="text-xs text-muted-foreground truncate">{phone.label}</p>}
                </div>
                <a href={telHref(phone.number)} className="flex-shrink-0">
                  <Button size="sm" className="h-8 rounded-lg text-xs gap-1 px-2.5">
                    <Phone className="w-3.5 h-3.5" /> Call
                  </Button>
                </a>
                <a href={smsHref(phone.number)} className="flex-shrink-0">
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs gap-1 px-2.5">
                    <MessageCircle className="w-3.5 h-3.5" /> Text
                  </Button>
                </a>
              </div>
            ))}
          </div>
        )}

        {profile?.address && (
          <div className="flex items-start gap-3">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <p className="text-sm text-foreground whitespace-pre-line">{profile.address}</p>
          </div>
        )}

        {profile?.vetName && (
          <div className="flex items-start gap-3">
            <Stethoscope className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="text-sm text-foreground">
              <p className="font-medium">{profile.vetName}</p>
              {profile.vetPhone && (
                <a href={telHref(profile.vetPhone)} className="text-primary underline underline-offset-2">
                  {profile.vetPhone}
                </a>
              )}
              {profile.vetAddress && <p className="text-xs text-muted-foreground mt-0.5">{profile.vetAddress}</p>}
            </div>
          </div>
        )}

        {profile && profile.customFields.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {profile.customFields.map((field) => (
              <div key={field.id} className="p-2.5 rounded-xl bg-muted/40">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{field.label}</p>
                <p className="text-xs font-medium text-foreground">{field.value}</p>
              </div>
            ))}
          </div>
        )}

        {profile?.externalUrl && (
          <a
            href={profile.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 p-3 rounded-2xl border border-border"
          >
            <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <p className="text-sm text-foreground truncate">{profile.externalUrl}</p>
          </a>
        )}

        {profile?.sendLocation && (
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
                  <Button size="sm" variant="outline" className="rounded-lg text-xs h-8" onClick={onRetryLocation}>
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
  );
}

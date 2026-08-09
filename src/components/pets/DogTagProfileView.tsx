import { Phone, MessageCircle, MapPin, Stethoscope, Globe, CheckCircle2, AlertCircle, PartyPopper } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dogTagShapeStyle } from "@/lib/dogTagShapes";
import type { DogTagPublicInfo } from "@/lib/dogTagApi";

export type LocationPhase = "idle" | "requesting" | "sent" | "denied" | "error";

const LOGO_URL =
  "https://firebasestorage.googleapis.com/v0/b/hardyhub-7b30d.firebasestorage.app/o/App%20Icon.png?alt=media&token=aab46abd-0fff-477e-a7ce-6df736679001";

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
    <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl border border-black/5 overflow-hidden">
      <div
        className="px-6 pt-8 pb-7 flex flex-col items-center gap-3 text-center relative overflow-hidden"
        style={{
          background: `radial-gradient(circle at 30% 0%, ${info.bgColor || "#fef3c7"} 0%, #fde68a 45%, #fca5a5 100%)`,
        }}
      >
        <div
          className="absolute -top-6 -left-6 w-24 h-24 opacity-20"
          style={{ backgroundColor: info.fgColor || "#000", ...dogTagShapeStyle(info.shape || "rounded") }}
        />
        <img
          src={LOGO_URL}
          alt="Hardy Hub"
          className="w-24 h-24 rounded-full border-4 border-white shadow-lg relative z-10 object-cover"
        />
        <div className="relative z-10 space-y-1">
          <p className="flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider text-orange-800/70">
            <PartyPopper className="w-3.5 h-3.5" /> Great news!
          </p>
          <p className="font-extrabold text-2xl text-zinc-900 leading-tight">
            You've found {info.petName}!
          </p>
          <p className="text-xs text-zinc-700/80">Thank you for stopping to help 🐾</p>
        </div>
      </div>

      <div className="px-6 py-6 space-y-4">
        {profile?.message && (
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-amber-50 border border-amber-200/70">
            <MessageCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-zinc-800 leading-relaxed">{profile.message}</p>
          </div>
        )}

        {profile && profile.phones.length > 0 && (
          <div className="space-y-2">
            {profile.phones.map((phone) => (
              <div key={phone.id} className="rounded-2xl border border-border/60 overflow-hidden shadow-sm">
                <div className="px-3.5 pt-2.5 pb-2 bg-muted/30">
                  <p className="text-sm font-bold text-foreground">{phone.number}</p>
                  {phone.label && <p className="text-[11px] text-muted-foreground">{phone.label}</p>}
                </div>
                <div className="grid grid-cols-2">
                  <a href={telHref(phone.number)}>
                    <button className="w-full h-11 flex items-center justify-center gap-1.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-sm font-semibold hover:brightness-105 transition-all">
                      <Phone className="w-4 h-4" /> Call
                    </button>
                  </a>
                  <a href={smsHref(phone.number)}>
                    <button className="w-full h-11 flex items-center justify-center gap-1.5 bg-gradient-to-r from-sky-500 to-blue-500 text-white text-sm font-semibold hover:brightness-105 transition-all">
                      <MessageCircle className="w-4 h-4" /> Text
                    </button>
                  </a>
                </div>
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

        <p className="text-[10px] text-muted-foreground text-center pt-2">Powered by Hardy Hub 🐾</p>
      </div>
    </div>
  );
}

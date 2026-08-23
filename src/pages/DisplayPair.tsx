import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { MonitorSmartphone, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import DogLoader from "@/components/DogLoader";
import { useAuth } from "@/auth/AuthContext";
import { approveDevicePairing, denyDevicePairing, getDevicePairingStatus, type PairingStatus } from "@/lib/devicePairingApi";

type Phase = "checking" | "confirm" | "approving" | "approved" | "denying" | "denied" | "unavailable" | "error";

export default function DisplayPair() {
  const { pairingId } = useParams<{ pairingId: string }>();
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("checking");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (!pairingId) {
        setPhase("unavailable");
        return;
      }
      try {
        const status: PairingStatus = await getDevicePairingStatus(pairingId);
        if (cancelled) return;
        setPhase(status === "pending" ? "confirm" : "unavailable");
      } catch {
        if (!cancelled) setPhase("error");
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [pairingId]);

  const handleApprove = async () => {
    if (!pairingId) return;
    setPhase("approving");
    setErrorMsg(null);
    try {
      await approveDevicePairing(pairingId);
      setPhase("approved");
    } catch (err) {
      setErrorMsg((err as { message?: string })?.message || "Couldn't approve this display. Please try again.");
      setPhase("error");
    }
  };

  const handleDeny = async () => {
    if (!pairingId) return;
    setPhase("denying");
    try {
      await denyDevicePairing(pairingId);
      setPhase("denied");
    } catch {
      setPhase("denied");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border border-border/40 overflow-hidden">
        <div className="bg-primary px-6 py-5 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <MonitorSmartphone className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">Link a Display</p>
            <p className="text-white/70 text-[11px] leading-tight mt-0.5">Hardy Hub</p>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          {phase === "checking" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <DogLoader text="Checking this code…" />
            </div>
          )}

          {phase === "confirm" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <MonitorSmartphone className="w-7 h-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm">Link this display to your account?</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  This screen will be linked only to the account below. It will not change when you switch households on your phone.
                </p>
              </div>
              <div className="w-full rounded-2xl border border-primary/15 bg-primary/[0.06] px-4 py-3 text-left">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Account</p>
                <p className="text-sm font-medium mt-0.5 truncate">
                  {user?.displayName || user?.email || "Your Hardy Hub account"}
                </p>
                {user?.displayName && user.email && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{user.email}</p>
                )}
              </div>
              <p className="text-[11px] leading-relaxed text-muted-foreground -mt-1">
                Only approve a display you are setting up yourself. The code expires after five minutes and can be used once.
              </p>
              <div className="w-full flex flex-col gap-2 pt-1">
                <Button className="w-full rounded-xl" onClick={handleApprove}>
                  Approve this display
                </Button>
                <Button variant="outline" className="w-full rounded-xl" onClick={handleDeny}>
                  Deny
                </Button>
              </div>
            </div>
          )}

          {(phase === "approving" || phase === "denying") && (
            <div className="flex flex-col items-center gap-4 py-4">
              <DogLoader text={phase === "approving" ? "Linking display…" : "Denying…"} />
            </div>
          )}

          {phase === "approved" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-green-50 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-500" />
              </div>
              <div>
                <p className="font-semibold text-sm">Display linked</p>
                <p className="text-[12px] text-muted-foreground mt-1">
                  Head back to that screen — it should sign in automatically within a few seconds.
                  You can configure, rename or remove it later from Remote Displays.
                </p>
              </div>
            </div>
          )}

          {phase === "denied" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <XCircle className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="font-semibold text-sm">Denied</p>
              <p className="text-[12px] text-muted-foreground -mt-2">That display was not linked to your account.</p>
            </div>
          )}

          {phase === "unavailable" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-amber-500" />
              </div>
              <p className="font-semibold text-sm">This code has expired</p>
              <p className="text-[12px] text-muted-foreground -mt-2">
                Go back to the display and it will show a fresh QR code — scan the new one instead.
              </p>
            </div>
          )}

          {phase === "error" && (
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-red-500" />
              </div>
              <p className="font-semibold text-sm">Something went wrong</p>
              <p className="text-[12px] text-muted-foreground -mt-2">{errorMsg || "Please try again."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

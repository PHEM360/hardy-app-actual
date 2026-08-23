import { CheckCircle2, PawPrint, ShieldCheck, Smartphone } from "lucide-react";
import type { PairingState } from "@/hooks/useDeviceAuth";
import { PairingQr } from "@/components/display/PairingQr";

export function DisplayLoginScreen({
  pairing,
  onRestartPairing,
}: {
  pairing: PairingState;
  onRestartPairing: () => void;
}) {
  return (
    <div className="min-h-screen w-full overflow-x-hidden flex items-center justify-center bg-zinc-950 px-5 py-10">
      <div className="w-full max-w-4xl">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-primary shadow-lg flex items-center justify-center mb-4">
            <PawPrint className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-display text-white">Set up this display</h1>
          <p className="text-white/60 text-sm mt-1.5 max-w-md">
            Link it securely to one Hardy Hub account. No password needs to be entered on this screen.
          </p>
        </div>

        <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-6 md:gap-8 items-center bg-white/[0.06] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="rounded-2xl bg-black/20 border border-white/10 p-6">
            <PairingQr pairing={pairing} onRestart={onRestartPairing} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 text-white mb-5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="font-display font-semibold">Link from your phone</h2>
            </div>
            <ol className="space-y-4">
              {[
                { icon: Smartphone, title: "Scan the QR code", body: "Use your phone's camera and open the Hardy Hub link." },
                { icon: PawPrint, title: "Sign in on your phone", body: "Use the account whose information should appear here." },
                { icon: CheckCircle2, title: "Approve this display", body: "Return to this screen. It will connect automatically." },
              ].map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="flex gap-3">
                  <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center">
                    <Icon className="w-4 h-4 text-white/75" />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="text-sm font-semibold text-white">
                      <span className="text-white/35 mr-1.5">{index + 1}.</span>{title}
                    </p>
                    <p className="text-xs leading-relaxed text-white/50 mt-0.5">{body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-6 rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.07] px-4 py-3">
              <p className="text-xs leading-relaxed text-emerald-100/70">
                The code expires after five minutes and works once. You can disconnect this display later from Linked Displays.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          Only approve a screen you trust to show this account's information.
        </p>
      </div>
    </div>
  );
}

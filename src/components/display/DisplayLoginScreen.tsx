import { CheckCircle2, PawPrint, ShieldCheck, Smartphone } from "lucide-react";
import type { PairingState } from "@/hooks/useDeviceAuth";
import { PairingQr } from "@/components/display/PairingQr";

const STEPS = [
  { icon: Smartphone, title: "Scan this code with your phone", body: "Open the camera on a phone already signed in to Hardy Hub." },
  { icon: PawPrint, title: "Choose the account", body: "Its calendar, tasks and photos are what this screen will show." },
  { icon: CheckCircle2, title: "Tap approve on the phone", body: "Leave this screen where it is. It connects on its own." },
];

/**
 * The pairing screen runs on TVs, tablets and Raspberry Pis, where enlarged
 * system font and screen-zoom settings make rem-based layouts look magnified.
 * Everything here is measured against the viewport so it always fits one
 * screen, at any resolution, without scrolling.
 */
export function DisplayLoginScreen({
  pairing,
  onRestartPairing,
}: {
  pairing: PairingState;
  onRestartPairing: () => void;
}) {
  return (
    <div
      className="flex min-h-[100dvh] w-full items-center justify-center overflow-x-hidden bg-zinc-950"
      style={{ padding: "min(5vmin, 48px)" }}
    >
      <div className="flex w-full max-w-[1400px] flex-col items-center" style={{ gap: "min(4vmin, 36px)" }}>
        <div className="flex flex-col items-center text-center" style={{ gap: "min(1.5vmin, 12px)" }}>
          <div
            className="flex items-center justify-center rounded-[2.5vmin] bg-gradient-primary shadow-lg"
            style={{ width: "min(9vmin, 64px)", height: "min(9vmin, 64px)" }}
          >
            <PawPrint className="text-white" style={{ width: "min(4.5vmin, 32px)", height: "min(4.5vmin, 32px)" }} />
          </div>
          <h1 className="font-display font-bold text-white" style={{ fontSize: "clamp(18px, 4vmin, 52px)" }}>
            Set up this screen
          </h1>
          <p className="max-w-[52ch] text-white/60" style={{ fontSize: "clamp(11px, 2vmin, 24px)" }}>
            No password is ever typed on this screen. Link it to one Hardy Hub account from your phone.
          </p>
        </div>

        <div
          className="flex w-full flex-col items-center rounded-[3vmin] border border-white/10 bg-white/[0.06] shadow-2xl md:flex-row md:items-center md:justify-center"
          style={{ padding: "min(4vmin, 36px)", gap: "min(5vmin, 44px)" }}
        >
          <PairingQr pairing={pairing} onRestart={onRestartPairing} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center text-white" style={{ gap: "min(1.5vmin, 10px)", marginBottom: "min(3vmin, 22px)" }}>
              <ShieldCheck className="text-emerald-400" style={{ width: "min(3.2vmin, 22px)", height: "min(3.2vmin, 22px)" }} />
              <h2 className="font-display font-semibold" style={{ fontSize: "clamp(13px, 2.4vmin, 30px)" }}>
                Three steps, from your phone
              </h2>
            </div>
            <ol className="flex flex-col" style={{ gap: "min(2.6vmin, 20px)" }}>
              {STEPS.map(({ icon: Icon, title, body }, index) => (
                <li key={title} className="flex" style={{ gap: "min(2vmin, 14px)" }}>
                  <div
                    className="flex flex-shrink-0 items-center justify-center rounded-[2vmin] border border-white/10 bg-white/10 font-bold text-white/80"
                    style={{ width: "min(5.5vmin, 38px)", height: "min(5.5vmin, 38px)", fontSize: "clamp(11px, 2vmin, 17px)" }}
                  >
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="flex items-center font-semibold text-white" style={{ gap: "min(1.2vmin, 8px)", fontSize: "clamp(12px, 2.1vmin, 26px)" }}>
                      <Icon className="flex-shrink-0 text-white/45" style={{ width: "min(2.6vmin, 24px)", height: "min(2.6vmin, 24px)" }} />
                      {title}
                    </p>
                    <p className="text-white/50" style={{ fontSize: "clamp(10px, 1.7vmin, 21px)", marginTop: "min(0.6vmin, 4px)" }}>
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <p className="text-center text-white/30" style={{ fontSize: "clamp(9px, 1.6vmin, 15px)" }}>
          The code works once and expires after five minutes. Only approve a screen you trust with this account’s information.
        </p>
      </div>
    </div>
  );
}

import QRCode from "react-qr-code";
import { RefreshCw, Smartphone } from "lucide-react";
import type { PairingState } from "@/hooks/useDeviceAuth";

export function PairingQr({ pairing, onRestart }: { pairing: PairingState; onRestart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center gap-4">
      <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
        <Smartphone className="w-4.5 h-4.5 text-white/70" />
      </div>
      <div>
        <p className="text-white font-semibold text-sm">Scan with your phone</p>
        <p className="text-white/50 text-xs mt-1 max-w-[15rem]">
          Open your camera, scan the code, then approve on your phone.
        </p>
      </div>

      <div className="w-44 h-44 rounded-2xl bg-white p-3 flex items-center justify-center relative">
        {pairing.phase === "waiting" && pairing.qrUrl && (
          <QRCode value={pairing.qrUrl} size={152} style={{ width: "100%", height: "100%" }} />
        )}
        {(pairing.phase === "starting" || pairing.phase === "claiming") && (
          <div className="flex flex-col items-center gap-2 text-zinc-500">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <span className="text-[11px] font-medium">
              {pairing.phase === "claiming" ? "Signing in…" : "Generating code…"}
            </span>
          </div>
        )}
        {(pairing.phase === "expired" || pairing.phase === "denied" || pairing.phase === "error") && (
          <div className="flex flex-col items-center gap-2 text-zinc-600 px-2">
            <span className="text-[11px] font-medium text-center">
              {pairing.phase === "expired" && "This code expired"}
              {pairing.phase === "denied" && "Sign-in was denied"}
              {pairing.phase === "error" && (pairing.error || "Something went wrong")}
            </span>
            <button
              onClick={onRestart}
              className="text-[11px] font-semibold text-primary underline underline-offset-2"
            >
              Get a new code
            </button>
          </div>
        )}
      </div>

      {pairing.phase === "waiting" && (
        <p className="text-white/30 text-[10px]">Code refreshes automatically if it expires</p>
      )}
    </div>
  );
}

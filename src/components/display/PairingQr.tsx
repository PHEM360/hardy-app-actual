import QRCode from "react-qr-code";
import { RefreshCw } from "lucide-react";
import type { PairingState } from "@/hooks/useDeviceAuth";

/**
 * Sized in viewport units rather than rem so a TV or tablet with enlarged
 * system font and screen-zoom settings still shows a QR code that fits, and one
 * big enough to scan from across the room.
 */
export function PairingQr({ pairing, onRestart }: { pairing: PairingState; onRestart: () => void }) {
  const side = "min(38vmin, 420px)";
  return (
    <div className="flex flex-col items-center gap-[2vmin] text-center">
      <div
        className="flex items-center justify-center rounded-[3vmin] bg-white"
        style={{ width: side, height: side, padding: "min(2.5vmin, 18px)" }}
      >
        {pairing.phase === "waiting" && pairing.qrUrl && (
          <QRCode value={pairing.qrUrl} size={256} style={{ width: "100%", height: "100%" }} />
        )}
        {(pairing.phase === "starting" || pairing.phase === "claiming") && (
          <div className="flex flex-col items-center gap-[1.5vmin] text-zinc-500">
            <RefreshCw className="animate-spin" style={{ width: "5vmin", height: "5vmin" }} />
            <span className="font-medium" style={{ fontSize: "clamp(11px, 1.9vmin, 17px)" }}>
              {pairing.phase === "claiming" ? "Signing in…" : "Generating code…"}
            </span>
          </div>
        )}
        {(pairing.phase === "expired" || pairing.phase === "denied" || pairing.phase === "error") && (
          <div className="flex flex-col items-center gap-[1.5vmin] px-[2vmin] text-zinc-600">
            <span className="font-medium" style={{ fontSize: "clamp(11px, 1.9vmin, 17px)" }}>
              {pairing.phase === "expired" && "This code expired"}
              {pairing.phase === "denied" && "Sign-in was denied"}
              {pairing.phase === "error" && (pairing.error || "Something went wrong")}
            </span>
            <button
              onClick={onRestart}
              className="font-semibold text-primary underline underline-offset-2"
              style={{ fontSize: "clamp(11px, 1.9vmin, 17px)" }}
            >
              Get a new code
            </button>
          </div>
        )}
      </div>

      {pairing.phase === "waiting" && (
        <p className="text-white/35" style={{ fontSize: "clamp(9px, 1.5vmin, 14px)" }}>
          A new code appears automatically if this one expires
        </p>
      )}
    </div>
  );
}

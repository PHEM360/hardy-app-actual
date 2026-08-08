import { useState } from "react";
import { PawPrint, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PairingState } from "@/hooks/useDeviceAuth";
import { PairingQr } from "@/components/display/PairingQr";

export function DisplayLoginScreen({
  error,
  onSignIn,
  pairing,
  onRestartPairing,
}: {
  error: string | null;
  onSignIn: (email: string, password: string) => Promise<void>;
  pairing: PairingState;
  onRestartPairing: () => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSignIn(email, password);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-zinc-950 px-6 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex flex-col items-center mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
            <PawPrint className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-display text-white">Set up this display</h1>
          <p className="text-white/60 text-sm mt-1.5 max-w-md">
            Sign in once and this device stays connected — designed to run as an always-on screen.
          </p>
        </div>

        <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-6 sm:gap-8 items-center bg-white/5 border border-white/10 rounded-3xl p-6 sm:p-8">
          <PairingQr pairing={pairing} onRestart={onRestartPairing} />

          <div className="flex sm:flex-col items-center gap-2">
            <div className="h-px sm:h-16 sm:w-px w-16 bg-white/10" />
            <span className="text-white/30 text-[11px] font-medium uppercase tracking-wider">or</span>
            <div className="h-px sm:h-16 sm:w-px w-16 bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 w-full">
            <p className="text-white/70 text-sm font-medium text-center sm:text-left mb-1">Sign in directly</p>

            {error && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3">
                <p className="text-xs text-red-300 font-medium">{error}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="display-email" className="text-white/70 text-xs">Email</Label>
              <Input
                id="display-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="h-11 rounded-xl bg-white/10 border-white/15 text-white placeholder:text-white/30"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="display-password" className="text-white/70 text-xs">Password</Label>
              <div className="relative">
                <Input
                  id="display-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-11 rounded-xl bg-white/10 border-white/15 text-white placeholder:text-white/30 pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-white/50 hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={loading} className="w-full h-11 rounded-xl text-sm font-semibold">
              {loading ? "Signing in…" : "Connect this display"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-white/30 mt-6">
          Anyone with access to this screen will be able to see this account's data —
          only set this up on a device you're comfortable leaving on display.
        </p>
      </div>
    </div>
  );
}

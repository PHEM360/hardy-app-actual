import { useEffect, useState } from "react";
import { Loader2, Sunrise, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLightPairing } from "@/hooks/useLightPairing";

// Pairing needs the browser to fetch a plain-http local address from this
// https-served app — only Chromium browsers (Chrome, Edge, Brave, Opera)
// can be granted that via a permission prompt. Firefox and Safari have no
// equivalent and silently block the request with no prompt at all, so this
// warns up front instead of letting the dialog fail with no explanation.
const isChromiumBrowser = () => /Chrome|Chromium|Edg\//i.test(navigator.userAgent);

export function AddLightDialog({
  open,
  onOpenChange,
  onPaired,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the new device's id once claimed, so the caller can save the name entered below. */
  onPaired?: (deviceId: string, label: string) => void;
}) {
  const { state, start, configure, reset } = useLightPairing();
  const [homeSsid, setHomeSsid] = useState("");
  const [homePassword, setHomePassword] = useState("");
  const [lightName, setLightName] = useState("");

  useEffect(() => {
    if (open) {
      setHomeSsid("");
      setHomePassword("");
      setLightName("");
      void start();
    } else {
      reset();
    }
    // start/reset are stable across renders; this should only re-run when the dialog opens or closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const finishNaming = () => {
    if (state.deviceId && lightName.trim() && onPaired) onPaired(state.deviceId, lightName.trim());
    toast.success("Light connected!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-4 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-display"><Sunrise className="h-4 w-4" /> Add a sunrise light</DialogTitle>
        </DialogHeader>

        {!isChromiumBrowser() && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
            This step needs Chrome, Edge, or another Chromium-based browser — Firefox and Safari can't grant
            access to the light's local network, so pairing will fail here.
          </p>
        )}

        {(state.phase === "idle" || state.phase === "starting") && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Getting ready…</p>
        )}

        {state.phase === "ready_to_join" && (
          <div className="space-y-3 text-sm">
            <ol className="list-inside list-decimal space-y-2 text-muted-foreground">
              <li>Power on the light. It will broadcast its own WiFi network (usually named "WLED-AP").</li>
              <li>On this device, join that network now — the password is usually <code className="rounded bg-muted px-1">wled1234</code>.</li>
              <li>Come back here and enter your home WiFi details below.</li>
            </ol>
            <div className="space-y-2">
              <Label className="text-xs">Home WiFi name</Label>
              <Input value={homeSsid} onChange={(event) => setHomeSsid(event.target.value)} className="h-9 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Home WiFi password</Label>
              <Input type="password" value={homePassword} onChange={(event) => setHomePassword(event.target.value)} className="h-9 rounded-xl" />
            </div>
            <Button
              className="w-full gap-2 rounded-xl bg-gradient-primary"
              disabled={!homeSsid.trim()}
              onClick={() => void configure(homeSsid.trim(), homePassword)}
            >
              <Wifi className="h-4 w-4" /> Connect the light
            </Button>
          </div>
        )}

        {state.phase === "configuring" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Sending it your WiFi details…
          </p>
        )}

        {state.phase === "waiting" && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reconnect this device to your home WiFi — waiting for the light to come online…
          </p>
        )}

        {state.phase === "claimed" && (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">Connected! What should this light be called?</p>
            <Input
              value={lightName}
              onChange={(event) => setLightName(event.target.value)}
              placeholder="e.g. Kids' bedroom"
              className="h-9 rounded-xl"
              autoFocus
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 rounded-xl" onClick={() => { toast.success("Light connected!"); onOpenChange(false); }}>
                Skip
              </Button>
              <Button className="flex-1 rounded-xl bg-gradient-primary" disabled={!lightName.trim()} onClick={finishNaming}>
                Save
              </Button>
            </div>
          </div>
        )}

        {(state.phase === "error" || state.phase === "expired") && (
          <div className="space-y-3 text-sm">
            <p className="text-destructive">{state.error || "This pairing has expired."}</p>
            <Button variant="outline" className="w-full rounded-xl" onClick={() => void start()}>Try again</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

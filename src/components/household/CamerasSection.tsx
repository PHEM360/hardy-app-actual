import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, Plus, Trash2, Pencil, X, Maximize2, Minimize2,
  RefreshCw, Wifi, WifiOff, Info, ChevronDown, ChevronUp,
  Play, Pause, Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCameras, type Camera as CameraType, type StreamType } from "@/hooks/useCameras";
import Hls from "hls.js";

// ── HLS player ────────────────────────────────────────────────────────────────
function HlsPlayer({ url, active }: { url: string; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef   = useRef<Hls | null>(null);

  useEffect(() => {
    if (!active || !videoRef.current) return;
    const video = videoRef.current;

    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { video.play().catch(() => {}); });
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = url;
      video.play().catch(() => {});
    }
    return () => { hlsRef.current?.destroy(); hlsRef.current = null; };
  }, [url, active]);

  return (
    <video
      ref={videoRef}
      className="w-full h-full object-contain bg-black rounded-xl"
      autoPlay muted playsInline
    />
  );
}

// ── MJPEG player ──────────────────────────────────────────────────────────────
function MjpegPlayer({ url, active }: { url: string; active: boolean }) {
  const [key, setKey] = useState(0);
  return active ? (
    <div className="relative w-full h-full">
      <img
        key={key}
        src={url}
        className="w-full h-full object-contain bg-black rounded-xl"
        onError={() => setTimeout(() => setKey((k) => k + 1), 3000)}
        alt="MJPEG stream"
      />
      <button
        onClick={() => setKey((k) => k + 1)}
        title="Reload stream"
        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-lg"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;
}

// ── Snapshot player ───────────────────────────────────────────────────────────
function SnapshotPlayer({ url, refreshSecs = 5, active }: { url: string; refreshSecs?: number; active: boolean }) {
  const [src, setSrc] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const refresh = useCallback(() => {
    // Cache-bust by appending timestamp
    setSrc(`${url}${url.includes("?") ? "&" : "?"}_t=${Date.now()}`);
    setLastUpdated(new Date());
  }, [url]);

  useEffect(() => {
    if (!active) return;
    refresh();
    const interval = setInterval(refresh, refreshSecs * 1000);
    return () => clearInterval(interval);
  }, [active, refresh, refreshSecs]);

  return active ? (
    <div className="relative w-full h-full">
      {src && (
        <img
          src={src}
          className="w-full h-full object-contain bg-black rounded-xl"
          alt="Camera snapshot"
        />
      )}
      <div className="absolute bottom-2 left-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded-lg">
        Refreshing every {refreshSecs}s
        {lastUpdated && ` · ${lastUpdated.toLocaleTimeString()}`}
      </div>
      <button
        onClick={refresh}
        title="Refresh now"
        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-lg"
      >
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : null;
}

// ── Camera tile ───────────────────────────────────────────────────────────────
function CameraTile({
  camera,
  onEdit,
  onDelete,
}: {
  camera: CameraType;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [active, setActive] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const streamLabel: Record<StreamType, string> = {
    mjpeg: "MJPEG",
    hls: "HLS",
    snapshot: "Snapshot",
    webrtc: "WebRTC",
  };

  const streamColour: Record<StreamType, string> = {
    mjpeg:    "bg-blue-100 text-blue-700",
    hls:      "bg-purple-100 text-purple-700",
    snapshot: "bg-green-100 text-green-700",
    webrtc:   "bg-orange-100 text-orange-700",
  };

  const Viewer = () => {
    if (!active) return null;
    if (camera.streamType === "hls")      return <HlsPlayer url={camera.streamUrl} active={active} />;
    if (camera.streamType === "mjpeg")    return <MjpegPlayer url={camera.streamUrl} active={active} />;
    if (camera.streamType === "snapshot") return <SnapshotPlayer url={camera.streamUrl} refreshSecs={camera.snapshotRefreshSecs ?? 5} active={active} />;
    // WebRTC — open in new tab (go2rtc built-in player)
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-black rounded-xl gap-3 p-4">
        <Wifi className="w-8 h-8 text-white/60" />
        <p className="text-white/70 text-xs text-center">
          WebRTC streams open in the go2rtc player
        </p>
        <a
          href={camera.streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-semibold"
        >
          Open stream ↗
        </a>
      </div>
    );
  };

  return (
    <>
      <div className="rounded-2xl bg-card border border-border/50 overflow-hidden shadow-soft">
        {/* Preview area */}
        <div
          className="relative bg-black"
          style={{ aspectRatio: "16/9" }}
        >
          {active ? (
            <Viewer />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <Camera className="w-8 h-8 text-white/30" />
              <p className="text-white/40 text-xs">{camera.name}</p>
            </div>
          )}

          {/* Overlay controls */}
          <div className="absolute inset-0 flex items-end justify-between p-2 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 hover:opacity-100 transition-opacity">
            <button
              onClick={() => setActive((a) => !a)}
              className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-lg"
            >
              {active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={() => setFullscreen(true)}
              className="bg-black/50 hover:bg-black/70 text-white p-1.5 rounded-lg"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Status pill */}
          <div className={`absolute top-2 left-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${active ? "bg-red-500 text-white" : "bg-black/50 text-white/70"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white animate-pulse" : "bg-white/40"}`} />
            {active ? "LIVE" : "Off"}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-card-foreground truncate">{camera.name}</p>
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              {camera.location && (
                <span className="text-[10px] text-muted-foreground">{camera.location}</span>
              )}
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${streamColour[camera.streamType]}`}>
                {streamLabel[camera.streamType]}
              </span>
            </div>
          </div>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => setActive((a) => !a)}
              className={`p-1.5 rounded-lg transition-colors ${active ? "text-red-500 hover:bg-red-50" : "text-green-600 hover:bg-green-50"}`}
              title={active ? "Stop stream" : "Start stream"}
            >
              {active ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>
            <button onClick={onEdit} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Fullscreen modal */}
      <AnimatePresence>
        {fullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex flex-col"
          >
            <div
              className="flex items-center justify-between p-4"
              style={{ paddingTop: "max(1rem, env(safe-area-inset-top, 0px))" }}
            >
              <div>
                <h3 className="text-white font-semibold">{camera.name}</h3>
                {camera.location && <p className="text-white/60 text-xs">{camera.location}</p>}
              </div>
              <button
                onClick={() => setFullscreen(false)}
                className="text-white/70 hover:text-white p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="w-full max-w-4xl" style={{ aspectRatio: "16/9" }}>
                <Viewer />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Add/Edit dialog ───────────────────────────────────────────────────────────
const BLANK: Omit<CameraType, "id"> = {
  name: "",
  location: "",
  streamUrl: "",
  streamType: "mjpeg",
  snapshotRefreshSecs: 5,
  notes: "",
};

function CameraDialog({
  open,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  initial?: Omit<CameraType, "id">;
  onClose: () => void;
  onSave: (cam: Omit<CameraType, "id">) => Promise<void>;
}) {
  const [form, setForm] = useState<Omit<CameraType, "id">>(BLANK);
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setForm(initial ?? BLANK); }, [open, initial]);

  const set = <K extends keyof typeof BLANK>(k: K, v: (typeof BLANK)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.streamUrl.trim()) return;
    setSaving(true);
    try { await onSave(form); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Camera className="w-4 h-4 text-blue-600" />
            {initial ? "Edit Camera" : "Add Camera"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="space-y-1.5">
            <Label>Camera name *</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Front Door, Garden" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Location <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={form.location ?? ""} onChange={(e) => set("location", e.target.value)} placeholder="e.g. Outside, Living Room" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-1.5">
            <Label>Stream type *</Label>
            <Select value={form.streamType} onValueChange={(v) => set("streamType", v as StreamType)}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="mjpeg">MJPEG — Motion JPEG (go2rtc / most cameras)</SelectItem>
                <SelectItem value="hls">HLS — HTTP Live Streaming (go2rtc)</SelectItem>
                <SelectItem value="snapshot">Snapshot — Refreshing JPEG still</SelectItem>
                <SelectItem value="webrtc">WebRTC — Low latency (opens go2rtc)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Stream URL *</Label>
            <Input
              value={form.streamUrl}
              onChange={(e) => set("streamUrl", e.target.value)}
              placeholder={
                form.streamType === "mjpeg"    ? "http://192.168.1.x:1984/api/stream.mjpeg?src=cam1" :
                form.streamType === "hls"      ? "http://192.168.1.x:1984/api/stream.m3u8?src=cam1" :
                form.streamType === "snapshot" ? "http://192.168.1.x/snapshot.jpg" :
                                                  "http://192.168.1.x:1984/cam1"
              }
              className="h-11 rounded-xl text-xs font-mono"
            />
          </div>
          {form.streamType === "snapshot" && (
            <div className="space-y-1.5">
              <Label>Refresh interval (seconds)</Label>
              <Input
                type="number" min={1} max={60}
                value={form.snapshotRefreshSecs ?? 5}
                onChange={(e) => set("snapshotRefreshSecs", Number(e.target.value))}
                className="h-11 rounded-xl"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="e.g. Tapo C200, password saved in vault" className="h-11 rounded-xl" />
          </div>
          <Button
            onClick={handleSave}
            disabled={saving || !form.name.trim() || !form.streamUrl.trim()}
            className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? "Saving…" : initial ? "Save Changes" : "Add Camera"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Setup guide ───────────────────────────────────────────────────────────────
function SetupGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-blue-200/60 bg-blue-50/50 overflow-hidden">
      <button
        onClick={() => setOpen((x) => !x)}
        className="w-full flex items-center justify-between p-4 text-sm font-semibold text-blue-700"
      >
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          How to connect your Tapo (RTSP) camera
        </div>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-blue-200/60 text-xs text-blue-900">
              <p className="pt-3 font-semibold">Browsers can't play RTSP directly — you need a local proxy. The easiest option is <strong>go2rtc</strong>:</p>
              <ol className="space-y-2 list-decimal list-inside">
                <li>
                  <strong>Download go2rtc</strong> from{" "}
                  <a href="https://github.com/AlexxIT/go2rtc/releases" target="_blank" rel="noopener noreferrer" className="underline text-blue-700">
                    github.com/AlexxIT/go2rtc
                  </a>{" "}
                  and run it on a PC or Raspberry Pi on your home network.
                </li>
                <li>
                  <strong>Configure your Tapo camera</strong>. Create a <code className="bg-blue-100 px-1 rounded">go2rtc.yaml</code> file:
                  <pre className="mt-1 bg-blue-100/70 rounded-lg p-2 text-[10px] overflow-x-auto">{`streams:
  tapo_cam:
    - rtsp://admin:YOUR_PASSWORD@192.168.1.x:554/stream1`}</pre>
                  (Find your camera IP in the Tapo app → Camera Settings)
                </li>
                <li>
                  <strong>Start go2rtc</strong> — it runs a local web server on port <code className="bg-blue-100 px-1 rounded">1984</code>.
                </li>
                <li>
                  <strong>Add the camera here</strong> using one of these URLs:
                  <pre className="mt-1 bg-blue-100/70 rounded-lg p-2 text-[10px] overflow-x-auto">{`MJPEG:    http://YOUR_PC_IP:1984/api/stream.mjpeg?src=tapo_cam
HLS:      http://YOUR_PC_IP:1984/api/stream.m3u8?src=tapo_cam
Snapshot: http://YOUR_PC_IP:1984/api/frame.jpeg?src=tapo_cam`}</pre>
                </li>
              </ol>
              <p className="text-blue-700/80">
                💡 <strong>Tip:</strong> go2rtc also supports ONVIF auto-discovery. You can open{" "}
                <code className="bg-blue-100 px-1 rounded">http://YOUR_PC_IP:1984</code> in a browser to see the go2rtc dashboard and confirm your stream is working before adding it here.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function CamerasSection() {
  const { cameras, loading, addCamera, updateCamera, deleteCamera } = useCameras();
  const [addOpen, setAddOpen] = useState(false);
  const [editCam, setEditCam] = useState<CameraType | null>(null);

  const handleSave = async (cam: Omit<CameraType, "id">) => {
    if (editCam?.id) {
      await updateCamera(editCam.id, cam);
    } else {
      await addCamera(cam);
    }
  };

  return (
    <div className="space-y-5 pb-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-xl bg-blue-500/15">
            <Camera className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-card-foreground">Cameras</h3>
            <p className="text-[11px] text-muted-foreground">Live streams &amp; snapshots</p>
          </div>
        </div>
        <Button
          onClick={() => { setEditCam(null); setAddOpen(true); }}
          size="sm"
          className="rounded-xl h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Add Camera
        </Button>
      </div>

      {/* Setup guide */}
      <SetupGuide />

      {/* Grid */}
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
      ) : cameras.length === 0 ? (
        <div className="py-12 flex flex-col items-center gap-3 text-center">
          <div className="p-4 rounded-2xl bg-muted/40">
            <Camera className="w-8 h-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm font-semibold text-card-foreground">No cameras added yet</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Add a camera using its MJPEG, HLS or snapshot URL. See the setup guide above to connect a Tapo RTSP camera.
          </p>
          <Button onClick={() => setAddOpen(true)} size="sm" className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white gap-1 mt-1">
            <Plus className="w-3.5 h-3.5" /> Add Camera
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {cameras.map((cam) => (
            <CameraTile
              key={cam.id}
              camera={cam}
              onEdit={() => { setEditCam(cam); setAddOpen(true); }}
              onDelete={() => cam.id && deleteCamera(cam.id)}
            />
          ))}
        </div>
      )}

      {/* Add/edit dialog */}
      <CameraDialog
        open={addOpen}
        initial={editCam ? (({ id, ...rest }) => rest)(editCam) : undefined}
        onClose={() => { setAddOpen(false); setEditCam(null); }}
        onSave={handleSave}
      />
    </div>
  );
}

/**
 * DocumentScannerSheet
 * ---------------------
 * Full-screen document scanner modal. Shows a captured camera image,
 * auto-detects document edges, lets the user drag 4 corner handles to
 * refine the crop, then applies a perspective warp and returns the result
 * as a JPEG File — similar to Dropbox / Google Drive scanning.
 *
 * Usage:
 *   <DocumentScannerSheet
 *     imageFile={capturedFile}
 *     onConfirm={(croppedFile) => uploadDocument(croppedFile)}
 *     onCancel={() => setScannerFile(null)}
 *   />
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, RotateCcw, Loader2, CheckCheck, ScanLine, Image as ImageIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number };
// Corners in order: TL, TR, BR, BL
type Quad = [Pt, Pt, Pt, Pt];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * Downsample a canvas to a maximum side length (preserves aspect ratio).
 * Returns a new canvas.
 */
function resizeCanvas(src: HTMLCanvasElement, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const w = Math.round(src.width * scale);
  const h = Math.round(src.height * scale);
  const dst = document.createElement("canvas");
  dst.width = w;
  dst.height = h;
  dst.getContext("2d")!.drawImage(src, 0, 0, w, h);
  return dst;
}

/**
 * Auto-detect the document bounding quad using Sobel edge detection +
 * row/column projection. Returns corners in image coordinates.
 * Falls back to a ~10 % inset rectangle if detection is unreliable.
 */
function autoDetectQuad(srcCanvas: HTMLCanvasElement): Quad {
  const W = srcCanvas.width;
  const H = srcCanvas.height;

  // Work on a small downsampled copy for speed
  const THUMB = 400;
  const scale = Math.min(W, H) / THUMB;
  const sw = Math.round(W / scale);
  const sh = Math.round(H / scale);

  const tmp = document.createElement("canvas");
  tmp.width = sw;
  tmp.height = sh;
  const tCtx = tmp.getContext("2d", { willReadFrequently: true })!;
  tCtx.drawImage(srcCanvas, 0, 0, sw, sh);
  const d = tCtx.getImageData(0, 0, sw, sh).data;

  // Grayscale
  const gray = new Uint8Array(sw * sh);
  for (let i = 0; i < sw * sh; i++) {
    gray[i] = Math.round(d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114);
  }

  // Sobel edge magnitude
  const edge = new Float32Array(sw * sh);
  let maxE = 0;
  for (let y = 1; y < sh - 1; y++) {
    for (let x = 1; x < sw - 1; x++) {
      const gx =
        -gray[(y - 1) * sw + (x - 1)] - 2 * gray[y * sw + (x - 1)] - gray[(y + 1) * sw + (x - 1)] +
        gray[(y - 1) * sw + (x + 1)] + 2 * gray[y * sw + (x + 1)] + gray[(y + 1) * sw + (x + 1)];
      const gy =
        -gray[(y - 1) * sw + (x - 1)] - 2 * gray[(y - 1) * sw + x] - gray[(y - 1) * sw + (x + 1)] +
        gray[(y + 1) * sw + (x - 1)] + 2 * gray[(y + 1) * sw + x] + gray[(y + 1) * sw + (x + 1)];
      const e = Math.sqrt(gx * gx + gy * gy);
      edge[y * sw + x] = e;
      if (e > maxE) maxE = e;
    }
  }

  const fallback: Quad = [
    { x: W * 0.08, y: H * 0.08 },
    { x: W * 0.92, y: H * 0.08 },
    { x: W * 0.92, y: H * 0.92 },
    { x: W * 0.08, y: H * 0.92 },
  ];

  if (maxE < 10) return fallback;

  // Row / column projections
  const hProj = new Float32Array(sh);
  const vProj = new Float32Array(sw);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      hProj[y] += edge[y * sw + x];
      vProj[x] += edge[y * sw + x];
    }
  }
  const maxH = Math.max(...hProj);
  const maxV = Math.max(...vProj);
  const rT = maxH * 0.12;
  const cT = maxV * 0.12;

  let top = sh * 0.08, bottom = sh * 0.92, left = sw * 0.08, right = sw * 0.92;
  for (let y = 0; y < sh; y++) { if (hProj[y] > rT) { top = y; break; } }
  for (let y = sh - 1; y >= 0; y--) { if (hProj[y] > rT) { bottom = y; break; } }
  for (let x = 0; x < sw; x++) { if (vProj[x] > cT) { left = x; break; } }
  for (let x = sw - 1; x >= 0; x--) { if (vProj[x] > cT) { right = x; break; } }

  // Sanity check: quad must be at least 30% of image
  const qW = right - left, qH = bottom - top;
  if (qW < sw * 0.3 || qH < sh * 0.3) return fallback;

  // A small outward nudge to include the border itself
  const pad = Math.round(Math.min(sw, sh) * 0.01);
  top    = Math.max(0,    top    - pad);
  bottom = Math.min(sh - 1, bottom + pad);
  left   = Math.max(0,    left   - pad);
  right  = Math.min(sw - 1, right  + pad);

  return [
    { x: left * scale,  y: top    * scale },
    { x: right * scale, y: top    * scale },
    { x: right * scale, y: bottom * scale },
    { x: left  * scale, y: bottom * scale },
  ];
}

/**
 * Perspective warp: maps the source quad to an output rectangle.
 * Uses bilinear scanline interpolation (fast, no extra deps).
 *
 * NOTE: for very large images this runs in ~100–300 ms on modern phones.
 * We pre-downscale the source to ≤ 2 000 px max side to keep it fast.
 */
function warpPerspective(srcCanvas: HTMLCanvasElement, quad: Quad, outW: number, outH: number): HTMLCanvasElement {
  // Work on a reasonably-sized copy
  const MAX = 2000;
  const src =
    Math.max(srcCanvas.width, srcCanvas.height) > MAX
      ? resizeCanvas(srcCanvas, MAX)
      : srcCanvas;

  const sw = src.width;
  const sh = src.height;
  // Scale the corners to match the (possibly downsampled) canvas
  const sx = sw / srcCanvas.width;
  const sy = sh / srcCanvas.height;
  const [tl, tr, br, bl] = quad.map((p) => ({ x: p.x * sx, y: p.y * sy })) as Quad;

  const srcCtx = src.getContext("2d", { willReadFrequently: true })!;
  const srcImg = srcCtx.getImageData(0, 0, sw, sh);

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext("2d")!;
  const outImg = outCtx.createImageData(outW, outH);

  const sample = (x: number, y: number) => {
    // Nearest-neighbour (fast, good enough for scanning)
    const px = clamp(Math.round(x), 0, sw - 1);
    const py = clamp(Math.round(y), 0, sh - 1);
    const i = (py * sw + px) * 4;
    return [srcImg.data[i], srcImg.data[i + 1], srcImg.data[i + 2], srcImg.data[i + 3]] as const;
  };

  for (let dy = 0; dy < outH; dy++) {
    const t = outH > 1 ? dy / (outH - 1) : 0;
    // Left edge (TL → BL) and right edge (TR → BR)
    const lx = tl.x + t * (bl.x - tl.x);
    const ly = tl.y + t * (bl.y - tl.y);
    const rx = tr.x + t * (br.x - tr.x);
    const ry = tr.y + t * (br.y - tr.y);

    for (let dx = 0; dx < outW; dx++) {
      const s = outW > 1 ? dx / (outW - 1) : 0;
      const [r, g, b, a] = sample(lx + s * (rx - lx), ly + s * (ry - ly));
      const i = (dy * outW + dx) * 4;
      outImg.data[i] = r;
      outImg.data[i + 1] = g;
      outImg.data[i + 2] = b;
      outImg.data[i + 3] = a;
    }
  }

  outCtx.putImageData(outImg, 0, 0);
  return out;
}

/**
 * Auto-contrast: stretches the luminance histogram between its 1st and 99th
 * percentile so the page reads as bright white / dark ink, similar to the
 * "auto" scan mode in Dropbox / Google Drive. Mutates and returns the same
 * canvas.
 */
function enhanceScan(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;

  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const lum = Math.round(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
    hist[lum]++;
  }

  const totalPx = d.length / 4;
  const cutoff = totalPx * 0.01;
  let lo = 0, hi = 255, count = 0;
  for (let i = 0; i < 256; i++) { count += hist[i]; if (count > cutoff) { lo = i; break; } }
  count = 0;
  for (let i = 255; i >= 0; i--) { count += hist[i]; if (count > cutoff) { hi = i; break; } }

  const range = hi - lo;
  if (range < 10) return canvas; // Already flat / low-contrast source — leave as-is

  for (let i = 0; i < d.length; i += 4) {
    d[i]     = clamp(Math.round((d[i]     - lo) * 255 / range), 0, 255);
    d[i + 1] = clamp(Math.round((d[i + 1] - lo) * 255 / range), 0, 255);
    d[i + 2] = clamp(Math.round((d[i + 2] - lo) * 255 / range), 0, 255);
  }

  ctx.putImageData(img, 0, 0);
  return canvas;
}

// ─── Corner labels ────────────────────────────────────────────────────────────

const CORNER_LABELS = ["TL", "TR", "BR", "BL"] as const;
const CORNER_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#a855f7"] as const;

// ─── Main component ───────────────────────────────────────────────────────────

export default function DocumentScannerSheet({
  imageFile,
  initialMode,
  onConfirm,
  onCancel,
}: {
  imageFile: File | null;
  /** When set, skips the in-sheet "Scan or Picture?" choice and goes straight
   *  to that mode — use this when the caller already asked the user before
   *  opening the camera/file picker (see ScanModeChooser below). */
  initialMode?: "scan" | "picture";
  onConfirm: (file: File) => void;
  onCancel: () => void;
}) {
  // ── Image loading ────────────────────────────────────────────────────────────
  const offscreenRef = useRef<HTMLCanvasElement | null>(null); // full-res canvas for warp
  const [imgSrc, setImgSrc] = useState<string>(""); // object URL for display
  const [naturalW, setNaturalW] = useState(1);
  const [naturalH, setNaturalH] = useState(1);
  const [imgReady, setImgReady] = useState(false);

  // ── Quad state ───────────────────────────────────────────────────────────────
  const [quad, setQuad] = useState<Quad | null>(null);
  const [dragging, setDragging] = useState<number | null>(null);

  // ── Warp result state ────────────────────────────────────────────────────────
  type Stage = "choose" | "edit" | "warping" | "preview";
  const [stage, setStage] = useState<Stage>("choose");
  const [mode, setMode] = useState<"scan" | "picture" | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const warpedBlobRef = useRef<Blob | null>(null);
  const [fileName, setFileName] = useState("Scan");

  // ── SVG ref for coordinate transforms ────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement>(null);

  // ── Load image ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!imageFile) return;
    setImgReady(false);
    setQuad(null);
    setPreviewSrc("");
    warpedBlobRef.current = null;
    setFileName((imageFile.name || "Scan").replace(/\.[^.]+$/, ""));

    const url = URL.createObjectURL(imageFile);
    setImgSrc(url);

    if (initialMode === "picture") {
      // Caller already asked "scan or picture?" before opening the camera/
      // file picker — skip the in-sheet choice and use the photo as-is.
      setMode("picture");
      warpedBlobRef.current = imageFile;
      setPreviewSrc(url);
      setStage("preview");
    } else if (initialMode === "scan") {
      setMode("scan");
      setStage("edit");
    } else {
      setMode(null);
      setStage("choose");
    }

    const img = new Image();
    img.onload = () => {
      // Draw onto offscreen canvas
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d")!.drawImage(img, 0, 0);
      offscreenRef.current = canvas;
      setNaturalW(img.naturalWidth);
      setNaturalH(img.naturalHeight);
      // Auto-detect
      const detected = autoDetectQuad(canvas);
      setQuad(detected);
      setImgReady(true);
    };
    img.src = url;

    return () => URL.revokeObjectURL(url);
  }, [imageFile, initialMode]);

  // ── Drag: map screen → SVG/image coordinates ─────────────────────────────────
  const getSVGPt = useCallback(
    (clientX: number, clientY: number): Pt | null => {
      const svg = svgRef.current;
      if (!svg) return null;
      const pt = svg.createSVGPoint();
      pt.x = clientX;
      pt.y = clientY;
      const inv = svg.getScreenCTM()?.inverse();
      if (!inv) return null;
      const sp = pt.matrixTransform(inv);
      return { x: clamp(sp.x, 0, naturalW), y: clamp(sp.y, 0, naturalH) };
    },
    [naturalW, naturalH]
  );

  const onPointerDown = (idx: number) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
    setDragging(idx);
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (dragging === null || !quad) return;
      const pt = getSVGPt(e.clientX, e.clientY);
      if (!pt) return;
      setQuad((prev) => {
        if (!prev) return prev;
        const next = [...prev] as Quad;
        next[dragging] = pt;
        return next;
      });
    },
    [dragging, quad, getSVGPt]
  );

  const onPointerUp = useCallback(() => setDragging(null), []);

  // ── Reset to auto-detected corners ───────────────────────────────────────────
  const handleReset = useCallback(() => {
    if (!offscreenRef.current) return;
    setQuad(autoDetectQuad(offscreenRef.current));
    setStage("edit");
    setPreviewSrc("");
  }, []);

  // ── Choose: scan (crop + enhance) or plain picture (as-is) ──────────────────
  const chooseScan = useCallback(() => {
    setMode("scan");
    setStage("edit");
  }, []);

  const choosePicture = useCallback(() => {
    if (!imageFile) return;
    setMode("picture");
    warpedBlobRef.current = imageFile;
    setPreviewSrc(imgSrc);
    setStage("preview");
  }, [imageFile, imgSrc]);

  // ── Apply perspective warp ────────────────────────────────────────────────────
  const handleWarp = useCallback(async () => {
    if (!quad || !offscreenRef.current) return;
    setStage("warping");

    // Yield to let React update the UI first
    await new Promise((r) => setTimeout(r, 80));

    try {
      const [tl, tr, br, bl] = quad;
      const topW  = Math.hypot(tr.x - tl.x, tr.y - tl.y);
      const botW  = Math.hypot(br.x - bl.x, br.y - bl.y);
      const leftH = Math.hypot(bl.x - tl.x, bl.y - tl.y);
      const rightH = Math.hypot(br.x - tr.x, br.y - tr.y);
      const outW = Math.max(1, Math.round(Math.max(topW, botW)));
      const outH = Math.max(1, Math.round(Math.max(leftH, rightH)));

      const warped = enhanceScan(warpPerspective(offscreenRef.current, quad, outW, outH));

      // Convert to blob
      await new Promise<void>((resolve) => {
        warped.toBlob(
          (blob) => {
            warpedBlobRef.current = blob;
            setPreviewSrc(blob ? URL.createObjectURL(blob) : "");
            resolve();
          },
          "image/jpeg",
          0.93
        );
      });

      setStage("preview");
    } catch {
      setStage("edit");
    }
  }, [quad]);

  // ── Confirm ───────────────────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    const blob = warpedBlobRef.current;
    if (!blob) return;
    const baseName = fileName.trim() || "Scan";
    const mime = blob.type || "image/jpeg";
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "jpg";
    const file = new File([blob], `${baseName}.${ext}`, { type: mime });
    onConfirm(file);
  }, [fileName, onConfirm]);

  // ── Cleanup preview URL ───────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (previewSrc) URL.revokeObjectURL(previewSrc);
    };
  }, [previewSrc]);

  if (!imageFile) return null;

  // ── Handle radius: scale with image to stay consistent on screen ──────────────
  // We use SVG user units (= image px), so r should be ~2% of shorter side
  const handleR = Math.round(Math.min(naturalW, naturalH) * 0.03);
  const strokeW = Math.round(handleR * 0.25);

  // Portal to document.body: the dashboard's draggable widgets (react-rnd)
  // position themselves with CSS transform, which makes any position:fixed
  // descendant relative to that transformed ancestor instead of the
  // viewport — without the portal this full-screen sheet renders trapped
  // inside whichever small widget box it was opened from.
  return createPortal(
    <div className="fixed inset-0 z-[400] bg-black flex flex-col">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-sm flex-shrink-0">
        <button
          onClick={onCancel}
          className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center">
          {stage === "choose" && (
            <>
              <p className="text-white text-sm font-semibold">Save as…</p>
              <p className="text-white/50 text-[10px]">Choose how to process this image</p>
            </>
          )}
          {stage === "edit" && (
            <>
              <p className="text-white text-sm font-semibold">Adjust edges</p>
              <p className="text-white/50 text-[10px]">Drag the coloured corners to fit the document</p>
            </>
          )}
          {stage === "warping" && <p className="text-white text-sm font-semibold">Scanning…</p>}
          {stage === "preview" && (
            <>
              <p className="text-white text-sm font-semibold">Preview</p>
              <p className="text-white/50 text-[10px]">{mode === "scan" ? "Happy with the scan?" : "Happy with the photo?"}</p>
            </>
          )}
        </div>

        {stage === "edit" ? (
          <button
            onClick={handleReset}
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            title="Reset corners"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        ) : (
          <div className="w-9" />
        )}
      </div>

      {/* ── Image area ── */}
      <div className="flex-1 min-h-0 flex items-center justify-center overflow-hidden px-2 py-2">
        {stage === "choose" && imgSrc ? (
          <img
            src={imgSrc}
            alt="Captured"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl opacity-90"
          />
        ) : stage === "edit" && imgReady && quad ? (
          /* SVG overlay for handles */
          <div className="relative max-w-full max-h-full" style={{ aspectRatio: `${naturalW}/${naturalH}`, maxHeight: "100%", maxWidth: "100%" }}>
            <img
              src={imgSrc}
              alt="Document"
              className="block w-full h-full object-contain select-none pointer-events-none"
              draggable={false}
            />
            <svg
              ref={svgRef}
              viewBox={`0 0 ${naturalW} ${naturalH}`}
              className="absolute inset-0 w-full h-full"
              style={{ touchAction: "none" }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {/* Semi-transparent mask outside the quad */}
              <defs>
                <mask id="docmask">
                  <rect width={naturalW} height={naturalH} fill="white" />
                  <polygon
                    points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="black"
                  />
                </mask>
              </defs>
              <rect
                width={naturalW}
                height={naturalH}
                fill="rgba(0,0,0,0.45)"
                mask="url(#docmask)"
              />

              {/* Quad outline */}
              <polygon
                points={quad.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="white"
                strokeWidth={strokeW}
                strokeDasharray={`${handleR * 2} ${handleR}`}
                strokeLinejoin="round"
              />

              {/* Corner handles */}
              {quad.map((pt, idx) => (
                <g key={idx}>
                  {/* Large invisible hit area */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={handleR * 2.2}
                    fill="transparent"
                    style={{ cursor: "grab", touchAction: "none" }}
                    onPointerDown={onPointerDown(idx)}
                  />
                  {/* Outer ring */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={handleR}
                    fill={CORNER_COLORS[idx]}
                    stroke="white"
                    strokeWidth={strokeW}
                    style={{ pointerEvents: "none" }}
                  />
                  {/* Inner dot */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={handleR * 0.35}
                    fill="white"
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              ))}
            </svg>
          </div>
        ) : stage === "warping" ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-white animate-spin" />
            <p className="text-white/70 text-sm">Applying perspective correction…</p>
          </div>
        ) : stage === "preview" && previewSrc ? (
          <img
            src={previewSrc}
            alt="Scanned document"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
            <p className="text-white/50 text-sm">Loading image…</p>
          </div>
        )}
      </div>

      {/* ── Bottom action bar ── */}
      <div className="flex-shrink-0 px-4 pb-8 pt-3 bg-black/80 backdrop-blur-sm space-y-2">
        {stage === "choose" && (
          <div className="flex gap-2">
            <button
              onClick={chooseScan}
              disabled={!imgReady}
              className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white transition-colors"
            >
              <ScanLine className="w-6 h-6" />
              <span className="text-sm font-semibold">Scan Document</span>
              <span className="text-[10px] text-white/70 px-2 text-center">Auto-crop &amp; enhance</span>
            </button>
            <button
              onClick={choosePicture}
              className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <ImageIcon className="w-6 h-6" />
              <span className="text-sm font-semibold">Just a Picture</span>
              <span className="text-[10px] text-white/70 px-2 text-center">Use as taken</span>
            </button>
          </div>
        )}

        {stage === "preview" && (
          <Input
            value={fileName}
            onChange={(e) => setFileName(e.target.value)}
            placeholder="Name this file"
            className="h-10 rounded-xl bg-white/10 border-white/20 text-white placeholder:text-white/40"
          />
        )}

        {stage === "edit" && imgReady && (
          <Button
            onClick={handleWarp}
            disabled={!quad}
            className="w-full h-12 rounded-2xl text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white"
          >
            Scan Document
          </Button>
        )}

        {stage === "preview" && (
          <>
            <Button
              onClick={handleConfirm}
              className="w-full h-12 rounded-2xl text-sm font-semibold bg-green-500 hover:bg-green-600 text-white gap-2"
            >
              <CheckCheck className="w-4 h-4" />
              {mode === "scan" ? "Use this Scan" : "Use this Photo"}
            </Button>
            {mode === "scan" && (
              <Button
                variant="ghost"
                onClick={() => setStage("edit")}
                className="w-full h-10 rounded-2xl text-sm text-white/70 hover:text-white hover:bg-white/10"
              >
                Re-adjust corners
              </Button>
            )}
          </>
        )}

        {stage === "edit" && !imgReady && (
          <div className="h-12 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ─── Scan/Picture pre-choice ────────────────────────────────────────────────
// Asks "scan or picture?" up front, before the camera opens. Each choice is
// a native <label> wrapping its own hidden camera <input> — tapping the
// label *is* the browser-native trigger for the picker, so there's no JS
// .click() proxy in the middle. That indirection (call a handler, which
// calls .click() on a ref'd input elsewhere in the tree) is exactly the
// pattern mobile Safari can silently drop the camera launch for, since it
// no longer sees an unbroken, single-element user gesture on the input
// itself.
export function ScanModeChooser({
  open,
  onPick,
  onCancel,
}: {
  open: boolean;
  onPick: (file: File, mode: "scan" | "picture") => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const handleFile = (mode: "scan" | "picture") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (f) onPick(f, mode);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[410] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-sm bg-card rounded-2xl p-4 space-y-3 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-card-foreground text-center">Add receipt as…</p>
        <div className="flex gap-2">
          <label className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl bg-blue-500 hover:bg-blue-600 text-white transition-colors cursor-pointer">
            <ScanLine className="w-6 h-6" />
            <span className="text-sm font-semibold">Scan Document</span>
            <span className="text-[10px] text-white/70 px-2 text-center">Auto-crop &amp; enhance</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile("scan")} />
          </label>
          <label className="flex-1 flex flex-col items-center gap-2 py-4 rounded-2xl bg-muted hover:bg-muted/70 text-card-foreground transition-colors cursor-pointer">
            <ImageIcon className="w-6 h-6" />
            <span className="text-sm font-semibold">Just a Picture</span>
            <span className="text-[10px] text-muted-foreground px-2 text-center">Use as taken</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile("picture")} />
          </label>
        </div>
        <button
          onClick={onCancel}
          className="w-full h-9 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}

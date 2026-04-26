import { useState, useCallback, useMemo, useRef, Fragment, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import QRCodeSVG from "react-qr-code";
import { toPng } from "html-to-image";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import {
  QrCode, Plus, ArrowLeft, Settings2, Trash2, Edit2, Printer,
  Globe, FileText, Image, X, Check, Download, Tag,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQRCodes, useQRCodeSettings } from "@/hooks/useQRCodes";
import { QRCodeItem } from "@/types/app";

type View = "library" | "generator" | "settings";

// ─── Constants ────────────────────────────────────────────────────────────────

const CONTENT_TYPES = [
  { value: "url"  as const, label: "Website URL",  icon: Globe,     placeholder: "https://example.com" },
  { value: "text" as const, label: "Plain Text",    icon: FileText,  placeholder: "Enter text to encode…" },
  { value: "image"as const, label: "Image URL",     icon: Image,     placeholder: "https://example.com/image.jpg" },
];

const PRINT_SIZES = [
  { value: "small",  label: "Small",  dim: "5×5 cm",   cm: 5,  px: 140 },
  { value: "medium", label: "Medium", dim: "10×10 cm", cm: 10, px: 240 },
  { value: "large",  label: "Large",  dim: "15×15 cm", cm: 15, px: 340 },
  { value: "xl",     label: "XL",     dim: "20×20 cm", cm: 20, px: 440 },
  { value: "custom", label: "Custom", dim: "—",         cm: 0,  px: 0   },
];

const TEXT_SIZES = [
  { value: "xs",  label: "XS", px: 10 },
  { value: "sm",  label: "S",  px: 13 },
  { value: "md",  label: "M",  px: 16 },
  { value: "lg",  label: "L",  px: 20 },
  { value: "xl",  label: "XL", px: 26 },
];

// ─── Print Dialog ─────────────────────────────────────────────────────────────

function PrintDialog({ item, open, onClose }: {
  item: QRCodeItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [size, setSize] = useState("medium");
  const [customCm, setCustomCm] = useState("12");
  const [textSize, setTextSize] = useState("sm");
  const [extraText, setExtraText] = useState("");
  const [saving, setSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  // Resolved cm / screen-px for the QR graphic
  const resolvedCm   = size === "custom" ? (parseFloat(customCm) || 10) : (PRINT_SIZES.find((s) => s.value === size)?.cm  || 10);
  const previewPx    = size === "custom" ? Math.round((parseFloat(customCm) || 10) * 37.8) : (PRINT_SIZES.find((s) => s.value === size)?.px || 240);
  const textPx       = TEXT_SIZES.find((t) => t.value === textSize)?.px || 13;
  const showName     = item?.showName ?? true;

  const handlePrint = useCallback(() => {
    const styleId = "qr-print-inject";
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) { style = document.createElement("style"); style.id = styleId; document.head.appendChild(style); }
    style.textContent = `
      @media print {
        * { visibility: hidden !important; box-sizing: border-box; }
        #qr-print-target, #qr-print-target * { visibility: visible !important; }
        #qr-print-target {
          position: fixed !important;
          top: 50% !important; left: 50% !important;
          transform: translate(-50%, -50%) !important;
          text-align: center;
          padding: 24px;
          border-radius: 12px;
        }
        #qr-print-target svg { width: ${resolvedCm}cm !important; height: ${resolvedCm}cm !important; display: block !important; }
        .qr-print-text { font-family: sans-serif; font-size: ${textPx}px; margin-top: 8px; }
      }
    `;
    window.print();
    setTimeout(() => style?.remove(), 2000);
  }, [resolvedCm, textPx]);

  const handleSaveImage = useCallback(async () => {
    if (!previewRef.current || !item) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 3 });
      const link = document.createElement("a");
      link.download = `${item.name.replace(/\s+/g, "-").toLowerCase()}-qr.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setSaving(false);
    }
  }, [item]);

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-sm mx-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">

          {/* Live preview (print target) */}
          <div className="flex justify-center">
            <div
              id="qr-print-target"
              ref={previewRef}
              className="flex flex-col items-center p-5 rounded-2xl"
              style={{ backgroundColor: item.bgColor }}
            >
              <QRCodeSVG
                value={item.content || " "}
                fgColor={item.fgColor}
                bgColor={item.bgColor}
                size={Math.min(previewPx, 220)}
              />
              {showName && (
                <p
                  className="qr-print-text font-medium text-center mt-2 leading-tight"
                  style={{ color: item.fgColor, fontSize: textPx }}
                >
                  {item.name}
                </p>
              )}
              {extraText.trim() && (
                <p
                  className="qr-print-text text-center mt-1 leading-tight"
                  style={{ color: item.fgColor, fontSize: textPx }}
                >
                  {extraText}
                </p>
              )}
            </div>
          </div>

          {/* Size picker */}
          <div className="space-y-1.5">
            <Label>Size</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {PRINT_SIZES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setSize(s.value)}
                  className={`flex flex-col items-center py-2 px-1 rounded-xl border text-center transition-colors ${
                    size === s.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <span className="text-[11px] font-semibold">{s.label}</span>
                  {s.value !== "custom" && <span className="text-[9px] mt-0.5 leading-tight opacity-70">{s.dim}</span>}
                </button>
              ))}
            </div>
            {size === "custom" && (
              <div className="flex items-center gap-2 mt-2">
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={customCm}
                  onChange={(e) => setCustomCm(e.target.value)}
                  className="h-9 rounded-xl w-24 text-sm"
                />
                <span className="text-sm text-muted-foreground">cm × cm</span>
              </div>
            )}
          </div>

          {/* Text size — only shown when name is visible */}
          {(showName || extraText.trim()) && (
            <div className="space-y-1.5">
              <Label>Text Size</Label>
              <div className="flex gap-1.5">
                {TEXT_SIZES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTextSize(t.value)}
                    className={`flex-1 py-2 rounded-xl border text-center transition-colors ${
                      textSize === t.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                    }`}
                  >
                    <span className="text-xs font-semibold">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Extra text */}
          <div className="space-y-1.5">
            <Label>Extra Text <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea
              value={extraText}
              onChange={(e) => setExtraText(e.target.value)}
              placeholder="e.g. Scan to visit our website"
              className="rounded-xl text-sm resize-none"
              rows={2}
            />
          </div>

          {/* Actions */}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={onClose} className="h-10 rounded-xl text-xs px-2">
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleSaveImage}
              disabled={saving}
              className="h-10 rounded-xl gap-1 text-xs px-2"
            >
              <Download className="w-3.5 h-3.5" />
              {saving ? "Saving…" : "Save PNG"}
            </Button>
            <Button onClick={handlePrint} className="h-10 rounded-xl gap-1 text-xs px-2">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Label Designer Dialog ────────────────────────────────────────────────────

type QRPosition  = "left" | "centre" | "right";
type TextPos     = "above" | "below" | "left" | "right";

interface LabelConfig {
  widthCm:       number;
  heightCm:      number;
  bgColor:       string;
  // border
  borderOn:      boolean;
  borderWidth:   number;   // px
  borderColor:   string;
  borderRadius:  number;   // px
  // QR
  qrPosition:    QRPosition;
  qrSizePct:     number;   // % of label height
  // name text
  nameOn:        boolean;
  namePos:       TextPos;
  nameSizePt:    number;
  nameBold:      boolean;
  nameItalic:    boolean;
  nameColor:     string;
  // name override (multi-line custom text replacing item.name)
  nameOverride?: string;
  // extra text
  extraOn:       boolean;
  extraText:     string;
  extraPos:      TextPos;
  extraSizePt:   number;
  extraBold:     boolean;
  extraItalic:   boolean;
  extraColor:    string;
}

const DEFAULT_LABEL: LabelConfig = {
  widthCm: 8, heightCm: 5,
  bgColor: "#ffffff",
  borderOn: true, borderWidth: 2, borderColor: "#000000", borderRadius: 8,
  qrPosition: "centre", qrSizePct: 70,
  nameOn: true, namePos: "below", nameSizePt: 11, nameBold: true, nameItalic: false, nameColor: "#000000",
  nameOverride: "",
  extraOn: false, extraText: "", extraPos: "below", extraSizePt: 9, extraBold: false, extraItalic: false, extraColor: "#555555",
};

// Scale factor: render at 96px/cm then scale preview down to fit dialog
const CM_TO_PX = 96 / 2.54;

function LabelPreview({ item, cfg, scale = 1 }: { item: QRCodeItem; cfg: LabelConfig; scale?: number }) {
  const W = cfg.widthCm  * CM_TO_PX;
  const H = cfg.heightCm * CM_TO_PX;
  const qrPx = Math.round((cfg.qrSizePct / 100) * H);

  // Which text positions are beside the QR (row layout)?
  const nameBeside  = cfg.nameOn  && (cfg.namePos  === "left" || cfg.namePos  === "right");
  const extraBeside = cfg.extraOn && cfg.extraText.trim() && (cfg.extraPos === "left" || cfg.extraPos === "right");

  const NameEl = cfg.nameOn ? (
    <p style={{
      fontSize: cfg.nameSizePt,
      fontWeight: cfg.nameBold    ? "bold"   : "normal",
      fontStyle:  cfg.nameItalic  ? "italic" : "normal",
      color: cfg.nameColor,
      textAlign: "center",
      lineHeight: 1.3,
      whiteSpace: "pre-wrap",
    }}>{cfg.nameOverride?.trim() ? cfg.nameOverride : item.name}</p>
  ) : null;

  const ExtraEl = (cfg.extraOn && cfg.extraText.trim()) ? (
    <p style={{
      fontSize: cfg.extraSizePt,
      fontWeight: cfg.extraBold   ? "bold"   : "normal",
      fontStyle:  cfg.extraItalic ? "italic" : "normal",
      color: cfg.extraColor,
      textAlign: "center",
      lineHeight: 1.3,
      whiteSpace: "pre-wrap",
    }}>{cfg.extraText}</p>
  ) : null;

  const QREl = (
    <QRCodeSVG
      value={item.content || " "}
      fgColor={item.fgColor}
      bgColor="transparent"
      size={qrPx}
      style={{ display: "block", flexShrink: 0 }}
    />
  );

  // Build inner content based on positions
  const renderInner = () => {
    // Collect row (beside) elements
    const leftOfQR:  React.ReactNode[] = [];
    const rightOfQR: React.ReactNode[] = [];
    if (cfg.nameOn  && cfg.namePos  === "left")  leftOfQR.push(<Fragment key="name">{NameEl}</Fragment>);
    if (cfg.nameOn  && cfg.namePos  === "right") rightOfQR.push(<Fragment key="name">{NameEl}</Fragment>);
    if (cfg.extraOn && cfg.extraText.trim() && cfg.extraPos === "left")  leftOfQR.push(<Fragment key="extra">{ExtraEl}</Fragment>);
    if (cfg.extraOn && cfg.extraText.trim() && cfg.extraPos === "right") rightOfQR.push(<Fragment key="extra">{ExtraEl}</Fragment>);

    const topItems: React.ReactNode[] = [];
    const bottomItems: React.ReactNode[] = [];
    if (cfg.nameOn  && cfg.namePos  === "above") topItems.push(<Fragment key="name">{NameEl}</Fragment>);
    if (cfg.extraOn && cfg.extraText.trim() && cfg.extraPos === "above") topItems.push(<Fragment key="extra">{ExtraEl}</Fragment>);
    if (cfg.nameOn  && cfg.namePos  === "below") bottomItems.push(<Fragment key="name">{NameEl}</Fragment>);
    if (cfg.extraOn && cfg.extraText.trim() && cfg.extraPos === "below") bottomItems.push(<Fragment key="extra">{ExtraEl}</Fragment>);

    const qrAlign = cfg.qrPosition === "left" ? "flex-start" : cfg.qrPosition === "right" ? "flex-end" : "center";

    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: qrAlign, justifyContent: "center", width: "100%", height: "100%", gap: 4 }}>
        {topItems.length > 0 && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>{topItems}</div>}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 6 }}>
          {leftOfQR.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{leftOfQR}</div>}
          {QREl}
          {rightOfQR.length > 0 && <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>{rightOfQR}</div>}
        </div>
        {bottomItems.length > 0 && <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>{bottomItems}</div>}
      </div>
    );
  };

  return (
    <div style={{
      width: W, height: H,
      backgroundColor: cfg.bgColor,
      border: cfg.borderOn ? `${cfg.borderWidth}px solid ${cfg.borderColor}` : "none",
      borderRadius: cfg.borderRadius,
      overflow: "hidden",
      boxSizing: "border-box",
      padding: 8,
      transform: `scale(${scale})`,
      transformOrigin: "top left",
      position: "relative",
    }}>
      {renderInner()}
    </div>
  );
}

// Mini helper row for a labelled control
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground flex-shrink-0 w-24">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

// Pill selector
function Pills<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
            value === o.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function LabelDesignerDialog({ item, open, onClose }: {
  item: QRCodeItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const [cfg, setCfg] = useState<LabelConfig>({ ...DEFAULT_LABEL, nameOverride: item?.name ?? "" });
  const previewRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // Reset cfg (including nameOverride) when item changes
  useEffect(() => {
    setCfg({ ...DEFAULT_LABEL, nameOverride: item?.name ?? "" });
  }, [item]);

  const set = <K extends keyof LabelConfig>(k: K, v: LabelConfig[K]) =>
    setCfg((c) => ({ ...c, [k]: v }));

  // Scale preview to fit ~280px wide
  const PREVIEW_MAX_W = 280;
  const naturalW = cfg.widthCm * CM_TO_PX;
  const scale = Math.min(1, PREVIEW_MAX_W / naturalW);
  const scaledH = cfg.heightCm * CM_TO_PX * scale;

  const handlePrint = useCallback(() => {
    if (!item) return;
    const W = cfg.widthCm  * CM_TO_PX;
    const H = cfg.heightCm * CM_TO_PX;
    const styleId = "qr-label-print";
    let s = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!s) { s = document.createElement("style"); s.id = styleId; document.head.appendChild(s); }
    s.textContent = `
      @media print {
        * { visibility: hidden !important; }
        #qr-label-print-target, #qr-label-print-target * { visibility: visible !important; }
        #qr-label-print-target {
          position: fixed !important;
          top: 50% !important; left: 50% !important;
          transform: translate(-50%,-50%) scale(1) !important;
          width: ${cfg.widthCm}cm !important;
          height: ${cfg.heightCm}cm !important;
        }
      }
    `;
    window.print();
    setTimeout(() => s?.remove(), 2000);
  }, [cfg, item]);

  const handleSave = useCallback(async () => {
    if (!previewRef.current || !item) return;
    setExporting(true);
    try {
      // Temporarily scale to 1 for export
      const el = previewRef.current.firstElementChild as HTMLElement | null;
      if (el) el.style.transform = "scale(1)";
      const dataUrl = await toPng(previewRef.current, { cacheBust: true, pixelRatio: 3 });
      if (el) el.style.transform = `scale(${scale})`;
      const link = document.createElement("a");
      link.download = `${item.name.replace(/\s+/g, "-").toLowerCase()}-label.png`;
      link.href = dataUrl;
      link.click();
    } finally { setExporting(false); }
  }, [item, scale]);

  if (!item) return null;

  const qrPosPills: { value: QRPosition; label: string }[] = [
    { value: "left",   label: "Left"   },
    { value: "centre", label: "Centre" },
    { value: "right",  label: "Right"  },
  ];
  const textPosPills: { value: TextPos; label: string }[] = [
    { value: "above", label: "Above" },
    { value: "below", label: "Below" },
    { value: "left",  label: "Left"  },
    { value: "right", label: "Right" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent aria-describedby={undefined} className="max-w-md mx-2 max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="w-4 h-4" /> Label Designer — {item.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">

          {/* ── Live preview ── */}
          <div
            className="flex justify-center"
            ref={previewRef}
            style={{ height: scaledH + 2, overflow: "visible" }}
          >
            <div id="qr-label-print-target">
              <LabelPreview item={item} cfg={cfg} scale={scale} />
            </div>
          </div>

          {/* ── Label size ── */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Label Size</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Width (cm)</p>
                <Input type="number" min="1" max="50" step="0.5" value={cfg.widthCm}
                  onChange={(e) => set("widthCm", parseFloat(e.target.value) || 8)}
                  className="h-9 rounded-xl text-sm" />
              </div>
              <div className="space-y-1">
                <p className="text-[11px] text-muted-foreground">Height (cm)</p>
                <Input type="number" min="1" max="50" step="0.5" value={cfg.heightCm}
                  onChange={(e) => set("heightCm", parseFloat(e.target.value) || 5)}
                  className="h-9 rounded-xl text-sm" />
              </div>
            </div>
            <Row label="Background">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md border border-border flex-shrink-0" style={{ backgroundColor: cfg.bgColor }} />
                <Input type="color" value={cfg.bgColor} onChange={(e) => set("bgColor", e.target.value)}
                  className="h-8 w-12 rounded-lg border border-border cursor-pointer p-0.5" />
                <span className="text-[11px] font-mono text-muted-foreground">{cfg.bgColor}</span>
              </div>
            </Row>
          </div>

          {/* ── Border ── */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Border</p>
              <Switch checked={cfg.borderOn} onCheckedChange={(v) => set("borderOn", v)} />
            </div>
            {cfg.borderOn && (
              <div className="space-y-2">
                <Row label="Colour">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md border border-border flex-shrink-0" style={{ backgroundColor: cfg.borderColor }} />
                    <Input type="color" value={cfg.borderColor} onChange={(e) => set("borderColor", e.target.value)}
                      className="h-8 w-12 rounded-lg cursor-pointer p-0.5" />
                    <span className="text-[11px] font-mono text-muted-foreground">{cfg.borderColor}</span>
                  </div>
                </Row>
                <Row label="Thickness">
                  <div className="flex items-center gap-2">
                    <input type="range" min="1" max="12" value={cfg.borderWidth}
                      onChange={(e) => set("borderWidth", Number(e.target.value))}
                      className="flex-1 accent-primary" />
                    <span className="text-xs w-8 text-right text-muted-foreground">{cfg.borderWidth}px</span>
                  </div>
                </Row>
                <Row label="Corners">
                  <div className="flex items-center gap-2">
                    <input type="range" min="0" max="40" value={cfg.borderRadius}
                      onChange={(e) => set("borderRadius", Number(e.target.value))}
                      className="flex-1 accent-primary" />
                    <span className="text-xs w-8 text-right text-muted-foreground">{cfg.borderRadius}px</span>
                  </div>
                </Row>
              </div>
            )}
          </div>

          {/* ── QR Code position & size ── */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">QR Code</p>
            <Row label="Position">
              <Pills options={qrPosPills} value={cfg.qrPosition} onChange={(v) => set("qrPosition", v)} />
            </Row>
            <Row label="Size">
              <div className="flex items-center gap-2">
                <input type="range" min="20" max="95" value={cfg.qrSizePct}
                  onChange={(e) => set("qrSizePct", Number(e.target.value))}
                  className="flex-1 accent-primary" />
                <span className="text-xs w-10 text-right text-muted-foreground">{cfg.qrSizePct}%</span>
              </div>
            </Row>
          </div>

          {/* ── Name text ── */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Name Text</p>
              <Switch checked={cfg.nameOn} onCheckedChange={(v) => set("nameOn", v)} />
            </div>
            {cfg.nameOn && (
              <div className="space-y-2">
                <Textarea
                  value={cfg.nameOverride ?? item.name}
                  onChange={(e) => set("nameOverride", e.target.value)}
                  placeholder={item.name}
                  className="rounded-xl text-sm resize-none"
                  rows={2}
                />
                <Row label="Position">
                  <Pills options={textPosPills} value={cfg.namePos} onChange={(v) => set("namePos", v)} />
                </Row>
                <Row label="Size">
                  <div className="flex items-center gap-2">
                    <input type="range" min="6" max="28" value={cfg.nameSizePt}
                      onChange={(e) => set("nameSizePt", Number(e.target.value))}
                      className="flex-1 accent-primary" />
                    <span className="text-xs w-8 text-right text-muted-foreground">{cfg.nameSizePt}pt</span>
                  </div>
                </Row>
                <Row label="Style">
                  <div className="flex gap-1.5">
                    <button onClick={() => set("nameBold",   !cfg.nameBold)}
                      className={`px-3 py-1 rounded-lg border text-xs font-bold transition-colors ${cfg.nameBold ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>B</button>
                    <button onClick={() => set("nameItalic", !cfg.nameItalic)}
                      className={`px-3 py-1 rounded-lg border text-xs italic transition-colors ${cfg.nameItalic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>I</button>
                  </div>
                </Row>
                <Row label="Colour">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md border border-border flex-shrink-0" style={{ backgroundColor: cfg.nameColor }} />
                    <Input type="color" value={cfg.nameColor} onChange={(e) => set("nameColor", e.target.value)}
                      className="h-8 w-12 rounded-lg cursor-pointer p-0.5" />
                    <span className="text-[11px] font-mono text-muted-foreground">{cfg.nameColor}</span>
                  </div>
                </Row>
              </div>
            )}
          </div>

          {/* ── Extra text ── */}
          <div className="rounded-2xl border border-border/50 bg-muted/20 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Extra Text</p>
              <Switch checked={cfg.extraOn} onCheckedChange={(v) => set("extraOn", v)} />
            </div>
            {cfg.extraOn && (
              <div className="space-y-2">
                <Textarea
                  value={cfg.extraText}
                  onChange={(e) => set("extraText", e.target.value)}
                  placeholder="e.g. Scan to visit our website"
                  className="rounded-xl text-sm resize-none"
                  rows={2}
                />
                <Row label="Position">
                  <Pills options={textPosPills} value={cfg.extraPos} onChange={(v) => set("extraPos", v)} />
                </Row>
                <Row label="Size">
                  <div className="flex items-center gap-2">
                    <input type="range" min="6" max="28" value={cfg.extraSizePt}
                      onChange={(e) => set("extraSizePt", Number(e.target.value))}
                      className="flex-1 accent-primary" />
                    <span className="text-xs w-8 text-right text-muted-foreground">{cfg.extraSizePt}pt</span>
                  </div>
                </Row>
                <Row label="Style">
                  <div className="flex gap-1.5">
                    <button onClick={() => set("extraBold",   !cfg.extraBold)}
                      className={`px-3 py-1 rounded-lg border text-xs font-bold transition-colors ${cfg.extraBold ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>B</button>
                    <button onClick={() => set("extraItalic", !cfg.extraItalic)}
                      className={`px-3 py-1 rounded-lg border text-xs italic transition-colors ${cfg.extraItalic ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>I</button>
                  </div>
                </Row>
                <Row label="Colour">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-md border border-border flex-shrink-0" style={{ backgroundColor: cfg.extraColor }} />
                    <Input type="color" value={cfg.extraColor} onChange={(e) => set("extraColor", e.target.value)}
                      className="h-8 w-12 rounded-lg cursor-pointer p-0.5" />
                    <span className="text-[11px] font-mono text-muted-foreground">{cfg.extraColor}</span>
                  </div>
                </Row>
              </div>
            )}
          </div>

          {/* ── Actions ── */}
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={onClose} className="h-10 rounded-xl text-xs px-2">Cancel</Button>
            <Button variant="outline" onClick={handleSave} disabled={exporting} className="h-10 rounded-xl gap-1 text-xs px-2">
              <Download className="w-3.5 h-3.5" />{exporting ? "Saving…" : "Save PNG"}
            </Button>
            <Button onClick={handlePrint} className="h-10 rounded-xl gap-1 text-xs px-2">
              <Printer className="w-3.5 h-3.5" /> Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── QR Card ──────────────────────────────────────────────────────────────────

function QRCard({ item, index, onEdit, onDelete, onPrint, onLabel }: {
  item: QRCodeItem;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onPrint: () => void;
  onLabel: () => void;
}) {
  const typeInfo = CONTENT_TYPES.find((t) => t.value === item.contentType) || CONTENT_TYPES[0];
  const TypeIcon = typeInfo.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-2xl border border-border/50 bg-card shadow-soft p-4 space-y-3"
    >
      {/* QR preview + info */}
      <div className="flex items-start gap-3">
        <div
          className="rounded-xl p-2 flex-shrink-0"
          style={{ backgroundColor: item.bgColor, border: "1px solid hsl(var(--border) / 0.3)" }}
        >
          <QRCodeSVG
            value={item.content || " "}
            fgColor={item.fgColor}
            bgColor={item.bgColor}
            size={64}
          />
          {item.showName && (
            <p className="text-[9px] font-medium text-center mt-1 leading-tight max-w-[64px] truncate" style={{ color: item.fgColor }}>
              {item.name}
            </p>
          )}
        </div>
        <div className="flex-1 min-w-0 pt-0.5 space-y-1">
          <p className="text-sm font-bold text-card-foreground leading-tight truncate">{item.name}</p>
          {item.category && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground inline-block">
              {item.category}
            </span>
          )}
          <div className="flex items-center gap-1">
            <TypeIcon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
            <span className="text-[10px] text-muted-foreground">{typeInfo.label}</span>
          </div>
          <p className="text-[10px] text-muted-foreground truncate leading-tight">{item.content}</p>
          {/* Colour swatches */}
          <div className="flex items-center gap-1 pt-0.5">
            <div className="w-3.5 h-3.5 rounded-full border border-border/50" style={{ backgroundColor: item.fgColor }} title={`QR: ${item.fgColor}`} />
            <div className="w-3.5 h-3.5 rounded-full border border-border/50" style={{ backgroundColor: item.bgColor }} title={`BG: ${item.bgColor}`} />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 pt-1 border-t border-border/30">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1 h-8 rounded-lg text-xs gap-1 px-2">
          <Edit2 className="w-3 h-3" /> Edit
        </Button>
        <Button size="sm" variant="outline" onClick={onPrint} className="flex-1 h-8 rounded-lg text-xs gap-1 px-2">
          <Printer className="w-3 h-3" /> Print
        </Button>
        <Button size="sm" variant="outline" onClick={onLabel} className="flex-1 h-8 rounded-lg text-xs gap-1 px-2 text-violet-600 dark:text-violet-400 border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20">
          <Tag className="w-3 h-3" /> Label
        </Button>
        <button
          onClick={onDelete}
          className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Generator View ───────────────────────────────────────────────────────────

function GeneratorView({ editItem, settings, categories, onSave, onBack, saving }: {
  editItem: QRCodeItem | null;
  settings: { fgColor: string; bgColor: string };
  categories: string[];
  onSave: (item: Omit<QRCodeItem, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onBack: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    name:        editItem?.name        ?? "",
    category:    editItem?.category    ?? "",
    contentType: editItem?.contentType ?? ("url" as QRCodeItem["contentType"]),
    content:     editItem?.content     ?? "",
    fgColor:     editItem?.fgColor     ?? settings.fgColor,
    bgColor:     editItem?.bgColor     ?? settings.bgColor,
    showName:    editItem?.showName    ?? true,
  });
  const setF = (k: keyof typeof form, v: any) => setForm((f) => ({ ...f, [k]: v }));
  const isValid = form.name.trim().length > 0 && form.content.trim().length > 0;
  const ctInfo = CONTENT_TYPES.find((t) => t.value === form.contentType)!;

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to library
      </button>

      <h2 className="text-lg font-bold font-display">
        {editItem ? `Edit — ${editItem.name}` : "New QR Code"}
      </h2>

      {/* Live preview */}
      <div className="flex justify-center">
        <div
          className="rounded-2xl p-5 shadow-sm border border-border/40"
          style={{ backgroundColor: form.bgColor }}
        >
          <QRCodeSVG
            value={form.content.trim() || "https://example.com"}
            fgColor={form.fgColor}
            bgColor={form.bgColor}
            size={160}
          />
          {form.name && form.showName && (
            <p className="text-center text-xs mt-3 font-medium" style={{ color: form.fgColor }}>
              {form.name}
            </p>
          )}
        </div>
      </div>

      {/* Form */}
      <div className="space-y-4">
        {/* Name */}
        <div className="space-y-1.5">
          <Label>Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setF("name", e.target.value)}
            placeholder="e.g. BGM Health Website"
            className="h-10 rounded-xl"
          />
        </div>

        {/* Show name toggle */}
        <div className="flex items-center justify-between py-0.5">
          <div>
            <p className="text-sm font-medium leading-tight">Show name below QR code</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Displays on the code itself and when printing</p>
          </div>
          <Switch checked={!!form.showName} onCheckedChange={(v) => setF("showName", v)} />
        </div>

        {/* Content type selector */}
        <div className="space-y-1.5">
          <Label>Type</Label>
          <div className="grid grid-cols-3 gap-2">
            {CONTENT_TYPES.map((t) => {
              const Icon = t.icon;
              return (
                <button
                  key={t.value}
                  onClick={() => setF("contentType", t.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-colors ${
                    form.contentType === t.value
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[11px] font-medium leading-tight text-center">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="space-y-1.5">
          <Label>
            {form.contentType === "url" ? "URL" : form.contentType === "image" ? "Image URL" : "Text"} *
          </Label>
          {form.contentType === "text" ? (
            <Textarea
              value={form.content}
              onChange={(e) => setF("content", e.target.value)}
              placeholder={ctInfo.placeholder}
              className="rounded-xl resize-none"
              rows={4}
            />
          ) : (
            <Input
              value={form.content}
              onChange={(e) => setF("content", e.target.value)}
              placeholder={ctInfo.placeholder}
              className="h-10 rounded-xl"
              type="url"
            />
          )}
        </div>

        {/* Colours */}
        <div className="space-y-1.5">
          <Label>Colours</Label>
          <div className="grid grid-cols-2 gap-3">
            {/* QR colour */}
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">QR Colour</p>
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/30">
                <div className="w-5 h-5 rounded-md border border-border/50 flex-shrink-0" style={{ backgroundColor: form.fgColor }} />
                <span className="text-[11px] font-mono flex-1 truncate">{form.fgColor}</span>
                <input
                  type="color"
                  value={form.fgColor}
                  onChange={(e) => setF("fgColor", e.target.value)}
                  className="w-7 h-7 rounded-lg border border-border cursor-pointer flex-shrink-0"
                />
              </div>
            </div>
            {/* Background colour */}
            <div className="space-y-1">
              <p className="text-[11px] text-muted-foreground">Background</p>
              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/30">
                <div className="w-5 h-5 rounded-md border border-border/50 flex-shrink-0" style={{ backgroundColor: form.bgColor }} />
                <span className="text-[11px] font-mono flex-1 truncate">{form.bgColor}</span>
                <input
                  type="color"
                  value={form.bgColor}
                  onChange={(e) => setF("bgColor", e.target.value)}
                  className="w-7 h-7 rounded-lg border border-border cursor-pointer flex-shrink-0"
                />
              </div>
            </div>
          </div>
          {/* Swap & reset helpers */}
          <div className="flex gap-2">
            <button
              onClick={() => setForm((f) => ({ ...f, fgColor: f.bgColor, bgColor: f.fgColor }))}
              className="text-[11px] text-primary font-medium"
            >
              ⇄ Swap colours
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={() => setForm((f) => ({ ...f, fgColor: "#000000", bgColor: "#ffffff" }))}
              className="text-[11px] text-muted-foreground hover:text-foreground"
            >
              Reset to black/white
            </button>
          </div>
        </div>

        {/* Category */}
        <div className="space-y-1.5">
          <Label>Category</Label>
          <div className="flex gap-2">
            <div className="flex-1">
              <Select value={form.category} onValueChange={(v) => setF("category", v)}>
                <SelectTrigger className="h-10 rounded-xl">
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category && (
              <button
                onClick={() => setF("category", "")}
                className="p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Save */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={onBack} className="flex-1 h-11 rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={() => onSave(form)}
            disabled={!isValid || saving}
            className="flex-1 h-11 rounded-xl"
          >
            {saving ? "Saving…" : editItem ? "Update QR Code" : "Save QR Code"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Settings View ────────────────────────────────────────────────────────────

function SettingsView({ onBack }: { onBack: () => void }) {
  const { settings, saveSettings } = useQRCodeSettings();
  const [fgColor, setFgColor] = useState(settings.fgColor);
  const [bgColor, setBgColor] = useState(settings.bgColor);
  const [cats, setCats] = useState<string[]>(settings.categories);
  const [newCat, setNewCat] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await saveSettings({ fgColor, bgColor, categories: cats });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const addCat = () => {
    const t = newCat.trim();
    if (t && !cats.includes(t)) { setCats((prev) => [...prev, t]); setNewCat(""); }
  };

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to library
      </button>

      <h2 className="text-lg font-bold font-display">QR Code Settings</h2>

      {/* Default colours */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Default Colours</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">QR Colour</p>
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/30">
              <div className="w-5 h-5 rounded-md border border-border/50 flex-shrink-0" style={{ backgroundColor: fgColor }} />
              <span className="text-[11px] font-mono flex-1 truncate">{fgColor}</span>
              <input type="color" value={fgColor} onChange={(e) => setFgColor(e.target.value)} className="w-7 h-7 rounded-lg border border-border cursor-pointer" />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">Background</p>
            <div className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/30">
              <div className="w-5 h-5 rounded-md border border-border/50 flex-shrink-0" style={{ backgroundColor: bgColor }} />
              <span className="text-[11px] font-mono flex-1 truncate">{bgColor}</span>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} className="w-7 h-7 rounded-lg border border-border cursor-pointer" />
            </div>
          </div>
        </div>
        <div className="flex justify-center pt-1">
          <div className="rounded-xl p-3" style={{ backgroundColor: bgColor }}>
            <QRCodeSVG value="https://example.com" fgColor={fgColor} bgColor={bgColor} size={80} />
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Categories</p>
        <div className="flex flex-wrap gap-1.5">
          {cats.map((cat) => (
            <span
              key={cat}
              className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground"
            >
              {cat}
              <button onClick={() => setCats((prev) => prev.filter((c) => c !== cat))} className="hover:text-destructive transition-colors">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addCat()}
            placeholder="Add new category…"
            className="h-9 rounded-xl text-sm"
          />
          <Button size="sm" onClick={addCat} className="h-9 rounded-xl px-3">Add</Button>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full h-11 rounded-xl gap-2">
        {saved ? <><Check className="w-4 h-4" /> Saved!</> : saving ? "Saving…" : "Save Settings"}
      </Button>
    </div>
  );
}

// ─── Library View ─────────────────────────────────────────────────────────────

function LibraryView({ qrCodes, loading, onNew, onEdit, onDelete, onPrint, onLabel, onSettings, selectedCategory, onCategoryChange }: {
  qrCodes: QRCodeItem[];
  loading: boolean;
  onNew: () => void;
  onEdit: (item: QRCodeItem) => void;
  onDelete: (id: string) => void;
  onPrint: (item: QRCodeItem) => void;
  onLabel: (item: QRCodeItem) => void;
  onSettings: () => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
}) {
  const usedCategories = useMemo(() =>
    Array.from(new Set(qrCodes.map((q) => q.category).filter(Boolean))) as string[],
    [qrCodes]
  );

  const filtered = selectedCategory
    ? qrCodes.filter((q) => q.category === selectedCategory)
    : qrCodes;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {qrCodes.length} {qrCodes.length === 1 ? "code" : "codes"} saved
        </p>
        <div className="flex gap-2">
          <button
            onClick={onSettings}
            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
          <Button size="sm" onClick={onNew} className="h-9 rounded-xl gap-1.5 text-xs px-3">
            <Plus className="w-3.5 h-3.5" /> New QR Code
          </Button>
        </div>
      </div>

      {/* Category filter pills */}
      {usedCategories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            onClick={() => onCategoryChange("")}
            className={`flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
              !selectedCategory ? "bg-primary text-white border-primary" : "border-border text-muted-foreground bg-muted/40"
            }`}
          >
            All
          </button>
          {usedCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => onCategoryChange(cat === selectedCategory ? "" : cat)}
              className={`flex-shrink-0 text-[11px] font-medium px-3 py-1.5 rounded-full border transition-colors ${
                selectedCategory === cat ? "bg-primary text-white border-primary" : "border-border text-muted-foreground bg-muted/40"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <QrCode className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {qrCodes.length === 0 ? "No QR codes yet" : "No codes in this category"}
          </p>
          <p className="text-xs text-muted-foreground">
            {qrCodes.length === 0 ? "Create your first QR code to get started" : "Try clearing the category filter"}
          </p>
          {qrCodes.length === 0 && (
            <Button size="sm" onClick={onNew} className="mt-2 rounded-xl gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Create First QR Code
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((item, i) => (
              <QRCard
                key={item.id}
                item={item}
                index={i}
                onEdit={() => onEdit(item)}
                onDelete={() => item.id && onDelete(item.id)}
                onPrint={() => onPrint(item)}
                onLabel={() => onLabel(item)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const QRCodes = () => {
  const { qrCodes, loading, addQRCode, updateQRCode, deleteQRCode } = useQRCodes();
  const { settings } = useQRCodeSettings();
  const navigate = useNavigate();

  const [view, setView] = useState<View>("library");
  const [editItem, setEditItem] = useState<QRCodeItem | null>(null);
  const [printItem, setPrintItem] = useState<QRCodeItem | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [labelItem, setLabelItem] = useState<QRCodeItem | null>(null);
  const [labelOpen, setLabelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");

  const allCategories = useMemo(() => {
    const fromSettings = settings.categories ?? [];
    const fromItems = qrCodes.map((q) => q.category).filter(Boolean) as string[];
    return Array.from(new Set([...fromSettings, ...fromItems]));
  }, [settings.categories, qrCodes]);

  const handleSave = async (form: Omit<QRCodeItem, "id" | "createdAt" | "updatedAt">) => {
    setSaving(true);
    try {
      if (editItem?.id) await updateQRCode(editItem.id, form);
      else await addQRCode(form);
      setView("library");
      setEditItem(null);
    } finally { setSaving(false); }
  };

  return (
    <FeaturePageShell
      title="QR Codes"
      subtitle="Generate & manage"
      icon={<QrCode className="w-5 h-5" />}
      action={
        <button
          onClick={() => navigate("/companies")}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
      }
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.15 }}
        >
          {view === "library" && (
            <LibraryView
              qrCodes={qrCodes}
              loading={loading}
              onNew={() => { setEditItem(null); setView("generator"); }}
              onEdit={(item) => { setEditItem(item); setView("generator"); }}
              onDelete={deleteQRCode}
              onPrint={(item) => { setPrintItem(item); setPrintOpen(true); }}
              onLabel={(item) => { setLabelItem(item); setLabelOpen(true); }}
              onSettings={() => setView("settings")}
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
            />
          )}
          {view === "generator" && (
            <GeneratorView
              editItem={editItem}
              settings={settings}
              categories={allCategories}
              onSave={handleSave}
              onBack={() => { setEditItem(null); setView("library"); }}
              saving={saving}
            />
          )}
          {view === "settings" && (
            <SettingsView onBack={() => setView("library")} />
          )}
        </motion.div>
      </AnimatePresence>

      <PrintDialog
        item={printItem}
        open={printOpen}
        onClose={() => setPrintOpen(false)}
      />

      <LabelDesignerDialog
        item={labelItem}
        open={labelOpen}
        onClose={() => setLabelOpen(false)}
      />
    </FeaturePageShell>
  );
};

export default QRCodes;

import { useState, useRef, useCallback, useEffect } from "react";
import { Rnd } from "react-rnd";
import QRCodeSVG from "react-qr-code";
import { toPng } from "html-to-image";
import { QRCodeItem, LabelDesign, LabelElement } from "@/types/app";
import RichTextEditor from "@/components/RichTextEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  QrCode as QrCodeIcon,
  Type,
  ImageIcon,
  Square,
  Trash2,
  Printer,
  Download,
  Save,
  ArrowLeft,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

// ─── Constants ─────────────────────────────────────────────────────────────────

const PRINT_PX_PER_CM = 96 / 2.54; // browser print resolution

// ─── Helpers ───────────────────────────────────────────────────────────────────

function genId() {
  return Math.random().toString(36).slice(2, 9);
}

function roundCm(v: number) {
  return Math.round(v * 100) / 100;
}

export function makeDefaultDesign(item: QRCodeItem): LabelDesign {
  return {
    widthCm: 10,
    heightCm: 5,
    bgColor: "#ffffff",
    elements: [
      {
        id: genId(),
        type: "qr",
        xCm: 3.5, yCm: 0.5, wCm: 3, hCm: 3,
        zIndex: 1,
        qrItemId: "self",
        qrFgColor: item.fgColor,
        qrBgColor: "transparent",
      },
      {
        id: genId(),
        type: "text",
        xCm: 0.5, yCm: 4.0, wCm: 9, hCm: 0.8,
        zIndex: 2,
        fontSizePt: 14,
        html: `<p style="text-align:center;font-weight:bold">${item.name}</p>`,
      },
    ],
  };
}

// ─── Element content renderer ─────────────────────────────────────────────────

interface ElContentProps {
  el: LabelElement;
  item: QRCodeItem;
  allItems: QRCodeItem[];
  pxPerCm: number;
}

function ElContent({ el, item, allItems, pxPerCm }: ElContentProps) {
  if (el.type === "qr") {
    const qrItem =
      !el.qrItemId || el.qrItemId === "self"
        ? item
        : (allItems.find((i) => i.id === el.qrItemId) ?? item);
    const sz = Math.max(8, Math.floor(Math.min(el.wCm, el.hCm) * pxPerCm));
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: el.qrBgColor || "transparent",
        }}
      >
        <QRCodeSVG
          value={qrItem.content || " "}
          fgColor={el.qrFgColor || qrItem.fgColor || "#000000"}
          bgColor={el.qrBgColor || "transparent"}
          size={sz}
          style={{ display: "block", maxWidth: "100%", maxHeight: "100%" }}
        />
      </div>
    );
  }

  if (el.type === "text") {
    return (
      <div
        className="qr-label-rich"
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          userSelect: "none",
          fontSize: el.fontSizePt ? `${el.fontSizePt}pt` : undefined,
        }}
        dangerouslySetInnerHTML={{ __html: el.html || "" }}
      />
    );
  }

  if (el.type === "image") {
    return el.src ? (
      <img
        src={el.src}
        alt=""
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: (el.objectFit as any) || "contain",
          borderRadius: el.imgRadius ? `${el.imgRadius}px` : 0,
        }}
      />
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#f0f0f0",
          color: "#aaa",
          fontSize: 10,
          fontFamily: "sans-serif",
        }}
      >
        No image URL
      </div>
    );
  }

  if (el.type === "shape") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          boxSizing: "border-box",
          backgroundColor: el.fillColor || "#cccccc",
          border:
            (el.strokeWidth || 0) > 0
              ? `${el.strokeWidth}px solid ${el.strokeColor || "#000"}`
              : "none",
          borderRadius:
            el.shape === "ellipse" ? "50%" : el.shapeRadius ? `${el.shapeRadius}px` : 0,
        }}
      />
    );
  }

  return null;
}

// ─── Properties panel ─────────────────────────────────────────────────────────

function PosSizeFields({
  el,
  onChange,
}: {
  el: LabelElement;
  onChange: (p: Partial<LabelElement>) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Position & Size
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {(
          [
            { key: "xCm", label: "X (cm)" },
            { key: "yCm", label: "Y (cm)" },
            { key: "wCm", label: "W (cm)" },
            { key: "hCm", label: "H (cm)" },
          ] as { key: keyof LabelElement; label: string }[]
        ).map(({ key, label }) => (
          <div key={key} className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">{label}</p>
            <Input
              type="number"
              step="0.1"
              min={key === "wCm" || key === "hCm" ? "0.1" : undefined}
              value={roundCm(el[key] as number)}
              onChange={(e) =>
                onChange({ [key]: parseFloat(e.target.value) || 0 } as Partial<LabelElement>)
              }
              className="h-7 rounded-lg text-xs px-2"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

interface PropsPanelProps {
  design: LabelDesign;
  selectedId: string | null;
  allItems: QRCodeItem[];
  item: QRCodeItem;
  onChangeDesign: (p: Partial<LabelDesign>) => void;
  onUpdateEl: (id: string, p: Partial<LabelElement>) => void;
  onDeleteEl: (id: string) => void;
}

function PropertiesPanel({
  design,
  selectedId,
  allItems,
  item,
  onChangeDesign,
  onUpdateEl,
  onDeleteEl,
}: PropsPanelProps) {
  const el = design.elements.find((e) => e.id === selectedId) ?? null;

  // Label settings (no element selected)
  if (!el) {
    return (
      <div className="p-3 space-y-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Label Settings
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Width (cm)</p>
            <Input
              type="number"
              step="0.5"
              min="1"
              max="50"
              value={design.widthCm}
              onChange={(e) => onChangeDesign({ widthCm: parseFloat(e.target.value) || 10 })}
              className="h-7 rounded-lg text-xs px-2"
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Height (cm)</p>
            <Input
              type="number"
              step="0.5"
              min="1"
              max="50"
              value={design.heightCm}
              onChange={(e) => onChangeDesign({ heightCm: parseFloat(e.target.value) || 5 })}
              className="h-7 rounded-lg text-xs px-2"
            />
          </div>
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] text-muted-foreground">Background Colour</p>
          <div className="flex items-center gap-2">
            <div
              className="w-6 h-6 rounded-md border border-border flex-shrink-0"
              style={{ backgroundColor: design.bgColor }}
            />
            <input
              type="color"
              value={design.bgColor}
              onChange={(e) => onChangeDesign({ bgColor: e.target.value })}
              className="h-7 w-12 rounded-lg border border-border cursor-pointer p-0.5"
            />
            <span className="text-[11px] font-mono text-muted-foreground">{design.bgColor}</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground/60 border-t border-border/30 pt-3">
          Click any element on the canvas to edit it, or use the left panel to add elements.
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {el.type === "qr"
            ? "QR Code"
            : el.type === "text"
            ? "Text"
            : el.type === "image"
            ? "Image"
            : "Shape"}
        </p>
        <button
          onClick={() => onDeleteEl(el.id)}
          className="p-1 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* QR properties */}
      {el.type === "qr" && (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">QR Source</p>
            <Select
              value={el.qrItemId || "self"}
              onValueChange={(v) => onUpdateEl(el.id, { qrItemId: v })}
            >
              <SelectTrigger className="h-8 rounded-xl text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="self">{item.name} (this QR)</SelectItem>
                {allItems
                  .filter((i) => i.id && i.id !== item.id)
                  .map((i) => (
                    <SelectItem key={i.id} value={i.id!}>
                      {i.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Foreground</p>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-md border border-border"
                  style={{ backgroundColor: el.qrFgColor || "#000000" }}
                />
                <input
                  type="color"
                  value={el.qrFgColor || "#000000"}
                  onChange={(e) => onUpdateEl(el.id, { qrFgColor: e.target.value })}
                  className="h-6 w-9 rounded border cursor-pointer p-0.5"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Background</p>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-md border border-border"
                  style={{ backgroundColor: el.qrBgColor === "transparent" ? "#ffffff" : (el.qrBgColor || "#ffffff") }}
                />
                <input
                  type="color"
                  value={el.qrBgColor === "transparent" ? "#ffffff" : (el.qrBgColor || "#ffffff")}
                  onChange={(e) => onUpdateEl(el.id, { qrBgColor: e.target.value })}
                  className="h-6 w-9 rounded border cursor-pointer p-0.5"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Text properties */}
      {el.type === "text" && (
        <div className="space-y-2.5">
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Font Size (pt)</p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="6"
                max="72"
                value={el.fontSizePt || 14}
                onChange={(e) => onUpdateEl(el.id, { fontSizePt: Number(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <Input
                type="number"
                min="6"
                max="200"
                value={el.fontSizePt || 14}
                onChange={(e) => onUpdateEl(el.id, { fontSizePt: Number(e.target.value) || 14 })}
                className="h-7 w-14 rounded-lg text-xs px-2"
              />
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">Content</p>
            <RichTextEditor
              key={el.id}
              value={el.html || ""}
              onChange={(html) => onUpdateEl(el.id, { html })}
              placeholder="Enter text…"
              minHeight={44}
            />
          </div>
        </div>
      )}

      {/* Image properties */}
      {el.type === "image" && (
        <div className="space-y-2.5">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Image URL</p>
            <Input
              value={el.src || ""}
              onChange={(e) => onUpdateEl(el.id, { src: e.target.value })}
              placeholder="https://…"
              className="h-7 rounded-lg text-xs px-2"
            />
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Fit</p>
            <div className="flex gap-1">
              {(["contain", "cover", "fill"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => onUpdateEl(el.id, { objectFit: f })}
                  className={`flex-1 py-1 rounded-lg border text-[10px] font-medium transition-colors capitalize ${
                    (el.objectFit || "contain") === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Corner Radius</p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="200"
                value={el.imgRadius || 0}
                onChange={(e) => onUpdateEl(el.id, { imgRadius: Number(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="text-[10px] text-muted-foreground w-8 text-right">
                {el.imgRadius || 0}px
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Shape properties */}
      {el.type === "shape" && (
        <div className="space-y-2.5">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Shape</p>
            <div className="flex gap-1">
              {(["rect", "ellipse"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdateEl(el.id, { shape: s })}
                  className={`flex-1 py-1 rounded-lg border text-[10px] font-medium transition-colors ${
                    (el.shape || "rect") === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted/60"
                  }`}
                >
                  {s === "rect" ? "Rectangle" : "Ellipse"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Fill</p>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-md border border-border"
                  style={{ backgroundColor: el.fillColor || "#cccccc" }}
                />
                <input
                  type="color"
                  value={el.fillColor || "#cccccc"}
                  onChange={(e) => onUpdateEl(el.id, { fillColor: e.target.value })}
                  className="h-6 w-9 rounded border cursor-pointer p-0.5"
                />
              </div>
            </div>
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Border</p>
              <div className="flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded-md border border-border"
                  style={{ backgroundColor: el.strokeColor || "#000000" }}
                />
                <input
                  type="color"
                  value={el.strokeColor || "#000000"}
                  onChange={(e) => onUpdateEl(el.id, { strokeColor: e.target.value })}
                  className="h-6 w-9 rounded border cursor-pointer p-0.5"
                />
              </div>
            </div>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Border Width</p>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0"
                max="20"
                value={el.strokeWidth || 0}
                onChange={(e) => onUpdateEl(el.id, { strokeWidth: Number(e.target.value) })}
                className="flex-1 accent-primary"
              />
              <span className="text-[10px] text-muted-foreground w-8 text-right">
                {el.strokeWidth || 0}px
              </span>
            </div>
          </div>
          {(el.shape || "rect") !== "ellipse" && (
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground">Corner Radius</p>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={el.shapeRadius || 0}
                  onChange={(e) => onUpdateEl(el.id, { shapeRadius: Number(e.target.value) })}
                  className="flex-1 accent-primary"
                />
                <span className="text-[10px] text-muted-foreground w-8 text-right">
                  {el.shapeRadius || 0}px
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shared: opacity */}
      <div className="space-y-0.5">
        <p className="text-[10px] text-muted-foreground">Opacity</p>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={el.opacity ?? 1}
            onChange={(e) => onUpdateEl(el.id, { opacity: Number(e.target.value) })}
            className="flex-1 accent-primary"
          />
          <span className="text-[10px] text-muted-foreground w-8 text-right">
            {Math.round((el.opacity ?? 1) * 100)}%
          </span>
        </div>
      </div>

      {/* Shared: position & size */}
      <PosSizeFields el={el} onChange={(p) => onUpdateEl(el.id, p)} />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

interface LabelDesignerProps {
  item: QRCodeItem;
  allItems: QRCodeItem[];
  onClose: () => void;
  onSave: (design: LabelDesign) => Promise<void>;
}

export default function LabelDesigner({ item, allItems, onClose, onSave }: LabelDesignerProps) {
  const [design, setDesign] = useState<LabelDesign>(() => item.labelDesign ?? makeDefaultDesign(item));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pxPerCm, setPxPerCm] = useState(80);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // Measure available space → compute pxPerCm
  useEffect(() => {
    const obs = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const byW = (rect.width - 80) / design.widthCm;
      const byH = (rect.height - 80) / design.heightCm;
      setPxPerCm(Math.min(byW, byH, 160));
    });
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [design.widthCm, design.heightCm]);

  const updateEl = useCallback((id: string, p: Partial<LabelElement>) => {
    setDesign((d) => ({ ...d, elements: d.elements.map((e) => (e.id === id ? { ...e, ...p } : e)) }));
  }, []);

  const deleteEl = useCallback(
    (id: string) => {
      setDesign((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== id) }));
      setSelectedId((s) => (s === id ? null : s));
    },
    []
  );

  const addElement = (type: LabelElement["type"]) => {
    const maxZ = Math.max(0, ...design.elements.map((e) => e.zIndex)) + 1;
    const cx = design.widthCm / 2;
    const cy = design.heightCm / 2;
    let el: LabelElement;
    if (type === "qr") {
      const sz = Math.min(3, design.widthCm * 0.35, design.heightCm * 0.6);
      el = {
        id: genId(), type, zIndex: maxZ,
        xCm: cx - sz / 2, yCm: cy - sz / 2, wCm: sz, hCm: sz,
        qrItemId: "self", qrFgColor: item.fgColor, qrBgColor: "transparent",
      };
    } else if (type === "text") {
      el = {
        id: genId(), type, zIndex: maxZ,
        xCm: 0.5, yCm: cy - 0.4, wCm: design.widthCm - 1, hCm: 0.8,
        html: "<p>New text — click to edit in the panel</p>",
        fontSizePt: 14,
      };
    } else if (type === "image") {
      el = {
        id: genId(), type, zIndex: maxZ,
        xCm: cx - 1.5, yCm: cy - 1.5, wCm: 3, hCm: 3,
        src: "", objectFit: "contain",
      };
    } else {
      el = {
        id: genId(), type, zIndex: maxZ,
        xCm: cx - 1.5, yCm: cy - 1, wCm: 3, hCm: 2,
        shape: "rect", fillColor: "#e5e7eb", strokeWidth: 2, strokeColor: "#9ca3af",
      };
    }
    setDesign((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  };

  const moveLayer = (id: string, dir: 1 | -1) => {
    setDesign((d) => {
      const sorted = [...d.elements].sort((a, b) => a.zIndex - b.zIndex);
      const idx = sorted.findIndex((e) => e.id === id);
      if (idx === -1) return d;
      const newIdx = Math.max(0, Math.min(sorted.length - 1, idx + dir));
      if (newIdx === idx) return d;
      const updated = d.elements.map((e) => {
        if (e.id === sorted[idx].id) return { ...e, zIndex: sorted[newIdx].zIndex };
        if (e.id === sorted[newIdx].id) return { ...e, zIndex: sorted[idx].zIndex };
        return e;
      });
      return { ...d, elements: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(design); } finally { setSaving(false); }
  };

  const handleExport = useCallback(async () => {
    if (!canvasRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(canvasRef.current, { cacheBust: true, pixelRatio: 3 });
      const a = document.createElement("a");
      a.download = `${item.name.replace(/\s+/g, "-").toLowerCase()}-label.png`;
      a.href = dataUrl;
      a.click();
    } finally {
      setExporting(false);
    }
  }, [item]);

  const handlePrint = useCallback(() => {
    const styleId = "ld-print-style";
    let s = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!s) {
      s = document.createElement("style");
      s.id = styleId;
      document.head.appendChild(s);
    }
    s.textContent = `
      @media print {
        * { visibility: hidden !important; }
        #ld-print-target, #ld-print-target * { visibility: visible !important; }
        #ld-print-target {
          position: fixed !important; top: 50% !important; left: 50% !important;
          transform: translate(-50%, -50%) !important;
          width: ${design.widthCm}cm !important; height: ${design.heightCm}cm !important;
          background: ${design.bgColor} !important; overflow: hidden !important;
        }
        #ld-print-target .ld-el { position: absolute !important; }
        #ld-print-target * { outline: none !important; }
      }
    `;
    window.print();
    setTimeout(() => s?.remove(), 2000);
  }, [design]);

  const sortedElements = [...design.elements].sort((a, b) => a.zIndex - b.zIndex);
  const canvasW = design.widthCm * pxPerCm;
  const canvasH = design.heightCm * pxPerCm;

  const elTypeLabel = (el: LabelElement) => {
    if (el.type === "qr") {
      const src =
        !el.qrItemId || el.qrItemId === "self"
          ? item.name
          : (allItems.find((i) => i.id === el.qrItemId)?.name ?? "QR");
      return `QR: ${src}`;
    }
    if (el.type === "text") return "Text";
    if (el.type === "image") return "Image";
    return "Shape";
  };

  const typeIcon = (type: LabelElement["type"]) => {
    if (type === "qr") return <QrCodeIcon className="w-3 h-3 flex-shrink-0" />;
    if (type === "text") return <Type className="w-3 h-3 flex-shrink-0" />;
    if (type === "image") return <ImageIcon className="w-3 h-3 flex-shrink-0" />;
    return <Square className="w-3 h-3 flex-shrink-0" />;
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="h-14 flex-shrink-0 flex items-center gap-3 px-4 border-b border-border bg-card shadow-sm">
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mr-1"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">Label Designer — {item.name}</p>
          <p className="text-[11px] text-muted-foreground">
            {design.widthCm} × {design.heightCm} cm
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrint}
          className="h-8 rounded-xl gap-1.5 text-xs hidden sm:flex"
        >
          <Printer className="w-3.5 h-3.5" /> Print
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="h-8 rounded-xl gap-1.5 text-xs hidden sm:flex"
        >
          <Download className="w-3.5 h-3.5" /> {exporting ? "Saving…" : "PNG"}
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="h-8 rounded-xl gap-1.5 text-xs"
        >
          <Save className="w-3.5 h-3.5" /> {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex min-h-0 overflow-hidden">

        {/* ── Left panel ── */}
        <div className="w-48 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-hidden">
          {/* Add tools */}
          <div className="p-3 border-b border-border/50">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Add Element
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  { type: "qr" as const, label: "QR Code", Icon: QrCodeIcon },
                  { type: "text" as const, label: "Text", Icon: Type },
                  { type: "image" as const, label: "Image", Icon: ImageIcon },
                  { type: "shape" as const, label: "Shape", Icon: Square },
                ] as const
              ).map(({ type, label, Icon }) => (
                <button
                  key={type}
                  onClick={() => addElement(type)}
                  className="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-primary/40 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Layers list */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Layers
            </p>
            {design.elements.length === 0 && (
              <p className="text-[11px] text-muted-foreground/50 text-center mt-6 leading-relaxed">
                No elements yet.
                <br />
                Use "Add Element" above.
              </p>
            )}
            {[...sortedElements].reverse().map((el) => (
              <div
                key={el.id}
                onClick={() => setSelectedId(el.id)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer mb-1 text-[11px] transition-colors border ${
                  selectedId === el.id
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "border-transparent hover:bg-muted/40 text-foreground"
                }`}
              >
                <span className="text-muted-foreground">{typeIcon(el.type)}</span>
                <span className="flex-1 truncate">{elTypeLabel(el)}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); moveLayer(el.id, 1); }}
                  title="Move up"
                  className="p-0.5 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); moveLayer(el.id, -1); }}
                  title="Move down"
                  className="p-0.5 rounded hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteEl(el.id); }}
                  title="Delete"
                  className="p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* ── Canvas area ── */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-[#dde1e7] flex items-center justify-center p-8"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
        >
          {/* Interactive canvas */}
          <div
            ref={canvasRef}
            style={{
              width: canvasW,
              height: canvasH,
              position: "relative",
              backgroundColor: design.bgColor,
              boxShadow: "0 4px 32px rgba(0,0,0,0.22)",
              flexShrink: 0,
              overflow: "hidden",
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}
          >
            {sortedElements.map((el) => (
              <Rnd
                key={el.id}
                size={{ width: el.wCm * pxPerCm, height: el.hCm * pxPerCm }}
                position={{ x: el.xCm * pxPerCm, y: el.yCm * pxPerCm }}
                onDragStop={(_e, d) =>
                  updateEl(el.id, { xCm: d.x / pxPerCm, yCm: d.y / pxPerCm })
                }
                onResizeStop={(_e, _dir, ref, _delta, pos) =>
                  updateEl(el.id, {
                    wCm: ref.offsetWidth / pxPerCm,
                    hCm: ref.offsetHeight / pxPerCm,
                    xCm: pos.x / pxPerCm,
                    yCm: pos.y / pxPerCm,
                  })
                }
                bounds="parent"
                lockAspectRatio={el.type === "qr"}
                onMouseDown={() => setSelectedId(el.id)}
                style={{
                  outline: selectedId === el.id ? "2px dashed #6366f1" : "2px dashed transparent",
                  outlineOffset: "1px",
                  boxSizing: "border-box",
                  opacity: el.opacity ?? 1,
                  zIndex: el.zIndex,
                }}
              >
                <ElContent el={el} item={item} allItems={allItems} pxPerCm={pxPerCm} />
              </Rnd>
            ))}
          </div>

          {/* Hidden print-target at real cm units */}
          <div
            style={{ position: "absolute", top: -99999, left: -99999, pointerEvents: "none" }}
            aria-hidden
          >
            <div
              id="ld-print-target"
              style={{
                width: `${design.widthCm}cm`,
                height: `${design.heightCm}cm`,
                position: "relative",
                backgroundColor: design.bgColor,
                overflow: "hidden",
              }}
            >
              {sortedElements.map((el) => (
                <div
                  key={el.id}
                  className="ld-el"
                  style={{
                    position: "absolute",
                    left: `${el.xCm}cm`,
                    top: `${el.yCm}cm`,
                    width: `${el.wCm}cm`,
                    height: `${el.hCm}cm`,
                    zIndex: el.zIndex,
                    opacity: el.opacity ?? 1,
                  }}
                >
                  <ElContent el={el} item={item} allItems={allItems} pxPerCm={PRINT_PX_PER_CM} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel (properties) ── */}
        <div className="w-64 flex-shrink-0 border-l border-border bg-card overflow-y-auto">
          <PropertiesPanel
            design={design}
            selectedId={selectedId}
            allItems={allItems}
            item={item}
            onChangeDesign={(p) => setDesign((d) => ({ ...d, ...p }))}
            onUpdateEl={updateEl}
            onDeleteEl={deleteEl}
          />
        </div>
      </div>
    </div>
  );
}

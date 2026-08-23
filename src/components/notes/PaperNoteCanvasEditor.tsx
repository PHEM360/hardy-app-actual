import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Rnd } from "react-rnd";
import {
  CheckSquare, ChevronDown, Circle, Diamond, GitBranch, Image, ListPlus, Loader2, MapPin,
  Mic, MousePointer2, PenLine, Plus, Square, StopCircle, Trash2, Type, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { NoteDiagramEditor } from "@/components/notes/NoteDiagram";
import type { NoteCanvas, NoteCanvasBlock, NoteChecklistItem } from "@/types/notes";
import { uploadNoteMedia } from "@/lib/noteMedia";
import { toast } from "sonner";

interface PaperNoteCanvasEditorProps {
  canvas: NoteCanvas;
  canEdit: boolean;
  ownerId: string;
  noteId: string;
  onChange: (canvas: NoteCanvas) => void;
}

type ShapeKind = "rectangle" | "ellipse" | "diamond";
type CanvasTool = "select" | "pen" | `shape:${ShapeKind}`;
type ShapeDraft = { x: number; y: number; width: number; height: number } | null;

function blockId() {
  return crypto.randomUUID();
}

function nextPosition(canvas: NoteCanvas) {
  const visibleBlocks = canvas.blocks.filter((block) => !(block.type === "drawing" && block.id === "paper-ink"));
  const index = visibleBlocks.length;
  return { x: 28 + (index % 4) * 18, y: 30 + (index % 5) * 24 };
}

const TOOL_STYLE = {
  text: "border-sky-300/70 bg-sky-500/10 text-sky-800 hover:bg-sky-500/20 dark:text-sky-200",
  shape: "border-violet-300/70 bg-violet-500/10 text-violet-800 hover:bg-violet-500/20 dark:text-violet-200",
  draw: "border-rose-300/70 bg-rose-500/10 text-rose-800 hover:bg-rose-500/20 dark:text-rose-200",
  checklist: "border-emerald-300/70 bg-emerald-500/10 text-emerald-800 hover:bg-emerald-500/20 dark:text-emerald-200",
  diagram: "border-teal-300/70 bg-teal-500/10 text-teal-800 hover:bg-teal-500/20 dark:text-teal-200",
  media: "border-blue-300/70 bg-blue-500/10 text-blue-800 hover:bg-blue-500/20 dark:text-blue-200",
  audio: "border-orange-300/70 bg-orange-500/10 text-orange-800 hover:bg-orange-500/20 dark:text-orange-200",
  location: "border-amber-300/70 bg-amber-500/10 text-amber-900 hover:bg-amber-500/20 dark:text-amber-200",
};

export function PaperNoteCanvasEditor({
  canvas,
  canEdit,
  ownerId,
  noteId,
  onChange,
}: PaperNoteCanvasEditorProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const mediaInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioParts = useRef<Blob[]>([]);
  const inkPath = useRef<string | null>(null);
  const inkBase = useRef<string[]>([]);
  const shapeStart = useRef<{ x: number; y: number } | null>(null);
  const shapeDraftRef = useRef<ShapeDraft>(null);
  const latestCanvas = useRef(canvas);
  latestCanvas.current = canvas;
  const [tool, setTool] = useState<CanvasTool>("select");
  const [shapeDraft, setShapeDraft] = useState<ShapeDraft>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [paperWidth, setPaperWidth] = useState(720);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);

  const paperInk = useMemo(
    () => canvas.blocks.find((block): block is Extract<NoteCanvasBlock, { type: "drawing" }> => block.type === "drawing" && block.id === "paper-ink"),
    [canvas.blocks],
  );
  const visibleBlocks = canvas.blocks.filter((block) => block.id !== "paper-ink");

  useEffect(() => {
    if (!canEdit) setTool("select");
  }, [canEdit]);

  useEffect(() => {
    const paper = paperRef.current;
    if (!paper) return;
    const measure = () => {
      if (paper.clientWidth > 0) setPaperWidth(paper.clientWidth);
    };
    measure();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(measure);
      observer.observe(paper);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  const availableBlockWidth = (preferred: number) => Math.min(preferred, Math.max(140, paperWidth - 56));

  const setBlocks = (blocks: NoteCanvasBlock[], height = latestCanvas.current.height) => {
    const next = { ...latestCanvas.current, height, blocks };
    latestCanvas.current = next;
    onChange(next);
  };
  const addBlock = (block: NoteCanvasBlock) => {
    const current = latestCanvas.current;
    setBlocks([...current.blocks, block], Math.max(current.height, block.y + block.height + 80));
    setSelectedBlockId(block.id);
  };
  const updateBlock = (id: string, patch: Partial<NoteCanvasBlock>) => {
    const current = latestCanvas.current;
    const blocks = current.blocks.map((block) => block.id === id ? ({ ...block, ...patch } as NoteCanvasBlock) : block);
    const updated = blocks.find((block) => block.id === id);
    setBlocks(blocks, updated ? Math.max(current.height, updated.y + updated.height + 80) : current.height);
  };
  const removeBlock = (id: string) => {
    setBlocks(latestCanvas.current.blocks.filter((block) => block.id !== id));
    setSelectedBlockId((current) => current === id ? null : current);
  };

  const pointOnPaper = (event: ReactPointerEvent) => {
    const bounds = paperRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  };

  const addText = () => {
    const pos = nextPosition(canvas);
    addBlock({ id: blockId(), type: "text", ...pos, width: availableBlockWidth(300), height: 170, text: "", textStyle: "body" });
    setTool("select");
  };

  const addChecklist = () => {
    const pos = nextPosition(canvas);
    addBlock({
      id: blockId(),
      type: "checklist",
      ...pos,
      width: availableBlockWidth(330),
      height: 210,
      items: [{ id: blockId(), text: "", done: false }],
    });
  };

  const addDiagram = () => {
    const pos = nextPosition(canvas);
    addBlock({ id: blockId(), type: "diagram", ...pos, width: availableBlockWidth(440), height: 430, diagram: null });
  };

  const addUploadedMedia = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadNoteMedia(ownerId, noteId, file, file.name);
      const pos = nextPosition(canvas);
      addBlock({
        id: blockId(),
        type: "media",
        ...pos,
        width: availableBlockWidth(300),
        height: file.type.startsWith("video/") ? 240 : 280,
        mediaType: file.type.startsWith("video/") ? "video" : "image",
        url,
        name: file.name,
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not upload this file");
    } finally {
      setUploading(false);
    }
  };

  const toggleRecording = async () => {
    if (recorder.current && recording) {
      recorder.current.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Audio recording is not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const next = new MediaRecorder(stream);
      audioParts.current = [];
      next.ondataavailable = (event) => {
        if (event.data.size) audioParts.current.push(event.data);
      };
      next.onstop = async () => {
        setRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioParts.current, { type: next.mimeType || "audio/webm" });
        setUploading(true);
        try {
          const url = await uploadNoteMedia(ownerId, noteId, blob, `recording-${Date.now()}.webm`);
          const pos = nextPosition(canvas);
          addBlock({ id: blockId(), type: "media", ...pos, width: availableBlockWidth(310), height: 105, mediaType: "audio", url, name: "Audio recording" });
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Could not save the recording");
        } finally {
          setUploading(false);
        }
      };
      recorder.current = next;
      next.start();
      setRecording(true);
    } catch {
      toast.error("Microphone permission is needed to record audio");
    }
  };

  const addLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Location is not available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const pos = nextPosition(canvas);
        addBlock({
          id: blockId(),
          type: "location",
          ...pos,
          width: availableBlockWidth(340),
          height: 240,
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: "Saved location",
        });
      },
      () => toast.error("Location permission was not granted"),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  const beginPaperAction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canEdit || tool === "select") return;
    const point = pointOnPaper(event);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    if (tool === "pen") {
      inkPath.current = `M${Math.round(point.x)},${Math.round(point.y)}`;
      inkBase.current = paperInk?.paths ?? [];
      const nextInk: Extract<NoteCanvasBlock, { type: "drawing" }> = paperInk ?? {
        id: "paper-ink",
        type: "drawing",
        x: 0,
        y: 0,
        width: paperRef.current?.clientWidth ?? 720,
        height: canvas.height,
        paths: [],
        stroke: "#243b53",
      };
      if (paperInk) updateBlock("paper-ink", { paths: [...inkBase.current, inkPath.current] });
      else setBlocks([...latestCanvas.current.blocks, { ...nextInk, paths: [inkPath.current] }]);
      return;
    }
    shapeStart.current = point;
    shapeDraftRef.current = { x: point.x, y: point.y, width: 0, height: 0 };
    setShapeDraft(shapeDraftRef.current);
  };

  const continuePaperAction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (tool === "pen" && inkPath.current) {
      const point = pointOnPaper(event);
      inkPath.current += ` L${Math.round(point.x)},${Math.round(point.y)}`;
      updateBlock("paper-ink", { paths: [...inkBase.current, inkPath.current] });
      return;
    }
    if (tool.startsWith("shape:") && shapeStart.current) {
      const point = pointOnPaper(event);
      shapeDraftRef.current = {
        x: Math.min(shapeStart.current.x, point.x),
        y: Math.min(shapeStart.current.y, point.y),
        width: Math.abs(point.x - shapeStart.current.x),
        height: Math.abs(point.y - shapeStart.current.y),
      };
      setShapeDraft(shapeDraftRef.current);
    }
  };

  const finishPaperAction = () => {
    inkPath.current = null;
    const finishedShape = shapeDraftRef.current;
    if (tool.startsWith("shape:") && finishedShape && finishedShape.width >= 18 && finishedShape.height >= 18) {
      addBlock({
        id: blockId(),
        type: "shape",
        ...finishedShape,
        shape: tool.split(":")[1] as ShapeKind,
        label: "",
        fill: "#ddd6fe",
      });
      setTool("select");
    }
    shapeStart.current = null;
    shapeDraftRef.current = null;
    setShapeDraft(null);
  };

  const renderShape = (block: Extract<NoteCanvasBlock, { type: "shape" }>, preview = false) => (
    <div className="relative h-full w-full">
      <div
        className="absolute border-2 border-violet-600"
        style={{
          inset: block.shape === "diamond" ? "15%" : 2,
          backgroundColor: block.fill,
          borderRadius: block.shape === "ellipse" ? "9999px" : block.shape === "rectangle" ? "6px" : "3px",
          transform: block.shape === "diamond" ? "rotate(45deg)" : undefined,
        }}
        aria-hidden
      />
      {!preview && (
        <input
          value={block.label}
          readOnly={!canEdit}
          onChange={(event) => updateBlock(block.id, { label: event.target.value })}
          placeholder="Label"
          className="absolute left-[15%] top-1/2 z-10 w-[70%] -translate-y-1/2 bg-transparent text-center text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-500/50"
        />
      )}
    </div>
  );

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="rounded-2xl border border-slate-200/80 bg-white/75 p-2.5 shadow-card backdrop-blur">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <Plus className="h-3.5 w-3.5" /> Add to paper
            </span>
            <Button type="button" variant="outline" size="sm" className={`h-9 rounded-xl ${TOOL_STYLE.text}`} onClick={addText}>
              <Type className="mr-1.5 h-4 w-4" /> Text
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button" variant="outline" size="sm" aria-label="Choose a shape" className={`h-9 rounded-xl ${TOOL_STYLE.shape}`}>
                  <Square className="h-4 w-4" /><ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-2xl p-2" align="start">
                <div className="flex gap-2" aria-label="Shape choices">
                  {([
                    ["rectangle", Square, "Rectangle"],
                    ["ellipse", Circle, "Circle or oval"],
                    ["diamond", Diamond, "Decision diamond"],
                  ] as const).map(([shape, Icon, label]) => (
                    <button
                      key={shape}
                      type="button"
                      aria-label={label}
                      title={label}
                      onClick={() => setTool(`shape:${shape}`)}
                      className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700 transition hover:border-violet-400 hover:bg-violet-100"
                    >
                      <Icon className="h-7 w-7" />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Button type="button" variant="outline" size="sm" className={`h-9 rounded-xl ${TOOL_STYLE.draw} ${tool === "pen" ? "ring-2 ring-rose-400" : ""}`} onClick={() => setTool(tool === "pen" ? "select" : "pen")}>
              <PenLine className="mr-1.5 h-4 w-4" /> Draw
            </Button>
            <Button type="button" variant="outline" size="sm" className={`h-9 rounded-xl ${TOOL_STYLE.checklist}`} onClick={addChecklist}>
              <CheckSquare className="mr-1.5 h-4 w-4" /> Checklist
            </Button>
            <Button type="button" variant="outline" size="sm" className={`h-9 rounded-xl ${TOOL_STYLE.diagram}`} onClick={addDiagram}>
              <GitBranch className="mr-1.5 h-4 w-4" /> Diagram
            </Button>
            <Button type="button" variant="outline" size="sm" className={`h-9 rounded-xl ${TOOL_STYLE.media}`} disabled={uploading} onClick={() => mediaInput.current?.click()}>
              {uploading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Image className="mr-1.5 h-4 w-4" />} Photo / video
            </Button>
            <Button type="button" variant="outline" size="sm" className={`h-9 rounded-xl ${recording ? "border-red-400 bg-red-500 text-white" : TOOL_STYLE.audio}`} disabled={uploading} onClick={() => void toggleRecording()}>
              {recording ? <StopCircle className="mr-1.5 h-4 w-4" /> : <Mic className="mr-1.5 h-4 w-4" />} {recording ? "Stop" : "Audio"}
            </Button>
            <Button type="button" variant="outline" size="sm" className={`h-9 rounded-xl ${TOOL_STYLE.location}`} onClick={addLocation}>
              <MapPin className="mr-1.5 h-4 w-4" /> Map
            </Button>
            <input ref={mediaInput} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void addUploadedMedia(file);
              event.target.value = "";
            }} />
          </div>
          {tool !== "select" && (
            <div className="mt-2 flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2 text-xs text-white">
              <span className="flex items-center gap-2">
                {tool === "pen" ? <PenLine className="h-3.5 w-3.5" /> : <MousePointer2 className="h-3.5 w-3.5" />}
                {tool === "pen" ? "Draw directly anywhere on the paper." : "Drag on the paper to draw the shape at the size you want."}
              </span>
              <button type="button" onClick={() => setTool("select")} className="rounded-lg p-1 hover:bg-white/15" aria-label="Cancel tool"><X className="h-3.5 w-3.5" /></button>
            </div>
          )}
        </div>
      )}

      <div
        ref={paperRef}
        data-testid="note-paper"
        className={`relative min-h-[560px] overflow-hidden rounded-[1.4rem] border border-amber-950/10 bg-[#fffdf8] text-slate-900 shadow-[0_18px_50px_rgba(75,55,25,.14)] ${
          tool === "pen" || tool.startsWith("shape:") ? "touch-none cursor-crosshair" : ""
        }`}
        style={{
          height: Math.max(560, canvas.height),
          backgroundImage: "linear-gradient(rgba(148,120,70,.055) 1px, transparent 1px)",
          backgroundSize: "100% 28px",
        }}
        onClick={(event) => {
          if (event.currentTarget === event.target) setSelectedBlockId(null);
        }}
        onPointerDown={beginPaperAction}
        onPointerMove={continuePaperAction}
        onPointerUp={finishPaperAction}
        onPointerCancel={finishPaperAction}
      >
        {visibleBlocks.length === 0 && !paperInk?.paths.length && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-slate-400">
            <PenLine className="mb-3 h-8 w-8 opacity-40" />
            <p className="font-display text-base font-bold text-slate-600">Your blank note</p>
            <p className="mt-1 max-w-sm text-xs leading-relaxed">Type, draw, place shapes, add a checklist, build a diagram or pin a location anywhere on this paper.</p>
          </div>
        )}

        {paperInk && (
          <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" aria-label="Handwriting">
            {paperInk.paths.map((path, index) => (
              <path key={`${paperInk.id}-${index}`} d={path} fill="none" stroke={paperInk.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            ))}
          </svg>
        )}

        {shapeDraft && tool.startsWith("shape:") && (
          <div className="pointer-events-none absolute z-50" style={{ left: shapeDraft.x, top: shapeDraft.y, width: shapeDraft.width, height: shapeDraft.height }}>
            {renderShape({
              id: "shape-preview",
              type: "shape",
              ...shapeDraft,
              shape: tool.split(":")[1] as ShapeKind,
              label: "",
              fill: "rgba(221,214,254,.75)",
            }, true)}
          </div>
        )}

        {visibleBlocks.map((block) => {
          const selected = selectedBlockId === block.id;
          const transparent = block.type === "shape" || block.type === "text" || block.type === "drawing";
          const renderedWidth = Math.min(block.width, Math.max(block.type === "shape" ? 30 : 120, paperWidth - 16));
          const renderedX = Math.max(0, Math.min(block.x, paperWidth - renderedWidth - 8));
          return (
            <Rnd
              key={block.id}
              bounds="parent"
              position={{ x: renderedX, y: block.y }}
              size={{ width: renderedWidth, height: block.height }}
              disableDragging={!canEdit || tool !== "select"}
              enableResizing={canEdit && tool === "select"}
              minWidth={block.type === "shape" ? 30 : 120}
              minHeight={block.type === "shape" ? 30 : 72}
              dragHandleClassName="note-block-drag"
              onDragStop={(_event, data) => updateBlock(block.id, { x: data.x, y: data.y } as Partial<NoteCanvasBlock>)}
              onResizeStop={(_event, _direction, ref, _delta, position) => updateBlock(block.id, {
                x: position.x,
                y: position.y,
                width: ref.offsetWidth,
                height: ref.offsetHeight,
              } as Partial<NoteCanvasBlock>)}
              onMouseDown={() => setSelectedBlockId(block.id)}
              className={`group z-20 ${selected ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-[#fffdf8]" : ""}`}
            >
              <div className={`h-full overflow-hidden rounded-2xl ${transparent ? "border border-transparent bg-transparent" : "border border-slate-200/90 bg-white/90 shadow-card"}`}>
                {canEdit && tool === "select" && (
                  <div className={`note-block-drag absolute -top-2 left-3 right-3 z-30 flex h-5 cursor-grab items-center justify-between rounded-full bg-slate-800 px-2 text-[9px] font-bold uppercase tracking-wider text-white transition ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
                    Drag
                    <button type="button" className="rounded-full p-0.5 hover:bg-white/20" onClick={() => removeBlock(block.id)}><Trash2 className="h-3 w-3" /></button>
                  </div>
                )}

                {block.type === "text" && (
                  <div className="flex h-full flex-col overflow-hidden p-2">
                    {canEdit && selected && (
                      <select value={block.textStyle} onChange={(event) => updateBlock(block.id, { textStyle: event.target.value as typeof block.textStyle })} className="mb-1 h-7 w-fit rounded-lg border border-slate-200 bg-white px-2 text-[10px]">
                        <option value="body">Body</option>
                        <option value="heading">Heading</option>
                        <option value="callout">Callout</option>
                      </select>
                    )}
                    <textarea
                      autoFocus={!block.text}
                      value={block.text}
                      readOnly={!canEdit}
                      onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                      placeholder="Start typing…"
                      className={`min-h-0 flex-1 resize-none bg-transparent p-1 outline-none placeholder:text-slate-400 ${
                        block.textStyle === "heading" ? "font-display text-2xl font-bold" : block.textStyle === "callout" ? "rounded-xl bg-amber-100/70 p-3 text-sm font-medium" : "text-[15px] leading-7"
                      }`}
                    />
                  </div>
                )}

                {block.type === "shape" && renderShape(block)}

                {block.type === "drawing" && (
                  <svg className="h-full w-full">
                    {block.paths.map((path, index) => <path key={`${block.id}-${index}`} d={path} fill="none" stroke={block.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />)}
                  </svg>
                )}

                {block.type === "checklist" && (
                  <div className="h-full overflow-y-auto p-3">
                    <p className="mb-2 flex items-center gap-1.5 text-sm font-bold"><CheckSquare className="h-4 w-4 text-emerald-600" /> Checklist</p>
                    <div className="space-y-1.5">
                      {block.items.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-2">
                          <input type="checkbox" checked={item.done} disabled={!canEdit} onChange={(event) => {
                            const items = block.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, done: event.target.checked } : entry);
                            updateBlock(block.id, { items });
                          }} />
                          <Input value={item.text} readOnly={!canEdit} placeholder="List item" onChange={(event) => {
                            const items = block.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, text: event.target.value } : entry);
                            updateBlock(block.id, { items });
                          }} className="h-8 border-0 bg-transparent px-1 shadow-none" />
                          {canEdit && <button type="button" onClick={() => updateBlock(block.id, { items: block.items.filter((entry) => entry.id !== item.id) })} className="text-slate-400 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>}
                        </div>
                      ))}
                    </div>
                    {canEdit && (
                      <button type="button" onClick={() => updateBlock(block.id, { items: [...block.items, { id: blockId(), text: "", done: false } satisfies NoteChecklistItem] })} className="mt-2 flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <ListPlus className="h-3.5 w-3.5" /> Add item
                      </button>
                    )}
                  </div>
                )}

                {block.type === "diagram" && (
                  <div className="h-full overflow-auto p-2">
                    <NoteDiagramEditor diagram={block.diagram} canEdit={canEdit} onChange={(diagram) => updateBlock(block.id, { diagram })} />
                  </div>
                )}

                {block.type === "media" && (
                  <div className="flex h-full items-center justify-center overflow-hidden rounded-2xl bg-black/5">
                    {block.mediaType === "image" && <img src={block.url} alt={block.name} className="h-full w-full object-contain" />}
                    {block.mediaType === "video" && <video src={block.url} controls className="h-full w-full object-contain" />}
                    {block.mediaType === "audio" && <audio src={block.url} controls className="w-[90%]" />}
                  </div>
                )}

                {block.type === "location" && (
                  <div className="relative flex h-full flex-col overflow-hidden bg-amber-50">
                    <iframe
                      title={block.label || "Saved map location"}
                      className={`min-h-0 flex-1 border-0 ${canEdit ? "pointer-events-none" : ""}`}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${block.longitude - 0.01}%2C${block.latitude - 0.006}%2C${block.longitude + 0.01}%2C${block.latitude + 0.006}&layer=mapnik&marker=${block.latitude}%2C${block.longitude}`}
                    />
                    <div className="flex items-center gap-2 border-t border-amber-200 bg-white/90 px-3 py-2">
                      <MapPin className="h-4 w-4 shrink-0 text-amber-600" />
                      <input value={block.label} readOnly={!canEdit} onChange={(event) => updateBlock(block.id, { label: event.target.value })} className="min-w-0 flex-1 bg-transparent text-sm font-semibold outline-none" />
                      <a href={`https://www.openstreetmap.org/?mlat=${block.latitude}&mlon=${block.longitude}#map=16/${block.latitude}/${block.longitude}`} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-amber-700">Open map</a>
                    </div>
                  </div>
                )}
              </div>
            </Rnd>
          );
        })}
      </div>

      {canEdit && (
        <button type="button" onClick={() => onChange({ ...canvas, height: canvas.height + 280 })} className="mx-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-card hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add more paper
        </button>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Rnd } from "react-rnd";
import {
  Check, CheckSquare, Circle, Diamond, GitBranch, Image, ListPlus, Loader2, MapPin,
  Mic, MousePointer2, PenLine, Plus, Square, StopCircle, Table2, Trash2, Type, X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { NoteDiagramEditor } from "@/components/notes/NoteDiagram";
import type { NoteCanvas, NoteCanvasBlock, NoteChecklistItem } from "@/types/notes";
import { uploadNoteMedia } from "@/lib/noteMedia";
import { toast } from "sonner";

interface PaperNoteCanvasEditorProps {
  canvas: NoteCanvas;
  canEdit: boolean;
  /** Tick checklists and view diagrams even when the paper layout is locked. */
  canInteract?: boolean;
  showTools?: boolean;
  ownerId: string;
  noteId: string;
  onChange: (canvas: NoteCanvas) => void;
}

function isBoxedText(block: NoteCanvasBlock): boolean {
  return block.type === "text" && block.boxed !== false;
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

// Each tool keeps one jewel tone for its icon, so the row reads at a glance.
const TOOL_TONE = {
  text: "#17475C",
  table: "#22407A",
  shape: "#4A2A52",
  draw: "#6E1F2F",
  checklist: "#1F4D3A",
  diagram: "#1B5E5A",
  media: "#1C4A6E",
  audio: "#7A2E2A",
  location: "#8A6424",
};

function toolTile(active: boolean) {
  return `flex min-h-[3.25rem] flex-col items-center justify-center gap-1 rounded-lg border px-0.5 text-[11px] font-bold transition-colors duration-150 disabled:opacity-50 ${
    active ? "btn-edge border-[#6E1F2F] bg-[#6E1F2F] text-white" : "border-foreground/20 bg-background text-foreground"
  }`;
}

export function PaperNoteCanvasEditor({
  canvas,
  canEdit,
  canInteract,
  showTools,
  ownerId,
  noteId,
  onChange,
}: PaperNoteCanvasEditorProps) {
  const toolsVisible = showTools ?? canEdit;
  const interactive = canInteract ?? canEdit;
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
  const [pendingChecklistFocus, setPendingChecklistFocus] = useState<string | null>(null);
  const [pendingTextFocus, setPendingTextFocus] = useState<string | null>(null);

  const paperInk = useMemo(
    () => canvas.blocks.find((block): block is Extract<NoteCanvasBlock, { type: "drawing" }> => block.type === "drawing" && block.id === "paper-ink"),
    [canvas.blocks],
  );
  const visibleBlocks = canvas.blocks.filter((block) => block.id !== "paper-ink");

  useEffect(() => {
    if (!canEdit) setTool("select");
  }, [canEdit]);

  useEffect(() => {
    if (!pendingChecklistFocus) return;
    const input = paperRef.current?.querySelector<HTMLInputElement>(`input[data-checklist-item="${pendingChecklistFocus}"]`);
    input?.focus();
    if (input) setPendingChecklistFocus(null);
  }, [pendingChecklistFocus, canvas.blocks]);

  useEffect(() => {
    if (!pendingTextFocus) return;
    const field = paperRef.current?.querySelector<HTMLTextAreaElement>(`textarea[data-paper-text="${pendingTextFocus}"]`);
    field?.focus();
    if (field) {
      const end = field.value.length;
      field.setSelectionRange(end, end);
      setPendingTextFocus(null);
    }
  }, [pendingTextFocus, canvas.blocks]);

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

  const pointOnPaper = (event: { clientX: number; clientY: number }) => {
    const bounds = paperRef.current?.getBoundingClientRect();
    if (!bounds) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(bounds.width, event.clientX - bounds.left)),
      y: Math.max(0, Math.min(bounds.height, event.clientY - bounds.top)),
    };
  };

  const addText = () => {
    const pos = nextPosition(canvas);
    const id = blockId();
    addBlock({ id, type: "text", ...pos, width: availableBlockWidth(300), height: 170, text: "", textStyle: "body", boxed: true });
    setPendingTextFocus(id);
    setTool("select");
  };

  const addTable = () => {
    const pos = nextPosition(canvas);
    addBlock({
      id: blockId(),
      type: "table",
      ...pos,
      width: availableBlockWidth(440),
      height: 220,
      cells: [
        ["", "", ""],
        ["", "", ""],
        ["", "", ""],
      ],
    });
    setTool("select");
  };

  const placePaperText = (point: { x: number; y: number }) => {
    const nearby = visibleBlocks.find((block) => {
      if (block.type !== "text" || isBoxedText(block)) return false;
      return point.x >= block.x - 12
        && point.x <= block.x + block.width + 12
        && point.y >= block.y - 12
        && point.y <= block.y + block.height + 12;
    });
    if (nearby) {
      setSelectedBlockId(nearby.id);
      setPendingTextFocus(nearby.id);
      return;
    }
    const x = Math.max(18, Math.min(point.x, Math.max(18, paperWidth - 160)));
    const width = Math.max(160, paperWidth - x - 24);
    const id = blockId();
    addBlock({
      id,
      type: "text",
      x,
      y: Math.max(16, point.y - 10),
      width,
      height: 56,
      text: "",
      textStyle: "body",
      boxed: false,
    });
    setPendingTextFocus(id);
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
      title: "Checklist",
      items: [{ id: blockId(), text: "", done: false }],
    });
  };

  const addDiagram = () => {
    const pos = nextPosition(canvas);
    addBlock({ id: blockId(), type: "diagram", ...pos, width: availableBlockWidth(560), height: 560, diagram: null });
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
    if (tool === "select") return;
    if (!canEdit) return;
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
      {toolsVisible && (
        <div className="rounded-xl border border-foreground/20 bg-card p-2 shadow-card">
          <p className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-foreground/70">Add to the page</p>
          <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-9">
            <button type="button" className={toolTile(false)} onClick={addText}>
              <Type className="h-5 w-5" style={{ color: TOOL_TONE.text }} /> Text
            </button>
            <button type="button" className={toolTile(false)} onClick={addChecklist}>
              <CheckSquare className="h-5 w-5" style={{ color: TOOL_TONE.checklist }} /> List
            </button>
            <button type="button" className={toolTile(tool === "pen")} aria-pressed={tool === "pen"} onClick={() => setTool(tool === "pen" ? "select" : "pen")}>
              <PenLine className="h-5 w-5" style={tool === "pen" ? undefined : { color: TOOL_TONE.draw }} /> Draw
            </button>
            <button type="button" className={toolTile(false)} disabled={uploading} onClick={() => mediaInput.current?.click()}>
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Image className="h-5 w-5" style={{ color: TOOL_TONE.media }} />} Photo
            </button>
            <button type="button" className={toolTile(false)} onClick={addTable}>
              <Table2 className="h-5 w-5" style={{ color: TOOL_TONE.table }} /> Table
            </button>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Choose a shape" className={toolTile(tool.startsWith("shape:"))}>
                  <Square className="h-5 w-5" style={tool.startsWith("shape:") ? undefined : { color: TOOL_TONE.shape }} /> Shape
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto rounded-xl border border-foreground/20 p-2 shadow-card" align="start">
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
                      className="btn-edge flex h-12 w-12 items-center justify-center rounded-lg text-white"
                      style={{ background: TOOL_TONE.shape }}
                    >
                      <Icon className="h-6 w-6" />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <button type="button" className={toolTile(false)} onClick={addDiagram}>
              <GitBranch className="h-5 w-5" style={{ color: TOOL_TONE.diagram }} /> Diagram
            </button>
            <button type="button" className={recording ? `${toolTile(false)} !border-[#9B2C2C] !bg-[#9B2C2C] !text-white` : toolTile(false)} disabled={uploading} onClick={() => void toggleRecording()}>
              {recording ? <StopCircle className="h-5 w-5" /> : <Mic className="h-5 w-5" style={{ color: TOOL_TONE.audio }} />} {recording ? "Stop" : "Audio"}
            </button>
            <button type="button" className={toolTile(false)} onClick={addLocation}>
              <MapPin className="h-5 w-5" style={{ color: TOOL_TONE.location }} /> Map
            </button>
            <input ref={mediaInput} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void addUploadedMedia(file);
              event.target.value = "";
            }} />
          </div>
          {tool !== "select" && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-[#14213D] py-1 pl-3 pr-1 text-xs font-medium text-white">
              <span className="flex items-center gap-2">
                {tool === "pen" ? <PenLine className="h-4 w-4 shrink-0" /> : <MousePointer2 className="h-4 w-4 shrink-0" />}
                {tool === "pen" ? "Draw anywhere on the page with your finger." : "Drag on the page to draw the shape at the size you want."}
              </span>
              <button type="button" onClick={() => setTool("select")} className="flex h-10 shrink-0 items-center gap-1 rounded-md bg-white/15 px-3 font-bold" aria-label="Finish with this tool">Done</button>
            </div>
          )}
        </div>
      )}

      <div
        ref={paperRef}
        data-testid="note-paper"
        className={`relative min-h-[560px] overflow-hidden rounded-2xl border border-foreground/20 bg-[#fffdf8] text-slate-900 shadow-[0_18px_50px_rgba(75,55,25,.14)] ${
          tool === "pen" || tool.startsWith("shape:") ? "touch-none cursor-crosshair" : canEdit && tool === "select" ? "cursor-text" : ""
        }`}
        style={{
          height: Math.max(560, canvas.height),
          backgroundImage: "linear-gradient(rgba(148,120,70,.055) 1px, transparent 1px)",
          backgroundSize: "100% 28px",
        }}
        tabIndex={canEdit ? 0 : undefined}
        aria-label="Note paper"
        onClick={(event) => {
          if (tool !== "select") return;
          const fromBlock = (event.target as HTMLElement | null)?.closest?.("[data-note-block]");
          if (fromBlock) {
            return;
          }
          setSelectedBlockId(null);
          if (canEdit) placePaperText(pointOnPaper(event));
        }}
        onKeyDown={(event) => {
          if (!canEdit || tool !== "select" || event.metaKey || event.ctrlKey || event.altKey) return;
          const target = event.target as HTMLElement;
          if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
          if (event.key.length !== 1) return;
          event.preventDefault();
          placePaperText({ x: 24, y: 28 });
        }}
        onPointerDown={beginPaperAction}
        onPointerMove={continuePaperAction}
        onPointerUp={finishPaperAction}
        onPointerCancel={finishPaperAction}
      >
        {visibleBlocks.length === 0 && !paperInk?.paths.length && (
          <div data-empty-paper className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-slate-400">
            <PenLine className="mb-3 h-8 w-8 opacity-40" />
            <p className="font-display text-lg font-semibold text-slate-700">A blank page</p>
            <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-600">Tap anywhere and start writing. Use the row above to add a list, a photo or a drawing.</p>
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
          const paperWriting = block.type === "text" && !isBoxedText(block);
          const transparent = block.type === "shape" || block.type === "drawing" || paperWriting;
          const boxed = !transparent && block.type !== "checklist" && block.type !== "diagram";
          const renderedWidth = Math.min(block.width, Math.max(block.type === "shape" ? 30 : 120, paperWidth - 16));
          const renderedX = Math.max(0, Math.min(block.x, paperWidth - renderedWidth - 8));
          return (
            <Rnd
              key={block.id}
              bounds="parent"
              position={{ x: renderedX, y: block.y }}
              // A list always shows every item and its Add button without scrolling inside the block.
              size={{ width: renderedWidth, height: block.type === "checklist" ? Math.max(block.height, block.items.length * 42 + (canEdit ? 124 : 76)) : block.height }}
              disableDragging={!toolsVisible || tool !== "select" || (paperWriting && !selected)}
              enableResizing={toolsVisible && tool === "select" && !paperWriting}
              minWidth={block.type === "shape" ? 30 : paperWriting ? 80 : 120}
              minHeight={block.type === "shape" ? 30 : paperWriting ? 40 : 72}
              dragHandleClassName="note-block-drag"
              onDragStop={(_event, data) => updateBlock(block.id, { x: data.x, y: data.y } as Partial<NoteCanvasBlock>)}
              onResizeStop={(_event, _direction, ref, _delta, position) => updateBlock(block.id, {
                x: position.x,
                y: position.y,
                width: ref.offsetWidth,
                height: ref.offsetHeight,
              } as Partial<NoteCanvasBlock>)}
              onMouseDown={() => setSelectedBlockId(block.id)}
              className={`group z-20 ${selected && !paperWriting ? "ring-2 ring-primary/60 ring-offset-2 ring-offset-[#fffdf8]" : ""}`}
            >
              <div data-note-block={block.id} className={`h-full overflow-hidden ${boxed ? "rounded-2xl border border-slate-200/90 bg-white/90 shadow-card" : "rounded-none border border-transparent bg-transparent"}`}>
                {toolsVisible && tool === "select" && !paperWriting && (
                  <div className={`note-block-drag absolute -top-2 left-3 right-3 z-30 flex h-5 cursor-grab items-center justify-between rounded-md bg-slate-800 px-2 text-[9px] font-bold uppercase tracking-wider text-white transition ${selected ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
                    Drag
                    <button type="button" className="rounded-full p-0.5 hover:bg-white/20" onClick={() => removeBlock(block.id)}><Trash2 className="h-3 w-3" /></button>
                  </div>
                )}

                {block.type === "text" && (
                  <div className={`flex h-full flex-col overflow-hidden ${paperWriting ? "p-0" : "p-2"}`}>
                    {canEdit && selected && isBoxedText(block) && (
                      <select value={block.textStyle} onChange={(event) => updateBlock(block.id, { textStyle: event.target.value as typeof block.textStyle })} className="mb-1 h-7 w-fit rounded-lg border border-slate-200 bg-white px-2 text-[10px]">
                        <option value="body">Body</option>
                        <option value="heading">Heading</option>
                        <option value="callout">Callout</option>
                      </select>
                    )}
                    <textarea
                      data-paper-text={block.id}
                      value={block.text}
                      readOnly={!canEdit}
                      onChange={(event) => {
                        const nextHeight = paperWriting
                          ? Math.max(56, event.currentTarget.scrollHeight)
                          : block.height;
                        updateBlock(block.id, { text: event.target.value, height: nextHeight });
                      }}
                      placeholder="Start typing…"
                      className={`min-h-0 flex-1 resize-none bg-transparent outline-none placeholder:text-slate-400 ${
                        paperWriting ? "p-0" : "p-1"
                      } ${
                        block.textStyle === "heading" ? "font-display text-2xl font-bold" : block.textStyle === "callout" ? "rounded-xl bg-amber-100/70 p-3 text-sm font-medium" : "text-[15px] leading-7"
                      }`}
                    />
                  </div>
                )}

                {block.type === "table" && (
                  <div className="flex h-full flex-col overflow-auto p-2">
                    <table className="w-full border-collapse text-sm">
                      <tbody>
                        {block.cells.map((row, rowIndex) => (
                          <tr key={`${block.id}-r${rowIndex}`}>
                            {row.map((cell, colIndex) => (
                              <td key={`${block.id}-r${rowIndex}-c${colIndex}`} className="border border-slate-300 bg-white p-0">
                                <input
                                  value={cell}
                                  readOnly={!canEdit}
                                  aria-label={`Table cell ${rowIndex + 1}, ${colIndex + 1}`}
                                  onChange={(event) => {
                                    const cells = block.cells.map((entry, r) =>
                                      r === rowIndex ? entry.map((value, c) => (c === colIndex ? event.target.value : value)) : entry,
                                    );
                                    updateBlock(block.id, { cells });
                                  }}
                                  className="h-9 w-full bg-transparent px-2 text-[13px] outline-none"
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {canEdit && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => updateBlock(block.id, {
                            cells: [...block.cells, block.cells[0]?.map(() => "") ?? [""]],
                            height: Math.max(block.height, (block.cells.length + 1) * 38 + 70),
                          })}
                          className="text-xs font-semibold text-indigo-700"
                        >
                          Add row
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBlock(block.id, {
                            cells: block.cells.map((row) => [...row, ""]),
                            width: Math.max(block.width, ((block.cells[0]?.length ?? 0) + 1) * 110 + 24),
                          })}
                          className="text-xs font-semibold text-indigo-700"
                        >
                          Add column
                        </button>
                      </div>
                    )}
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
                    <div className="mb-2 flex items-center gap-1.5">
                      <CheckSquare className="h-4 w-4 shrink-0 text-[#1F4D3A]" />
                      {canEdit ? (
                        <Input
                          value={block.title ?? "Checklist"}
                          onChange={(event) => updateBlock(block.id, { title: event.target.value })}
                          placeholder="Checklist title"
                          aria-label="Checklist title"
                          className="h-8 border-0 bg-transparent px-1 text-sm font-bold shadow-none"
                        />
                      ) : (
                        <p className="text-sm font-bold">{block.title?.trim() || "Checklist"}</p>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {block.items.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-1">
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={item.done}
                            aria-label={item.text ? `Tick ${item.text}` : "Tick item"}
                            disabled={!interactive}
                            onClick={() => {
                              const items = block.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, done: !entry.done } : entry);
                              updateBlock(block.id, { items });
                            }}
                            className="flex h-9 w-9 shrink-0 items-center justify-center"
                          >
                            <span className={`flex h-6 w-6 items-center justify-center rounded-md border-2 transition-colors duration-150 ${item.done ? "border-[#1F6B4F] bg-[#1F6B4F] text-white" : "border-slate-500 bg-white"}`}>
                              {item.done && <Check className="h-4 w-4" strokeWidth={3} />}
                            </span>
                          </button>
                          <Input
                            value={item.text}
                            readOnly={!canEdit}
                            placeholder="List item"
                            data-checklist-item={`${block.id}:${item.id}`}
                            onChange={(event) => {
                              const items = block.items.map((entry, itemIndex) => itemIndex === index ? { ...entry, text: event.target.value } : entry);
                              updateBlock(block.id, { items });
                            }}
                            onKeyDown={(event) => {
                              if (!canEdit || event.key !== "Enter" || event.nativeEvent.isComposing) return;
                              event.preventDefault();
                              const next = block.items[index + 1];
                              if (next) {
                                setPendingChecklistFocus(`${block.id}:${next.id}`);
                                return;
                              }
                              const newItem = { id: blockId(), text: "", done: false } satisfies NoteChecklistItem;
                              updateBlock(block.id, {
                                items: [...block.items, newItem],
                                height: Math.max(block.height, (block.items.length + 1) * 42 + 75),
                              });
                              setPendingChecklistFocus(`${block.id}:${newItem.id}`);
                            }}
                            className={`h-9 border-0 bg-transparent px-1 text-[15px] shadow-none ${item.done ? "text-slate-500 line-through" : ""}`}
                          />
                          {canEdit && <button type="button" onClick={() => updateBlock(block.id, { items: block.items.filter((entry) => entry.id !== item.id) })} aria-label="Remove item" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-500"><X className="h-4 w-4" /></button>}
                        </div>
                      ))}
                    </div>
                    {canEdit && (
                      <button type="button" onClick={() => updateBlock(block.id, { items: [...block.items, { id: blockId(), text: "", done: false } satisfies NoteChecklistItem] })} className="btn-edge mt-2 flex h-10 items-center gap-2 rounded-lg bg-[#1F4D3A] px-3 text-xs font-bold text-white">
                        <ListPlus className="h-4 w-4" /> Add item
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
        <button type="button" onClick={() => onChange({ ...canvas, height: canvas.height + 280 })} className="mx-auto flex h-10 items-center gap-2 rounded-lg border border-foreground/30 bg-card px-4 text-xs font-bold text-foreground">
          <Plus className="h-4 w-4" /> Make the page longer
        </button>
      )}
    </div>
  );
}

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Rnd } from "react-rnd";
import {
  GitBranch, Image, ListChecks, Loader2, MapPin, Mic, PenLine, Plus, Square, StopCircle, Trash2, Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NoteCanvas, NoteCanvasBlock } from "@/types/notes";
import { uploadNoteMedia } from "@/lib/noteMedia";
import { toast } from "sonner";

interface NoteCanvasEditorProps {
  canvas: NoteCanvas;
  canEdit: boolean;
  ownerId: string;
  noteId: string;
  onChange: (canvas: NoteCanvas) => void;
  onAddChecklist: () => void;
  onAddDiagram: () => void;
}

function blockId() {
  return crypto.randomUUID();
}

function nextPosition(canvas: NoteCanvas) {
  const index = canvas.blocks.length;
  return { x: 18 + (index % 3) * 22, y: 18 + (index % 5) * 24 };
}

function DrawingBlock({
  block,
  canEdit,
  onChange,
}: {
  block: Extract<NoteCanvasBlock, { type: "drawing" }>;
  canEdit: boolean;
  onChange: (block: Extract<NoteCanvasBlock, { type: "drawing" }>) => void;
}) {
  const drawing = useRef<string | null>(null);

  const point = (event: ReactPointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return `${Math.round(event.clientX - bounds.left)},${Math.round(event.clientY - bounds.top)}`;
  };

  return (
    <div className="relative h-full overflow-hidden rounded-xl bg-white">
      <svg
        className={`h-full w-full touch-none ${canEdit ? "cursor-crosshair" : ""}`}
        onPointerDown={(event) => {
          if (!canEdit) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          drawing.current = `M${point(event)}`;
          onChange({ ...block, paths: [...block.paths, drawing.current] });
        }}
        onPointerMove={(event) => {
          if (!drawing.current || !canEdit) return;
          drawing.current += ` L${point(event)}`;
          onChange({ ...block, paths: [...block.paths.slice(0, -1), drawing.current] });
        }}
        onPointerUp={() => { drawing.current = null; }}
        onPointerCancel={() => { drawing.current = null; }}
      >
        {block.paths.map((path, index) => (
          <path key={`${block.id}-${index}`} d={path} fill="none" stroke={block.stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      {canEdit && block.paths.length > 0 && (
        <button type="button" className="absolute bottom-1 right-1 rounded-lg bg-white/90 px-2 py-1 text-[10px] shadow" onClick={() => onChange({ ...block, paths: [] })}>
          Clear
        </button>
      )}
    </div>
  );
}

export function NoteCanvasEditor({
  canvas,
  canEdit,
  ownerId,
  noteId,
  onChange,
  onAddChecklist,
  onAddDiagram,
}: NoteCanvasEditorProps) {
  const mediaInput = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const audioParts = useRef<Blob[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);

  const setBlocks = (blocks: NoteCanvasBlock[]) => onChange({ ...canvas, blocks });
  const updateBlock = (id: string, patch: Partial<NoteCanvasBlock>) => {
    setBlocks(canvas.blocks.map((block) => block.id === id ? ({ ...block, ...patch } as NoteCanvasBlock) : block));
  };
  const addBlock = (block: NoteCanvasBlock) => setBlocks([...canvas.blocks, block]);
  const removeBlock = (id: string) => setBlocks(canvas.blocks.filter((block) => block.id !== id));

  const addText = () => {
    const pos = nextPosition(canvas);
    addBlock({ id: blockId(), type: "text", ...pos, width: 260, height: 150, text: "", textStyle: "body" });
  };

  const addShape = (shape: "rectangle" | "ellipse" | "diamond") => {
    const pos = nextPosition(canvas);
    addBlock({ id: blockId(), type: "shape", ...pos, width: 180, height: 120, shape, label: "", fill: "#d8f3ef" });
  };

  const addDrawing = () => {
    const pos = nextPosition(canvas);
    addBlock({ id: blockId(), type: "drawing", ...pos, width: 280, height: 240, paths: [], stroke: "#173f46" });
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
        width: 280,
        height: file.type.startsWith("video/") ? 240 : 260,
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
          addBlock({ id: blockId(), type: "media", ...pos, width: 280, height: 110, mediaType: "audio", url, name: "Audio recording" });
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
          width: 260,
          height: 125,
          latitude: coords.latitude,
          longitude: coords.longitude,
          label: "Saved location",
        });
      },
      () => toast.error("Location permission was not granted"),
      { enableHighAccuracy: false, timeout: 10_000 },
    );
  };

  return (
    <div className="space-y-2">
      {canEdit && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-border/60 bg-card p-2 shadow-sm">
          <span className="mr-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <Plus className="h-3.5 w-3.5" /> Insert
          </span>
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2" onClick={addText}><Type className="mr-1 h-3.5 w-3.5" /> Text</Button>
          <select
            aria-label="Insert shape"
            value=""
            onChange={(event) => event.target.value && addShape(event.target.value as "rectangle" | "ellipse" | "diamond")}
            className="h-8 rounded-lg border border-border bg-card px-2 text-xs"
          >
            <option value="">Shape…</option>
            <option value="rectangle">Rectangle</option>
            <option value="ellipse">Circle / oval</option>
            <option value="diamond">Decision diamond</option>
          </select>
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2" onClick={addDrawing}><PenLine className="mr-1 h-3.5 w-3.5" /> Draw</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2" onClick={onAddChecklist}><ListChecks className="mr-1 h-3.5 w-3.5" /> Checklist</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2" onClick={onAddDiagram}><GitBranch className="mr-1 h-3.5 w-3.5" /> Flowchart</Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2" disabled={uploading} onClick={() => mediaInput.current?.click()}>
            {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Image className="mr-1 h-3.5 w-3.5" />} Photo / video
          </Button>
          <Button type="button" variant={recording ? "destructive" : "ghost"} size="sm" className="h-8 rounded-lg px-2" disabled={uploading} onClick={() => void toggleRecording()}>
            {recording ? <StopCircle className="mr-1 h-3.5 w-3.5" /> : <Mic className="mr-1 h-3.5 w-3.5" />} {recording ? "Stop" : "Record"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg px-2" onClick={addLocation}><MapPin className="mr-1 h-3.5 w-3.5" /> Location</Button>
          <input ref={mediaInput} type="file" accept="image/*,video/*" className="hidden" onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void addUploadedMedia(file);
            event.target.value = "";
          }} />
        </div>
      )}

      <div
        className="relative min-h-[520px] overflow-hidden rounded-2xl border border-border/60 bg-[radial-gradient(circle_at_1px_1px,hsl(var(--border))_1px,transparent_0)] bg-[size:22px_22px] shadow-inner"
        style={{ height: Math.max(520, canvas.height) }}
      >
        {canvas.blocks.length === 0 && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center text-muted-foreground">
            <Square className="mb-2 h-8 w-8 opacity-35" />
            <p className="text-sm font-semibold text-foreground/65">A blank canvas</p>
            <p className="mt-1 max-w-xs text-xs">Insert text, shapes, a sketch, checklist, flowchart, media, audio or a location.</p>
          </div>
        )}
        {canvas.blocks.map((block) => (
          <Rnd
            key={block.id}
            bounds="parent"
            position={{ x: block.x, y: block.y }}
            size={{ width: block.width, height: block.height }}
            disableDragging={!canEdit}
            enableResizing={canEdit}
            minWidth={120}
            minHeight={72}
            dragHandleClassName="note-block-drag"
            onDragStop={(_event, data) => updateBlock(block.id, { x: data.x, y: data.y } as Partial<NoteCanvasBlock>)}
            onResizeStop={(_event, _direction, ref, _delta, position) => updateBlock(block.id, {
              x: position.x,
              y: position.y,
              width: ref.offsetWidth,
              height: ref.offsetHeight,
            } as Partial<NoteCanvasBlock>)}
            className="group"
          >
            <div className="h-full rounded-2xl border border-border/70 bg-card shadow-card">
              {canEdit && (
                <div className="note-block-drag absolute -top-2 left-3 right-3 z-20 flex h-5 cursor-grab items-center justify-between rounded-full bg-foreground/80 px-2 text-[9px] font-bold uppercase tracking-wider text-background opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                  Drag
                  <button type="button" className="rounded-full p-0.5 hover:bg-white/20" onClick={() => removeBlock(block.id)}><Trash2 className="h-3 w-3" /></button>
                </div>
              )}
              {block.type === "text" && (
                <div className="flex h-full flex-col overflow-hidden p-2">
                  {canEdit && (
                    <select value={block.textStyle} onChange={(event) => updateBlock(block.id, { textStyle: event.target.value as typeof block.textStyle })} className="mb-1 h-7 w-fit rounded-lg border border-border bg-muted/40 px-2 text-[10px]">
                      <option value="body">Body text</option>
                      <option value="heading">Heading</option>
                      <option value="callout">Callout</option>
                    </select>
                  )}
                  <textarea
                    value={block.text}
                    readOnly={!canEdit}
                    onChange={(event) => updateBlock(block.id, { text: event.target.value })}
                    placeholder="Start typing…"
                    className={`min-h-0 flex-1 resize-none bg-transparent p-1 outline-none ${
                      block.textStyle === "heading" ? "font-display text-xl font-bold" : block.textStyle === "callout" ? "rounded-xl bg-primary/10 p-3 text-sm font-medium" : "text-sm leading-relaxed"
                    }`}
                  />
                </div>
              )}
              {block.type === "shape" && (
                <div className="relative flex h-full items-center justify-center overflow-hidden p-4">
                  <div
                    className="absolute inset-3 border-2 border-primary/40"
                    style={{
                      backgroundColor: block.fill,
                      borderRadius: block.shape === "ellipse" ? "999px" : "18px",
                      transform: block.shape === "diamond" ? "rotate(45deg) scale(.7)" : undefined,
                    }}
                  />
                  <input value={block.label} readOnly={!canEdit} onChange={(event) => updateBlock(block.id, { label: event.target.value })} placeholder="Label" className="relative z-10 w-3/4 bg-transparent text-center text-sm font-semibold outline-none" />
                </div>
              )}
              {block.type === "drawing" && <DrawingBlock block={block} canEdit={canEdit} onChange={(next) => updateBlock(block.id, next)} />}
              {block.type === "media" && (
                <div className="flex h-full items-center justify-center overflow-hidden rounded-2xl bg-black/5">
                  {block.mediaType === "image" && <img src={block.url} alt={block.name} className="h-full w-full object-contain" />}
                  {block.mediaType === "video" && <video src={block.url} controls className="h-full w-full object-contain" />}
                  {block.mediaType === "audio" && <audio src={block.url} controls className="w-[90%]" />}
                </div>
              )}
              {block.type === "location" && (
                <a href={`https://www.google.com/maps?q=${block.latitude},${block.longitude}`} target="_blank" rel="noreferrer" className="flex h-full flex-col items-center justify-center rounded-2xl bg-primary/10 p-4 text-center">
                  <MapPin className="h-7 w-7 text-primary" />
                  <input value={block.label} readOnly={!canEdit} onClick={(event) => canEdit && event.preventDefault()} onChange={(event) => updateBlock(block.id, { label: event.target.value })} className="mt-2 w-full bg-transparent text-center text-sm font-bold outline-none" />
                  <span className="mt-1 text-[10px] text-muted-foreground">{block.latitude.toFixed(5)}, {block.longitude.toFixed(5)}</span>
                </a>
              )}
            </div>
          </Rnd>
        ))}
      </div>
    </div>
  );
}

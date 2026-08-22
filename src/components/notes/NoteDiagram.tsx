import { useId, useMemo, useState } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NoteDiagram, NoteDiagramNode } from "@/types/notes";

function nid() {
  return `d${Date.now()}${Math.random().toString(36).slice(2, 5)}`;
}

const TEMPLATES: { id: string; label: string; build: () => NoteDiagram }[] = [
  {
    id: "flow",
    label: "Flowchart",
    build: () => ({
      nodes: [
        { id: "a", label: "Start", x: 160, y: 24, shape: "oval" },
        { id: "b", label: "Step", x: 160, y: 110, shape: "box" },
        { id: "c", label: "Done", x: 160, y: 196, shape: "oval" },
      ],
      edges: [
        { id: "e1", from: "a", to: "b" },
        { id: "e2", from: "b", to: "c" },
      ],
    }),
  },
  {
    id: "decision",
    label: "Decision",
    build: () => ({
      nodes: [
        { id: "a", label: "Start", x: 170, y: 16, shape: "oval" },
        { id: "b", label: "Question?", x: 170, y: 100, shape: "diamond" },
        { id: "c", label: "Yes", x: 70, y: 200, shape: "box" },
        { id: "d", label: "No", x: 270, y: 200, shape: "box" },
      ],
      edges: [
        { id: "e1", from: "a", to: "b" },
        { id: "e2", from: "b", to: "c", label: "Yes" },
        { id: "e3", from: "b", to: "d", label: "No" },
      ],
    }),
  },
  {
    id: "process",
    label: "Process",
    build: () => ({
      nodes: [
        { id: "a", label: "1", x: 40, y: 90, shape: "circle" },
        { id: "b", label: "2", x: 160, y: 90, shape: "circle" },
        { id: "c", label: "3", x: 280, y: 90, shape: "circle" },
      ],
      edges: [
        { id: "e1", from: "a", to: "b" },
        { id: "e2", from: "b", to: "c" },
      ],
    }),
  },
];

const NODE_LINE_HEIGHT = 14;

function wrapLabel(label: string, maxCharacters: number) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const pieces = words.flatMap((word) => {
    if (word.length <= maxCharacters) return [word];
    return Array.from({ length: Math.ceil(word.length / maxCharacters) }, (_, index) =>
      word.slice(index * maxCharacters, (index + 1) * maxCharacters),
    );
  });
  return pieces.reduce<string[]>((lines, word) => {
    const last = lines.at(-1);
    if (!last || last.length + word.length + 1 > maxCharacters) lines.push(word);
    else lines[lines.length - 1] = `${last} ${word}`;
    return lines;
  }, []);
}

function shapePath(n: NoteDiagramNode) {
  const lines = wrapLabel(n.label, n.shape === "diamond" || n.shape === "circle" ? 16 : 22);
  const textWidth = Math.max(...lines.map((line) => line.length), 1) * 6.4;
  const textHeight = Math.max(lines.length, 1) * NODE_LINE_HEIGHT;
  let w = Math.max(n.shape === "diamond" ? 120 : n.shape === "circle" ? 72 : 128, textWidth + 28);
  let h = Math.max(n.shape === "diamond" ? 72 : n.shape === "circle" ? 72 : n.shape === "oval" ? 48 : 44, textHeight + 20);
  if (n.shape === "diamond") {
    w = Math.max(w, textWidth + 64);
    h = Math.max(h, textHeight + 42);
  } else if (n.shape === "circle") {
    w = h = Math.max(w, h);
  }
  const x = n.x - w / 2;
  const y = n.y - h / 2;
  if (n.shape === "diamond") {
    return { type: "polygon" as const, points: `${n.x},${y} ${x + w},${n.y} ${n.x},${y + h} ${x},${n.y}`, x, y, w, h, lines };
  }
  return { type: n.shape === "circle" || n.shape === "oval" ? "ellipse" as const : "rect" as const, x, y, w, h, lines };
}

type NodeShape = ReturnType<typeof shapePath>;

function boundaryPoint(node: NoteDiagramNode, shape: NodeShape, dx: number, dy: number) {
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y };
  const rx = shape.w / 2;
  const ry = shape.h / 2;
  let scale: number;
  if (shape.type === "ellipse") {
    scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  } else if (shape.type === "polygon") {
    scale = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
  } else {
    scale = 1 / Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry);
  }
  return { x: node.x + dx * scale, y: node.y + dy * scale };
}

export function DiagramCanvas({ diagram, className }: { diagram: NoteDiagram; className?: string }) {
  const markerId = `note-diagram-arrow-${useId().replace(/:/g, "")}`;
  const nodeMap = useMemo(() => Object.fromEntries(diagram.nodes.map((n) => [n.id, n])), [diagram.nodes]);
  const shapes = useMemo(
    () => Object.fromEntries(diagram.nodes.map((node) => [node.id, shapePath(node)])),
    [diagram.nodes],
  );
  const edges = diagram.edges.flatMap((edge) => {
    const from = nodeMap[edge.from];
    const to = nodeMap[edge.to];
    if (!from || !to) return [];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const start = boundaryPoint(from, shapes[from.id], dx, dy);
    const end = boundaryPoint(to, shapes[to.id], -dx, -dy);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const normalX = length ? -(end.y - start.y) / length : 0;
    const normalY = length ? (end.x - start.x) / length : 0;
    const labelWidth = edge.label ? Math.max(20, edge.label.length * 6.2 + 10) : 0;
    const labelHeight = edge.label ? 18 : 0;
    const labelX = start.x + (end.x - start.x) * 0.46 + normalX * 11;
    const labelY = start.y + (end.y - start.y) * 0.46 + normalY * 11;
    return [{ edge, start, end, labelX, labelY, labelWidth, labelHeight }];
  });
  const bounds = [
    ...diagram.nodes.map((node) => {
      const shape = shapes[node.id];
      return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.w, maxY: shape.y + shape.h };
    }),
    ...edges.flatMap(({ start, end, labelX, labelY, labelWidth, labelHeight }) => [
      { minX: Math.min(start.x, end.x), minY: Math.min(start.y, end.y), maxX: Math.max(start.x, end.x), maxY: Math.max(start.y, end.y) },
      ...(labelWidth ? [{
        minX: labelX - labelWidth / 2,
        minY: labelY - labelHeight / 2,
        maxX: labelX + labelWidth / 2,
        maxY: labelY + labelHeight / 2,
      }] : []),
    ]),
  ];
  const padding = 18;
  const minX = bounds.length ? Math.min(...bounds.map((bound) => bound.minX)) - padding : 0;
  const minY = bounds.length ? Math.min(...bounds.map((bound) => bound.minY)) - padding : 0;
  const maxX = bounds.length ? Math.max(...bounds.map((bound) => bound.maxX)) + padding : 360;
  const maxY = bounds.length ? Math.max(...bounds.map((bound) => bound.maxY)) + padding : 220;

  return (
    <svg viewBox={`${minX} ${minY} ${Math.max(maxX - minX, 1)} ${Math.max(maxY - minY, 1)}`} className={className ?? "w-full h-auto"} role="img">
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" opacity="0.55" />
        </marker>
      </defs>
      {edges.map(({ edge, start, end, labelX, labelY, labelWidth, labelHeight }) => {
        return (
          <g key={edge.id}>
            <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="currentColor" strokeWidth="1.6" markerEnd={`url(#${markerId})`} opacity="0.55" />
            {edge.label && (
              <g>
                <rect
                  x={labelX - labelWidth / 2}
                  y={labelY - labelHeight / 2}
                  width={labelWidth}
                  height={labelHeight}
                  rx="5"
                  fill="hsl(var(--card))"
                  stroke="hsl(var(--border))"
                  strokeWidth="0.75"
                />
                <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="600" fill="currentColor">
                  {edge.label}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {diagram.nodes.map((n) => {
        const s = shapes[n.id];
        return (
          <g key={n.id}>
            {s.type === "polygon" && (
              <polygon points={s.points} fill="hsl(var(--card))" stroke="currentColor" strokeWidth="1.4" />
            )}
            {s.type === "ellipse" && (
              <ellipse cx={n.x} cy={n.y} rx={s.w / 2} ry={s.h / 2} fill="hsl(var(--card))" stroke="currentColor" strokeWidth="1.4" />
            )}
            {s.type === "rect" && (
              <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="8" fill="hsl(var(--card))" stroke="currentColor" strokeWidth="1.4" />
            )}
            <text textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor">
              {s.lines.map((line, index) => (
                <tspan key={`${index}-${line}`} x={n.x} y={n.y + (index - (s.lines.length - 1) / 2) * NODE_LINE_HEIGHT} dominantBaseline="central">
                  {line}
                </tspan>
              ))}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function NoteDiagramEditor({
  diagram,
  onChange,
  canEdit,
}: {
  diagram: NoteDiagram | null | undefined;
  onChange: (next: NoteDiagram | null) => void;
  canEdit: boolean;
}) {
  const [fromId, setFromId] = useState("");
  const current = diagram ?? { nodes: [], edges: [] };

  if (!diagram) {
    return (
      <div className="rounded-xl border border-dashed border-border p-3 space-y-2">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <GitBranch className="h-4 w-4" /> Diagram or flowchart
        </p>
        <p className="text-[11px] text-muted-foreground">Optional. Add a simple flow, decision tree, or process map to this note.</p>
        {canEdit && (
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATES.map((t) => (
              <Button key={t.id} type="button" size="sm" variant="outline" onClick={() => onChange(t.build())}>
                {t.label}
              </Button>
            ))}
            <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ nodes: [{ id: nid(), label: "Idea", x: 180, y: 80, shape: "box" }], edges: [] })}>
              Blank
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <GitBranch className="h-4 w-4" /> Diagram
        </p>
        {canEdit && (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      <div className="rounded-lg bg-muted/40 p-2">
        <DiagramCanvas diagram={current} />
      </div>
      {canEdit && (
        <div className="space-y-2">
          {current.nodes.map((n) => (
            <div key={n.id} className="flex items-center gap-1.5">
              <Input
                value={n.label}
                onChange={(e) => onChange({
                  ...current,
                  nodes: current.nodes.map((x) => x.id === n.id ? { ...x, label: e.target.value } : x),
                })}
              />
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                value={n.shape}
                onChange={(e) => onChange({
                  ...current,
                  nodes: current.nodes.map((x) => x.id === n.id ? { ...x, shape: e.target.value as NoteDiagramNode["shape"] } : x),
                })}
              >
                <option value="box">Box</option>
                <option value="diamond">Decision</option>
                <option value="oval">Start / end</option>
                <option value="circle">Circle</option>
              </select>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange({
                  nodes: current.nodes.filter((x) => x.id !== n.id),
                  edges: current.edges.filter((e) => e.from !== n.id && e.to !== n.id),
                })}
                aria-label="Remove node"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({
              ...current,
              nodes: [...current.nodes, { id: nid(), label: "New", x: 80 + (current.nodes.length % 3) * 110, y: 40 + current.nodes.length * 28, shape: "box" }],
            })}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Box
          </Button>
          {current.nodes.length >= 2 && (
            <div className="flex items-center gap-1.5">
              <select className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs" value={fromId} onChange={(e) => setFromId(e.target.value)}>
                <option value="">From…</option>
                {current.nodes.map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
              <select
                className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                defaultValue=""
                onChange={(e) => {
                  const to = e.target.value;
                  if (!fromId || !to) return;
                  onChange({
                    ...current,
                    edges: [...current.edges, { id: nid(), from: fromId, to }],
                  });
                  e.currentTarget.value = "";
                }}
              >
                <option value="">To…</option>
                {current.nodes.filter((n) => n.id !== fromId).map((n) => <option key={n.id} value={n.id}>{n.label}</option>)}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useId, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  Camera, Cloud, Computer, Database, Globe, HardDrive, Hexagon, Home, Laptop,
  MonitorSpeaker, Phone, Printer, Router, Server, Shield, Smartphone, Square, Trash2, Tv,
  User, Users, Wifi, Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { NoteDiagram, NoteDiagramIcon, NoteDiagramNode, NoteDiagramShape } from "@/types/notes";
import {
  DIAGRAM_FILLS,
  DIAGRAM_ICONS,
  DIAGRAM_SHAPES,
  DIAGRAM_TEMPLATES,
  addDiagramNode,
  connectDiagramNodes,
  diagramBoundaryPoint,
  diagramNodeMetrics,
  emptyDiagram,
  removeDiagramSelection,
  type DiagramNodeMetrics,
} from "@/lib/noteDiagram";

const ICON: Record<Exclude<NoteDiagramIcon, "none">, LucideIcon> = {
  router: Router,
  wifi: Wifi,
  switch: Workflow,
  server: Server,
  computer: Computer,
  laptop: Laptop,
  phone: Smartphone,
  printer: Printer,
  camera: Camera,
  tv: Tv,
  cloud: Cloud,
  database: Database,
  globe: Globe,
  shield: Shield,
  home: Home,
  user: User,
  users: Users,
  harddrive: HardDrive,
  speaker: MonitorSpeaker,
};

function nodePath(node: NoteDiagramNode, m: DiagramNodeMetrics) {
  const { x, y, w, h } = m;
  const cx = node.x;
  const cy = node.y;
  if (node.shape === "diamond") {
    return { type: "polygon" as const, points: `${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}` };
  }
  if (node.shape === "parallelogram") {
    const skew = Math.min(22, w * 0.18);
    return { type: "polygon" as const, points: `${x + skew},${y} ${x + w},${y} ${x + w - skew},${y + h} ${x},${y + h}` };
  }
  if (node.shape === "hexagon") {
    const inset = w * 0.22;
    return {
      type: "polygon" as const,
      points: `${x + inset},${y} ${x + w - inset},${y} ${x + w},${cy} ${x + w - inset},${y + h} ${x + inset},${y + h} ${x},${cy}`,
    };
  }
  if (node.shape === "cloud") {
    return {
      type: "path" as const,
      d: `M${x + w * 0.22} ${y + h * 0.62} C${x} ${y + h * 0.62} ${x} ${y + h * 0.22} ${x + w * 0.28} ${y + h * 0.28} C${x + w * 0.3} ${y} ${x + w * 0.62} ${y} ${x + w * 0.68} ${y + h * 0.28} C${x + w} ${y + h * 0.18} ${x + w} ${y + h * 0.7} ${x + w * 0.78} ${y + h * 0.72} C${x + w * 0.72} ${y + h} ${x + w * 0.28} ${y + h} ${x + w * 0.22} ${y + h * 0.62} Z`,
    };
  }
  if (node.shape === "document") {
    return {
      type: "path" as const,
      d: `M${x} ${y} H${x + w - 16} L${x + w} ${y + 16} V${y + h} H${x} Z`,
    };
  }
  if (node.shape === "circle" || node.shape === "oval") return { type: "ellipse" as const };
  if (node.shape === "cylinder") return { type: "cylinder" as const };
  return { type: "rect" as const, radius: node.shape === "rounded" ? 16 : 8 };
}

function NodeGlyph({ node, metrics, selected }: { node: NoteDiagramNode; metrics: DiagramNodeMetrics; selected?: boolean }) {
  const path = nodePath(node, metrics);
  const fill = node.fill || "hsl(var(--card))";
  const stroke = selected ? "hsl(var(--primary))" : "rgba(15,23,42,0.55)";
  const Icon = node.icon && node.icon !== "none" ? ICON[node.icon] : null;
  const textOffset = Icon ? 10 : 0;
  return (
    <g>
      {path.type === "polygon" && <polygon points={path.points} fill={fill} stroke={stroke} strokeWidth={selected ? 2.4 : 1.5} />}
      {path.type === "path" && <path d={path.d} fill={fill} stroke={stroke} strokeWidth={selected ? 2.4 : 1.5} />}
      {path.type === "ellipse" && (
        <ellipse cx={node.x} cy={node.y} rx={metrics.w / 2} ry={metrics.h / 2} fill={fill} stroke={stroke} strokeWidth={selected ? 2.4 : 1.5} />
      )}
      {path.type === "rect" && (
        <rect x={metrics.x} y={metrics.y} width={metrics.w} height={metrics.h} rx={path.radius} fill={fill} stroke={stroke} strokeWidth={selected ? 2.4 : 1.5} />
      )}
      {path.type === "cylinder" && (
        <>
          <rect x={metrics.x} y={metrics.y + 10} width={metrics.w} height={metrics.h - 20} fill={fill} stroke={stroke} strokeWidth={selected ? 2.4 : 1.5} />
          <ellipse cx={node.x} cy={metrics.y + 10} rx={metrics.w / 2} ry={10} fill={fill} stroke={stroke} strokeWidth={selected ? 2.4 : 1.5} />
          <ellipse cx={node.x} cy={metrics.y + metrics.h - 10} rx={metrics.w / 2} ry={10} fill={fill} stroke="none" />
          <path d={`M${metrics.x} ${metrics.y + metrics.h - 10} A${metrics.w / 2} 10 0 0 0 ${metrics.x + metrics.w} ${metrics.y + metrics.h - 10}`} fill="none" stroke={stroke} strokeWidth={selected ? 2.4 : 1.5} />
        </>
      )}
      {Icon && (
        <foreignObject x={node.x - 8} y={metrics.y + 7} width={16} height={16}>
          <Icon className="h-4 w-4 text-slate-700" />
        </foreignObject>
      )}
      <text textAnchor="middle" fontSize="11" fontWeight="650" fill="#1e293b">
        {metrics.lines.map((line, index) => (
          <tspan
            key={`${index}-${line}`}
            x={node.x}
            y={node.y + textOffset + (index - (metrics.lines.length - 1) / 2) * 14}
            dominantBaseline="central"
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

export function DiagramCanvas({ diagram, className }: { diagram: NoteDiagram; className?: string }) {
  const markerId = `note-diagram-arrow-${useId().replace(/:/g, "")}`;
  const nodeMap = useMemo(() => Object.fromEntries(diagram.nodes.map((node) => [node.id, node])), [diagram.nodes]);
  const shapes = useMemo(
    () => Object.fromEntries(diagram.nodes.map((node) => [node.id, diagramNodeMetrics(node)])),
    [diagram.nodes],
  );
  const edges = diagram.edges.flatMap((edge) => {
    const from = nodeMap[edge.from];
    const to = nodeMap[edge.to];
    if (!from || !to) return [];
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const start = diagramBoundaryPoint(from, shapes[from.id], dx, dy);
    const end = diagramBoundaryPoint(to, shapes[to.id], -dx, -dy);
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    const normalX = length ? -(end.y - start.y) / length : 0;
    const normalY = length ? (end.x - start.x) / length : 0;
    const labelWidth = edge.label ? Math.max(20, edge.label.length * 6.2 + 10) : 0;
    const labelX = start.x + (end.x - start.x) * 0.46 + normalX * 11;
    const labelY = start.y + (end.y - start.y) * 0.46 + normalY * 11;
    return [{ edge, start, end, labelX, labelY, labelWidth }];
  });
  const bounds = [
    ...diagram.nodes.map((node) => {
      const shape = shapes[node.id];
      return { minX: shape.x, minY: shape.y, maxX: shape.x + shape.w, maxY: shape.y + shape.h };
    }),
    ...edges.map(({ start, end }) => ({
      minX: Math.min(start.x, end.x),
      minY: Math.min(start.y, end.y),
      maxX: Math.max(start.x, end.x),
      maxY: Math.max(start.y, end.y),
    })),
  ];
  const padding = 18;
  const minX = bounds.length ? Math.min(...bounds.map((bound) => bound.minX)) - padding : 0;
  const minY = bounds.length ? Math.min(...bounds.map((bound) => bound.minY)) - padding : 0;
  const maxX = bounds.length ? Math.max(...bounds.map((bound) => bound.maxX)) + padding : 360;
  const maxY = bounds.length ? Math.max(...bounds.map((bound) => bound.maxY)) + padding : 220;

  return (
    <svg viewBox={`${minX} ${minY} ${Math.max(maxX - minX, 1)} ${Math.max(maxY - minY, 1)}`} className={className ?? "h-auto w-full"} role="img">
      <defs>
        <marker id={markerId} markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
          <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" opacity="0.55" />
        </marker>
      </defs>
      {edges.map(({ edge, start, end, labelX, labelY, labelWidth }) => (
        <g key={edge.id}>
          <line
            x1={start.x}
            y1={start.y}
            x2={end.x}
            y2={end.y}
            stroke="currentColor"
            strokeWidth="1.6"
            strokeDasharray={edge.style === "dashed" ? "6 5" : undefined}
            markerEnd={edge.arrow === "none" ? undefined : `url(#${markerId})`}
            opacity="0.55"
          />
          {edge.label && (
            <g>
              <rect x={labelX - labelWidth / 2} y={labelY - 9} width={labelWidth} height={18} rx="5" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="0.75" />
              <text x={labelX} y={labelY} textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight="600" fill="currentColor">
                {edge.label}
              </text>
            </g>
          )}
        </g>
      ))}
      {diagram.nodes.map((node) => (
        <NodeGlyph key={node.id} node={node} metrics={shapes[node.id]} />
      ))}
    </svg>
  );
}

function TemplateGallery({ onPick }: { onPick: (diagram: NoteDiagram) => void }) {
  const groups = ["Flow", "Home", "Family"] as const;
  return (
    <div className="space-y-3">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Workflow className="h-4 w-4" /> Diagram
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">Pick a template, or start blank and build it like a chart.</p>
      </div>
      {groups.map((group) => (
        <div key={group} className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{group}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {DIAGRAM_TEMPLATES.filter((item) => item.group === group).map((template) => {
              const preview = template.build();
              return (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onPick(template.build())}
                  className="rounded-2xl border border-border/50 bg-card p-3 text-left shadow-card transition hover:border-primary/40"
                >
                  <div className="mb-2 h-24 overflow-hidden rounded-xl bg-background">
                    {preview.nodes.length ? <DiagramCanvas diagram={preview} className="h-full w-full" /> : (
                      <div className="flex h-full items-center justify-center text-[11px] text-muted-foreground">Empty board</div>
                    )}
                  </div>
                  <p className="text-sm font-semibold">{template.label}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{template.hint}</p>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

type Selection = { kind: "node" | "edge"; id: string } | null;

export function NoteDiagramEditor({
  diagram,
  onChange,
  canEdit,
}: {
  diagram: NoteDiagram | null | undefined;
  onChange: (next: NoteDiagram | null) => void;
  canEdit: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [tool, setTool] = useState<"select" | "connect">("select");
  const [selected, setSelected] = useState<Selection>(null);
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const drag = useRef<{ id: string; ox: number; oy: number } | null>(null);
  const current = diagram ?? emptyDiagram();

  if (!diagram) {
    return (
      <div className="rounded-2xl border border-border/50 bg-card p-3 shadow-card">
        {canEdit ? <TemplateGallery onPick={onChange} /> : <p className="text-sm text-muted-foreground">No diagram on this note.</p>}
      </div>
    );
  }

  const metrics = Object.fromEntries(current.nodes.map((node) => [node.id, diagramNodeMetrics(node)]));
  const selectedNode = selected?.kind === "node" ? current.nodes.find((node) => node.id === selected.id) : undefined;
  const selectedEdge = selected?.kind === "edge" ? current.edges.find((edge) => edge.id === selected.id) : undefined;
  const width = Math.max(720, ...current.nodes.map((node) => metrics[node.id].x + metrics[node.id].w + 80), 720);
  const height = Math.max(460, ...current.nodes.map((node) => metrics[node.id].y + metrics[node.id].h + 80), 460);

  const pointOnBoard = (event: ReactPointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    };
  };

  const patchNode = (id: string, patch: Partial<NoteDiagramNode>) => {
    onChange({ ...current, nodes: current.nodes.map((node) => node.id === id ? { ...node, ...patch } : node) });
  };
  const patchEdge = (id: string, patch: Partial<NoteDiagram["edges"][number]>) => {
    onChange({ ...current, edges: current.edges.map((edge) => edge.id === id ? { ...edge, ...patch } : edge) });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Workflow className="h-4 w-4" /> Diagram
        </p>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button type="button" size="sm" variant={tool === "select" ? "default" : "outline"} className="h-8 rounded-lg" onClick={() => { setTool("select"); setConnectFrom(null); }}>
              Move
            </Button>
            <Button type="button" size="sm" variant={tool === "connect" ? "default" : "outline"} className="h-8 rounded-lg" onClick={() => setTool("connect")}>
              Connect
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8 rounded-lg" onClick={() => { setSelected(null); onChange(null); }}>
              Templates
            </Button>
            {selected && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 rounded-lg text-destructive"
                onClick={() => {
                  onChange(removeDiagramSelection(current, selected.kind, selected.id));
                  setSelected(null);
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid gap-0 lg:grid-cols-[7.5rem_minmax(0,1fr)]">
        {canEdit && (
          <aside className="flex gap-1 overflow-x-auto border-b border-border/40 p-2 lg:flex-col lg:overflow-x-hidden lg:border-b-0 lg:border-r">
            {DIAGRAM_SHAPES.map((shape) => (
              <button
                key={shape.id}
                type="button"
                title={shape.label}
                onClick={() => {
                  const next = addDiagramNode(current, shape.id);
                  onChange(next);
                  setSelected({ kind: "node", id: next.nodes.at(-1)!.id });
                  setTool("select");
                }}
                className="flex h-9 min-w-9 items-center justify-center rounded-lg border border-border/50 bg-background text-[10px] font-semibold hover:border-primary/40"
              >
                {shape.id === "diamond" ? <Hexagon className="h-3.5 w-3.5 rotate-90" /> : <Square className="h-3.5 w-3.5" />}
              </button>
            ))}
          </aside>
        )}

        <div className="min-w-0">
          <div className="max-h-[420px] overflow-auto bg-[linear-gradient(rgba(15,23,42,.04)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,.04)_1px,transparent_1px)] bg-[size:24px_24px]">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${width} ${height}`}
              className="h-[380px] w-full touch-none"
              role="img"
              aria-label="Diagram board"
              onPointerMove={(event) => {
                if (!canEdit || !drag.current) return;
                const point = pointOnBoard(event);
                patchNode(drag.current.id, { x: point.x - drag.current.ox, y: point.y - drag.current.oy });
              }}
              onPointerUp={() => { drag.current = null; }}
              onPointerLeave={() => { drag.current = null; }}
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  setSelected(null);
                  setConnectFrom(null);
                }
              }}
            >
              <defs>
                <marker id="diag-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                  <path d="M0,0 L8,4 L0,8 Z" fill="#334155" />
                </marker>
              </defs>
              {current.edges.map((edge) => {
                const from = current.nodes.find((node) => node.id === edge.from);
                const to = current.nodes.find((node) => node.id === edge.to);
                if (!from || !to) return null;
                const start = diagramBoundaryPoint(from, metrics[from.id], to.x - from.x, to.y - from.y);
                const end = diagramBoundaryPoint(to, metrics[to.id], from.x - to.x, from.y - to.y);
                const on = selected?.kind === "edge" && selected.id === edge.id;
                return (
                  <g key={edge.id} onPointerDown={(event) => { event.stopPropagation(); setSelected({ kind: "edge", id: edge.id }); }}>
                    <line x1={start.x} y1={start.y} x2={end.x} y2={end.y} stroke="transparent" strokeWidth="14" />
                    <line
                      x1={start.x}
                      y1={start.y}
                      x2={end.x}
                      y2={end.y}
                      stroke={on ? "hsl(var(--primary))" : "#334155"}
                      strokeWidth={on ? 2.6 : 1.7}
                      strokeDasharray={edge.style === "dashed" ? "7 5" : undefined}
                      markerEnd={edge.arrow === "none" ? undefined : "url(#diag-arrow)"}
                    />
                    {edge.label && (
                      <text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 8} textAnchor="middle" fontSize="10" fontWeight="700" fill="#334155">
                        {edge.label}
                      </text>
                    )}
                  </g>
                );
              })}
              {current.nodes.map((node) => (
                <g
                  key={node.id}
                  className={canEdit ? "cursor-grab" : undefined}
                  onPointerDown={(event) => {
                    if (!canEdit) return;
                    event.stopPropagation();
                    event.currentTarget.setPointerCapture(event.pointerId);
                    if (tool === "connect") {
                      if (!connectFrom) {
                        setConnectFrom(node.id);
                        setSelected({ kind: "node", id: node.id });
                        return;
                      }
                      onChange(connectDiagramNodes(current, connectFrom, node.id));
                      setConnectFrom(null);
                      setTool("select");
                      return;
                    }
                    setSelected({ kind: "node", id: node.id });
                    const point = pointOnBoard(event);
                    drag.current = { id: node.id, ox: point.x - node.x, oy: point.y - node.y };
                  }}
                >
                  <NodeGlyph node={node} metrics={metrics[node.id]} selected={selected?.kind === "node" && selected.id === node.id} />
                </g>
              ))}
            </svg>
          </div>

          {canEdit && selectedNode && (
            <div className="space-y-2 border-t border-border/40 p-3">
              <Input value={selectedNode.label} onChange={(event) => patchNode(selectedNode.id, { label: event.target.value })} placeholder="Label" />
              <div className="flex flex-wrap gap-1.5">
                {DIAGRAM_SHAPES.map((shape) => (
                  <button
                    key={shape.id}
                    type="button"
                    onClick={() => patchNode(selectedNode.id, { shape: shape.id })}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${selectedNode.shape === shape.id ? "border-primary bg-primary/10" : "border-border/50"}`}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DIAGRAM_FILLS.map((fill) => (
                  <button
                    key={fill}
                    type="button"
                    aria-label={`Fill ${fill}`}
                    onClick={() => patchNode(selectedNode.id, { fill })}
                    className={`h-6 w-6 rounded-full border ${selectedNode.fill === fill ? "border-foreground" : "border-black/10"}`}
                    style={{ background: fill }}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DIAGRAM_ICONS.map((icon) => (
                  <button
                    key={icon.id}
                    type="button"
                    onClick={() => patchNode(selectedNode.id, { icon: icon.id })}
                    className={`rounded-lg border px-2 py-1 text-[10px] font-semibold ${selectedNode.icon === icon.id || (!selectedNode.icon && icon.id === "none") ? "border-primary bg-primary/10" : "border-border/50"}`}
                  >
                    {icon.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {canEdit && selectedEdge && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 p-3">
              <Input
                value={selectedEdge.label ?? ""}
                onChange={(event) => patchEdge(selectedEdge.id, { label: event.target.value })}
                placeholder="Line label (Yes, PoE…)"
                className="max-w-xs"
              />
              <Button type="button" size="sm" variant="outline" onClick={() => patchEdge(selectedEdge.id, { style: selectedEdge.style === "dashed" ? "solid" : "dashed" })}>
                {selectedEdge.style === "dashed" ? "Solid line" : "Dashed line"}
              </Button>
            </div>
          )}

          {canEdit && tool === "connect" && (
            <p className="px-3 pb-3 text-[11px] text-muted-foreground">
              {connectFrom ? "Now tap the shape it should point to." : "Tap a shape, then tap the next one to draw a line."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export { DIAGRAM_TEMPLATES };

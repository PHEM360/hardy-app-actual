import { useMemo, useState } from "react";
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

function shapePath(n: NoteDiagramNode) {
  const w = n.shape === "diamond" ? 120 : n.shape === "circle" ? 72 : 128;
  const h = n.shape === "diamond" ? 72 : n.shape === "circle" ? 72 : n.shape === "oval" ? 48 : 44;
  const x = n.x - w / 2;
  const y = n.y - h / 2;
  if (n.shape === "diamond") {
    return { type: "polygon" as const, points: `${n.x},${y} ${x + w},${n.y} ${n.x},${y + h} ${x},${n.y}`, x, y, w, h };
  }
  return { type: n.shape === "circle" || n.shape === "oval" ? "ellipse" as const : "rect" as const, x, y, w, h };
}

export function DiagramCanvas({ diagram, className }: { diagram: NoteDiagram; className?: string }) {
  const height = Math.max(220, ...diagram.nodes.map((n) => n.y + 50), 0);
  const nodeMap = useMemo(() => Object.fromEntries(diagram.nodes.map((n) => [n.id, n])), [diagram.nodes]);
  return (
    <svg viewBox={`0 0 360 ${height}`} className={className ?? "w-full h-auto"} role="img">
      {diagram.edges.map((e) => {
        const a = nodeMap[e.from];
        const b = nodeMap[e.to];
        if (!a || !b) return null;
        const mx = (a.x + b.x) / 2;
        const my = (a.y + b.y) / 2;
        return (
          <g key={e.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="currentColor" strokeWidth="1.6" markerEnd="url(#arrow)" opacity="0.55" />
            {e.label && (
              <text x={mx} y={my - 6} textAnchor="middle" fontSize="10" fill="currentColor" className="opacity-70">
                {e.label}
              </text>
            )}
          </g>
        );
      })}
      <defs>
        <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" opacity="0.55" />
        </marker>
      </defs>
      {diagram.nodes.map((n) => {
        const s = shapePath(n);
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
            <text x={n.x} y={n.y + 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="currentColor">
              {n.label.slice(0, 16)}
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

import type {
  NoteDiagram,
  NoteDiagramEdge,
  NoteDiagramIcon,
  NoteDiagramNode,
  NoteDiagramShape,
} from "@/types/notes";

export function diagramId(prefix = "d") {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function emptyDiagram(): NoteDiagram {
  return { nodes: [], edges: [] };
}

export function noteHasDiagram(note: { diagram?: NoteDiagram | null; canvas?: { blocks: { type: string; diagram?: NoteDiagram | null }[] } | null }) {
  if (note.diagram?.nodes?.length) return true;
  return !!note.canvas?.blocks.some((block) => block.type === "diagram" && (block.diagram?.nodes.length ?? 0) > 0);
}

export const DIAGRAM_SHAPES: { id: NoteDiagramShape; label: string }[] = [
  { id: "box", label: "Box" },
  { id: "rounded", label: "Rounded" },
  { id: "diamond", label: "Decision" },
  { id: "oval", label: "Start / end" },
  { id: "circle", label: "Circle" },
  { id: "parallelogram", label: "Input" },
  { id: "hexagon", label: "Prepare" },
  { id: "cylinder", label: "Database" },
  { id: "cloud", label: "Cloud" },
  { id: "document", label: "Document" },
];

export const DIAGRAM_ICONS: { id: NoteDiagramIcon; label: string }[] = [
  { id: "none", label: "None" },
  { id: "router", label: "Router" },
  { id: "wifi", label: "Wi‑Fi" },
  { id: "switch", label: "Switch" },
  { id: "server", label: "Server" },
  { id: "computer", label: "Computer" },
  { id: "laptop", label: "Laptop" },
  { id: "phone", label: "Phone" },
  { id: "printer", label: "Printer" },
  { id: "camera", label: "Camera" },
  { id: "tv", label: "TV" },
  { id: "cloud", label: "Cloud" },
  { id: "database", label: "Database" },
  { id: "globe", label: "Internet" },
  { id: "shield", label: "Security" },
  { id: "home", label: "Home" },
  { id: "user", label: "Person" },
  { id: "users", label: "People" },
  { id: "harddrive", label: "Storage" },
  { id: "speaker", label: "Speaker" },
];

export const DIAGRAM_FILLS = [
  "#fffdf8",
  "#dbeafe",
  "#d1fae5",
  "#fef3c7",
  "#fce7f3",
  "#ede9fe",
  "#e2e8f0",
  "#ffedd5",
];

function n(
  label: string,
  x: number,
  y: number,
  shape: NoteDiagramShape,
  extras: Partial<NoteDiagramNode> = {},
): NoteDiagramNode {
  return { id: diagramId("n"), label, x, y, shape, ...extras };
}

function e(from: string, to: string, label?: string, extras: Partial<NoteDiagramEdge> = {}): NoteDiagramEdge {
  return { id: diagramId("e"), from, to, label, arrow: "end", ...extras };
}

export const DIAGRAM_TEMPLATES: {
  id: string;
  label: string;
  hint: string;
  group: "Flow" | "Home" | "Family";
  build: () => NoteDiagram;
}[] = [
  {
    id: "blank",
    label: "Blank canvas",
    hint: "Start from nothing and drop your own shapes.",
    group: "Flow",
    build: emptyDiagram,
  },
  {
    id: "flow",
    label: "Flowchart",
    hint: "Start, a step, then done.",
    group: "Flow",
    build: () => {
      const a = n("Start", 200, 48, "oval", { fill: "#d1fae5", w: 140, h: 48 });
      const b = n("Do the work", 200, 150, "box", { fill: "#dbeafe", w: 168, h: 56 });
      const c = n("Done", 200, 252, "oval", { fill: "#fef3c7", w: 140, h: 48 });
      return { nodes: [a, b, c], edges: [e(a.id, b.id), e(b.id, c.id)] };
    },
  },
  {
    id: "decision",
    label: "Decision",
    hint: "A question that splits yes and no.",
    group: "Flow",
    build: () => {
      const a = n("Start", 220, 40, "oval", { fill: "#d1fae5", w: 130, h: 46 });
      const b = n("Is it ready?", 220, 140, "diamond", { fill: "#fef3c7", w: 170, h: 90 });
      const c = n("Yes — continue", 90, 270, "box", { fill: "#d1fae5", w: 150, h: 52 });
      const d = n("No — fix it", 350, 270, "box", { fill: "#ffedd5", w: 150, h: 52 });
      return { nodes: [a, b, c, d], edges: [e(a.id, b.id), e(b.id, c.id, "Yes"), e(b.id, d.id, "No")] };
    },
  },
  {
    id: "process",
    label: "Process",
    hint: "Three numbered stages in a line.",
    group: "Flow",
    build: () => {
      const a = n("1. Plan", 90, 140, "circle", { fill: "#dbeafe", w: 88, h: 88 });
      const b = n("2. Do", 240, 140, "circle", { fill: "#ede9fe", w: 88, h: 88 });
      const c = n("3. Review", 390, 140, "circle", { fill: "#d1fae5", w: 88, h: 88 });
      return { nodes: [a, b, c], edges: [e(a.id, b.id), e(b.id, c.id)] };
    },
  },
  {
    id: "swim",
    label: "Handover",
    hint: "Who does what, in order.",
    group: "Flow",
    build: () => {
      const a = n("Chris starts", 110, 80, "box", { fill: "#dbeafe", icon: "user", w: 150, h: 58 });
      const b = n("Hand to family", 320, 80, "parallelogram", { fill: "#fef3c7", w: 160, h: 58 });
      const c = n("Done together", 530, 80, "oval", { fill: "#d1fae5", icon: "users", w: 150, h: 54 });
      return { nodes: [a, b, c], edges: [e(a.id, b.id), e(b.id, c.id)] };
    },
  },
  {
    id: "org",
    label: "Family tree",
    hint: "People under a household.",
    group: "Family",
    build: () => {
      const home = n("Hardy home", 280, 50, "box", { fill: "#ffedd5", icon: "home", w: 160, h: 56 });
      const a = n("Adults", 140, 170, "rounded", { fill: "#dbeafe", icon: "users", w: 140, h: 54 });
      const b = n("Kids", 280, 170, "rounded", { fill: "#fce7f3", icon: "user", w: 140, h: 54 });
      const c = n("Pets", 420, 170, "rounded", { fill: "#d1fae5", icon: "home", w: 140, h: 54 });
      return { nodes: [home, a, b, c], edges: [e(home.id, a.id), e(home.id, b.id), e(home.id, c.id)] };
    },
  },
  {
    id: "network",
    label: "Home network",
    hint: "Internet, router, Wi‑Fi, rooms and gadgets.",
    group: "Home",
    build: () => {
      const net = n("Internet", 360, 42, "cloud", { fill: "#dbeafe", icon: "globe", w: 170, h: 70 });
      const router = n("Router", 360, 150, "box", { fill: "#ede9fe", icon: "router", w: 150, h: 56 });
      const wifi = n("Wi‑Fi", 150, 270, "circle", { fill: "#d1fae5", icon: "wifi", w: 96, h: 96 });
      const sw = n("Switch", 360, 270, "box", { fill: "#fef3c7", icon: "switch", w: 140, h: 54 });
      const nas = n("NAS", 560, 270, "cylinder", { fill: "#e2e8f0", icon: "harddrive", w: 110, h: 78 });
      const laptop = n("Laptop", 70, 400, "rounded", { fill: "#dbeafe", icon: "laptop", w: 130, h: 52 });
      const phone = n("Phones", 210, 400, "oval", { fill: "#fce7f3", icon: "phone", w: 120, h: 50 });
      const office = n("Office PC", 360, 400, "box", { fill: "#dbeafe", icon: "computer", w: 130, h: 52 });
      const lounge = n("Lounge TV", 500, 400, "box", { fill: "#ffedd5", icon: "tv", w: 130, h: 52 });
      const print = n("Printer", 640, 400, "document", { fill: "#fffdf8", icon: "printer", w: 120, h: 58 });
      const cam = n("Cameras", 560, 150, "box", { fill: "#e2e8f0", icon: "camera", w: 130, h: 52 });
      return {
        nodes: [net, router, wifi, sw, nas, laptop, phone, office, lounge, print, cam],
        edges: [
          e(net.id, router.id),
          e(router.id, wifi.id),
          e(router.id, sw.id),
          e(router.id, nas.id),
          e(router.id, cam.id, "PoE"),
          e(wifi.id, laptop.id),
          e(wifi.id, phone.id),
          e(sw.id, office.id),
          e(sw.id, lounge.id),
          e(sw.id, print.id),
        ],
      };
    },
  },
  {
    id: "smarthome",
    label: "Smart home",
    hint: "Hub in the middle, rooms around it.",
    group: "Home",
    build: () => {
      const hub = n("Home hub", 300, 180, "hexagon", { fill: "#ede9fe", icon: "home", w: 140, h: 90 });
      const lights = n("Lights", 90, 70, "rounded", { fill: "#fef3c7", w: 120, h: 50 });
      const locks = n("Locks", 300, 50, "rounded", { fill: "#dbeafe", icon: "shield", w: 120, h: 50 });
      const heat = n("Heating", 510, 70, "rounded", { fill: "#ffedd5", w: 120, h: 50 });
      const cams = n("Cameras", 90, 300, "box", { fill: "#e2e8f0", icon: "camera", w: 120, h: 50 });
      const sound = n("Speakers", 510, 300, "oval", { fill: "#fce7f3", icon: "speaker", w: 130, h: 50 });
      return {
        nodes: [hub, lights, locks, heat, cams, sound],
        edges: [e(hub.id, lights.id), e(hub.id, locks.id), e(hub.id, heat.id), e(hub.id, cams.id), e(hub.id, sound.id)],
      };
    },
  },
  {
    id: "morning",
    label: "Morning routine",
    hint: "A simple family workflow.",
    group: "Family",
    build: () => {
      const a = n("Wake up", 90, 90, "oval", { fill: "#fef3c7", w: 130, h: 48 });
      const b = n("School bags", 280, 90, "box", { fill: "#dbeafe", w: 140, h: 52 });
      const c = n("Pets fed?", 470, 90, "diamond", { fill: "#fce7f3", w: 150, h: 80 });
      const d = n("Feed pets", 380, 220, "box", { fill: "#ffedd5", w: 130, h: 50 });
      const e1 = n("Leave house", 560, 220, "oval", { fill: "#d1fae5", w: 140, h: 48 });
      return { nodes: [a, b, c, d, e1], edges: [e(a.id, b.id), e(b.id, c.id), e(c.id, d.id, "No"), e(c.id, e1.id, "Yes"), e(d.id, e1.id)] };
    },
  },
];

export function wrapDiagramLabel(label: string, maxCharacters: number) {
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

export type DiagramNodeMetrics = {
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
};

export function diagramNodeMetrics(node: NoteDiagramNode): DiagramNodeMetrics {
  const tight = node.shape === "diamond" || node.shape === "circle" || node.shape === "hexagon";
  const lines = wrapDiagramLabel(node.label, tight ? 14 : 20);
  const textWidth = Math.max(...lines.map((line) => line.length), 1) * 6.6;
  const textHeight = Math.max(lines.length, 1) * 14 + (node.icon && node.icon !== "none" ? 18 : 0);
  let w = node.w ?? Math.max(node.shape === "circle" ? 72 : 128, textWidth + 32);
  let h = node.h ?? Math.max(node.shape === "diamond" ? 78 : node.shape === "circle" ? 72 : node.shape === "oval" ? 48 : 48, textHeight + 22);
  if (node.shape === "diamond") {
    w = Math.max(w, textWidth + 70);
    h = Math.max(h, textHeight + 46);
  } else if (node.shape === "circle") {
    w = h = Math.max(w, h);
  }
  return { x: node.x - w / 2, y: node.y - h / 2, w, h, lines };
}

export function diagramBoundaryPoint(node: NoteDiagramNode, metrics: DiagramNodeMetrics, dx: number, dy: number) {
  if (dx === 0 && dy === 0) return { x: node.x, y: node.y };
  const rx = metrics.w / 2;
  const ry = metrics.h / 2;
  let scale: number;
  if (node.shape === "circle" || node.shape === "oval" || node.shape === "cloud") {
    scale = 1 / Math.sqrt((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry));
  } else if (node.shape === "diamond" || node.shape === "hexagon") {
    scale = 1 / (Math.abs(dx) / rx + Math.abs(dy) / ry);
  } else {
    scale = 1 / Math.max(Math.abs(dx) / rx, Math.abs(dy) / ry);
  }
  return { x: node.x + dx * scale, y: node.y + dy * scale };
}

export function addDiagramNode(
  diagram: NoteDiagram,
  shape: NoteDiagramShape,
  at?: { x: number; y: number },
  extras: Partial<NoteDiagramNode> = {},
): NoteDiagram {
  const index = diagram.nodes.length;
  return {
    ...diagram,
    nodes: [
      ...diagram.nodes,
      {
        id: diagramId("n"),
        label: extras.label ?? DIAGRAM_SHAPES.find((item) => item.id === shape)?.label ?? "Shape",
        x: at?.x ?? 160 + (index % 4) * 40,
        y: at?.y ?? 120 + (index % 3) * 36,
        shape,
        fill: extras.fill ?? "#fffdf8",
        w: extras.w ?? (shape === "circle" ? 84 : 140),
        h: extras.h ?? (shape === "circle" ? 84 : shape === "diamond" ? 86 : 54),
        icon: extras.icon ?? "none",
      },
    ],
  };
}

export function connectDiagramNodes(diagram: NoteDiagram, from: string, to: string, label?: string): NoteDiagram {
  if (!from || !to || from === to) return diagram;
  if (diagram.edges.some((edge) => edge.from === from && edge.to === to)) return diagram;
  return { ...diagram, edges: [...diagram.edges, e(from, to, label)] };
}

export function removeDiagramSelection(diagram: NoteDiagram, kind: "node" | "edge", id: string): NoteDiagram {
  if (kind === "edge") return { ...diagram, edges: diagram.edges.filter((edge) => edge.id !== id) };
  return {
    nodes: diagram.nodes.filter((node) => node.id !== id),
    edges: diagram.edges.filter((edge) => edge.from !== id && edge.to !== id),
  };
}

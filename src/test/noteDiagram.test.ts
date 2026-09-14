import { describe, expect, it } from "vitest";
import {
  DIAGRAM_TEMPLATES,
  addDiagramNode,
  connectDiagramNodes,
  diagramNodeMetrics,
  emptyDiagram,
  noteHasDiagram,
  removeDiagramSelection,
} from "@/lib/noteDiagram";

describe("note diagrams", () => {
  it("includes a home network template with the usual kit", () => {
    const network = DIAGRAM_TEMPLATES.find((item) => item.id === "network")?.build();
    expect(network).toBeTruthy();
    const labels = network!.nodes.map((node) => node.label);
    expect(labels).toEqual(expect.arrayContaining(["Internet", "Router", "Wi‑Fi", "Switch", "Office PC", "Lounge TV"]));
    expect(network!.edges.length).toBeGreaterThanOrEqual(6);
  });

  it("lets a blank board grow by adding and linking shapes", () => {
    let diagram = emptyDiagram();
    diagram = addDiagramNode(diagram, "box", { x: 80, y: 80 }, { label: "Router" });
    diagram = addDiagramNode(diagram, "cloud", { x: 200, y: 80 }, { label: "Internet" });
    const [from, to] = diagram.nodes;
    diagram = connectDiagramNodes(diagram, from.id, to.id, "WAN");
    expect(diagram.edges).toHaveLength(1);
    expect(diagram.edges[0].label).toBe("WAN");
    diagram = removeDiagramSelection(diagram, "node", from.id);
    expect(diagram.nodes).toHaveLength(1);
    expect(diagram.edges).toHaveLength(0);
  });

  it("sizes labelled nodes so cards and the board share the same geometry", () => {
    const metrics = diagramNodeMetrics({ id: "n", label: "Router", x: 100, y: 40, shape: "box", w: 150, h: 56 });
    expect(metrics.w).toBe(150);
    expect(metrics.x).toBe(25);
    expect(noteHasDiagram({ diagram: { nodes: [{ id: "n", label: "A", x: 0, y: 0, shape: "box" }], edges: [] } })).toBe(true);
    expect(noteHasDiagram({ diagram: null, canvas: { blocks: [] } })).toBe(false);
  });
});

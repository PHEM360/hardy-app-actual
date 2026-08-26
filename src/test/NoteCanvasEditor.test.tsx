import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { PaperNoteCanvasEditor } from "@/components/notes/PaperNoteCanvasEditor";
import type { NoteCanvas } from "@/types/notes";

const emptyCanvas: NoteCanvas = { version: 1, height: 520, blocks: [] };

describe("NoteCanvasEditor", () => {
  beforeAll(() => {
    vi.stubGlobal("PointerEvent", MouseEvent);
  });

  it("starts blank and inserts a text block only when requested", () => {
    const onChange = vi.fn();
    render(
      <PaperNoteCanvasEditor
        canvas={emptyCanvas}
        canEdit
        ownerId="owner"
        noteId="note"
        onChange={onChange}
      />,
    );

    expect(screen.getByText("Your blank note")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Text" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      blocks: [expect.objectContaining({ type: "text", text: "" })],
    }));
  });

  it("does not show insert controls to read-only viewers", () => {
    render(
      <PaperNoteCanvasEditor
        canvas={emptyCanvas}
        canEdit={false}
        ownerId="owner"
        noteId="note"
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Text" })).not.toBeInTheDocument();
  });

  it("creates a shape at the size dragged on the paper", () => {
    const onChange = vi.fn();
    render(
      <PaperNoteCanvasEditor
        canvas={emptyCanvas}
        canEdit
        ownerId="owner"
        noteId="note"
        onChange={onChange}
      />,
    );
    const paper = screen.getByTestId("note-paper");
    vi.spyOn(paper, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 700, bottom: 560, width: 700, height: 560, toJSON: () => ({}),
    });
    fireEvent.click(screen.getByRole("button", { name: "Choose a shape" }));
    fireEvent.click(screen.getByRole("button", { name: "Rectangle" }));
    fireEvent.pointerDown(paper, { pointerId: 1, clientX: 40, clientY: 60 });
    fireEvent.pointerMove(paper, { pointerId: 1, clientX: 240, clientY: 180 });
    fireEvent.pointerUp(paper, { pointerId: 1, clientX: 240, clientY: 180 });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      blocks: [expect.objectContaining({ type: "shape", shape: "rectangle", x: 40, y: 60, width: 200, height: 120 })],
    }));
  });

  it("records freehand strokes directly on the paper", () => {
    const onChange = vi.fn();
    render(<PaperNoteCanvasEditor canvas={emptyCanvas} canEdit ownerId="owner" noteId="note" onChange={onChange} />);
    const paper = screen.getByTestId("note-paper");
    vi.spyOn(paper, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, top: 0, left: 0, right: 700, bottom: 560, width: 700, height: 560, toJSON: () => ({}),
    });
    fireEvent.click(screen.getByRole("button", { name: "Draw" }));
    fireEvent.pointerDown(paper, { pointerId: 1, clientX: 25, clientY: 35 });
    fireEvent.pointerMove(paper, { pointerId: 1, clientX: 55, clientY: 75 });
    fireEvent.pointerUp(paper, { pointerId: 1, clientX: 55, clientY: 75 });

    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      blocks: [expect.objectContaining({ id: "paper-ink", type: "drawing", paths: ["M25,35 L55,75"] })],
    }));
  });

  it("adds diagrams and checklists onto the paper rather than below it", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PaperNoteCanvasEditor canvas={emptyCanvas} canEdit ownerId="owner" noteId="note" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Checklist" }));
    const withChecklist = onChange.mock.calls.at(-1)?.[0] as NoteCanvas;
    expect(withChecklist.blocks[0]).toEqual(expect.objectContaining({ type: "checklist" }));

    rerender(<PaperNoteCanvasEditor canvas={withChecklist} canEdit ownerId="owner" noteId="note" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Diagram" }));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({
      blocks: expect.arrayContaining([expect.objectContaining({ type: "diagram" })]),
    }));
  });

  it("places the current location as an embedded map on the paper", () => {
    const onChange = vi.fn();
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success: PositionCallback) => success({
          coords: { latitude: 51.5074, longitude: -0.1278 },
        } as GeolocationPosition),
      },
    });
    const { rerender } = render(<PaperNoteCanvasEditor canvas={emptyCanvas} canEdit ownerId="owner" noteId="note" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Map" }));
    const withMap = onChange.mock.calls.at(-1)?.[0] as NoteCanvas;
    expect(withMap.blocks[0]).toEqual(expect.objectContaining({ type: "location", latitude: 51.5074, longitude: -0.1278 }));

    rerender(<PaperNoteCanvasEditor canvas={withMap} canEdit ownerId="owner" noteId="note" onChange={onChange} />);
    expect(screen.getByTitle("Saved location")).toHaveAttribute("src", expect.stringContaining("openstreetmap.org"));
  });

  it("moves to a new checklist item when Enter is pressed", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PaperNoteCanvasEditor canvas={emptyCanvas} canEdit ownerId="owner" noteId="note" onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Checklist" }));
    const withChecklist = onChange.mock.calls.at(-1)?.[0] as NoteCanvas;
    rerender(<PaperNoteCanvasEditor canvas={withChecklist} canEdit ownerId="owner" noteId="note" onChange={onChange} />);

    const firstItem = screen.getByPlaceholderText("List item");
    fireEvent.change(firstItem, { target: { value: "Milk" } });
    const typed = onChange.mock.calls.at(-1)?.[0] as NoteCanvas;
    rerender(<PaperNoteCanvasEditor canvas={typed} canEdit ownerId="owner" noteId="note" onChange={onChange} />);

    fireEvent.keyDown(screen.getByDisplayValue("Milk"), { key: "Enter" });
    const afterEnter = onChange.mock.calls.at(-1)?.[0] as NoteCanvas;
    const checklist = afterEnter.blocks.find((block) => block.type === "checklist");
    expect(checklist).toEqual(expect.objectContaining({
      items: [expect.objectContaining({ text: "Milk" }), expect.objectContaining({ text: "" })],
    }));

    rerender(<PaperNoteCanvasEditor canvas={afterEnter} canEdit ownerId="owner" noteId="note" onChange={onChange} />);
    const items = screen.getAllByPlaceholderText("List item");
    expect(items).toHaveLength(2);
    expect(items[1]).toHaveFocus();
  });
});

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteCanvasEditor } from "@/components/notes/NoteCanvasEditor";
import type { NoteCanvas } from "@/types/notes";

const emptyCanvas: NoteCanvas = { version: 1, height: 520, blocks: [] };

describe("NoteCanvasEditor", () => {
  it("starts blank and inserts a text block only when requested", () => {
    const onChange = vi.fn();
    render(
      <NoteCanvasEditor
        canvas={emptyCanvas}
        canEdit
        ownerId="owner"
        noteId="note"
        onChange={onChange}
        onAddChecklist={vi.fn()}
        onAddDiagram={vi.fn()}
      />,
    );

    expect(screen.getByText("A blank canvas")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Text" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({
      blocks: [expect.objectContaining({ type: "text", text: "" })],
    }));
  });

  it("does not show insert controls to read-only viewers", () => {
    render(
      <NoteCanvasEditor
        canvas={emptyCanvas}
        canEdit={false}
        ownerId="owner"
        noteId="note"
        onChange={vi.fn()}
        onAddChecklist={vi.fn()}
        onAddDiagram={vi.fn()}
      />,
    );

    expect(screen.queryByText("Insert")).not.toBeInTheDocument();
  });
});

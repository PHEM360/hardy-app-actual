import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteStartDialog } from "@/components/notes/NoteStartDialog";

describe("NoteStartDialog", () => {
  it("asks for a title before starting a checklist", () => {
    const onPick = vi.fn();
    render(<NoteStartDialog open onOpenChange={vi.fn()} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Checklist/i }));
    expect(onPick).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Note title"), { target: { value: "Weekend jobs" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onPick).toHaveBeenCalledWith({ kind: "checklist", title: "Weekend jobs" });
  });

  it("starts a blank note without asking for a title", () => {
    const onPick = vi.fn();
    render(<NoteStartDialog open onOpenChange={vi.fn()} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /^Note/i }));
    expect(onPick).toHaveBeenCalledWith({ kind: "note" });
  });

  it("shows diagram templates including the home network", () => {
    const onPick = vi.fn();
    render(<NoteStartDialog open onOpenChange={vi.fn()} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Diagram/i }));
    expect(screen.getByText("Home network")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Home network/i }));
    fireEvent.change(screen.getByLabelText("Note title"), { target: { value: "House wifi" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({
      kind: "note",
      title: "House wifi",
      diagram: expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ label: "Router" })]),
      }),
    }));
  });
});

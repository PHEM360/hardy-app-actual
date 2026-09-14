import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteStartDialog } from "@/components/notes/NoteStartDialog";

describe("NoteStartDialog", () => {
  it("lets you start a checklist without extra steps", () => {
    const onPick = vi.fn();
    render(<NoteStartDialog open onOpenChange={vi.fn()} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Checklist/i }));
    expect(onPick).toHaveBeenCalledWith({ kind: "checklist" });
  });

  it("shows diagram templates including the home network", () => {
    const onPick = vi.fn();
    render(<NoteStartDialog open onOpenChange={vi.fn()} onPick={onPick} />);
    fireEvent.click(screen.getByRole("button", { name: /Diagram/i }));
    expect(screen.getByText("Home network")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Home network/i }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({
      kind: "note",
      diagram: expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ label: "Router" })]),
      }),
    }));
  });
});

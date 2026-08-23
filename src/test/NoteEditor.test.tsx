import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NoteEditor } from "@/components/notes/NoteEditor";

function renderEditor(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(
    <NoteEditor
      open
      onOpenChange={vi.fn()}
      note={null}
      folders={[{ id: "work", ownerId: "owner", name: "Work", color: "#93c5fd", sortOrder: 0, sharedWith: [] }]}
      canEdit
      isOwn
      onSave={onSave}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      onShare={vi.fn()}
      onMoveVault={vi.fn().mockResolvedValue(undefined)}
      onLeaveVault={vi.fn().mockResolvedValue(undefined)}
      onAddToHubCalendar={vi.fn().mockResolvedValue(undefined)}
      ownerId="owner"
      noteId="new-note"
    />,
  );
  return onSave;
}

describe("NoteEditor paper layout", () => {
  it("defaults to general notes and hides optional filing fields", () => {
    renderEditor();
    expect(screen.getByText("General notes · Personal")).toBeInTheDocument();
    expect(screen.queryByText("Save to tab")).not.toBeInTheDocument();
    expect(screen.getByTestId("note-paper")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Note details/ }));
    expect(screen.getByText("Save to tab")).toBeInTheDocument();
    expect(screen.getByText("Save in")).toBeInTheDocument();
    expect(screen.getByText("Category")).toBeInTheDocument();
  });

  it("saves an on-paper checklist through the legacy-compatible fields", async () => {
    const onSave = renderEditor();
    fireEvent.change(screen.getByPlaceholderText("Title"), { target: { value: "Weekend jobs" } });
    fireEvent.click(screen.getByRole("button", { name: "Checklist" }));
    fireEvent.change(screen.getByPlaceholderText("List item"), { target: { value: "Clean kitchen" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Weekend jobs",
      checklist: [expect.objectContaining({ text: "Clean kitchen" })],
      canvas: expect.objectContaining({
        blocks: expect.arrayContaining([expect.objectContaining({ type: "checklist" })]),
      }),
    })));
  });
});

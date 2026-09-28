import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import { NoteEditor } from "@/components/notes/NoteEditor";
import type { HubNote } from "@/types/notes";

const folders = [{ id: "work", ownerId: "owner", name: "Work", color: "#93c5fd", sortOrder: 0, sharedWith: [] }];

function renderEditor(onSave = vi.fn().mockResolvedValue(undefined), extra: Partial<ComponentProps<typeof NoteEditor>> = {}) {
  render(
    <NoteEditor
      open
      onOpenChange={vi.fn()}
      note={null}
      folders={folders}
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
      {...extra}
    />,
  );
  return onSave;
}

const savedNote: HubNote = {
  id: "n1",
  ownerId: "owner",
  folderId: null,
  kind: "note",
  title: "Shopping",
  body: "Milk",
  color: "yellow",
  category: "personal",
  pinned: false,
  archived: false,
  tags: [],
  checklist: [],
  locked: false,
  vault: false,
  sharedWith: [],
  canvas: {
    version: 1,
    height: 520,
    blocks: [{ id: "t1", type: "text", x: 18, y: 18, width: 300, height: 180, text: "Milk", textStyle: "body" }],
  },
};

describe("NoteEditor paper layout", () => {
  it("keeps colour and filing extras behind Options on a new note", async () => {
    renderEditor();
    expect(screen.queryByText("General notes · Personal")).not.toBeInTheDocument();
    expect(screen.queryByText("Save to tab")).not.toBeInTheDocument();
    expect(screen.getByTestId("note-paper")).toBeInTheDocument();
    expect(screen.getByText("Your blank note")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("note-paper"), { clientX: 40, clientY: 50 });
    expect(await screen.findByPlaceholderText("Start typing…")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Options/ }));
    fireEvent.click(screen.getByRole("button", { name: /Note details/ }));
    expect(screen.getByText("General notes · Personal")).toBeInTheDocument();
    expect(screen.getByText("Save to tab")).toBeInTheDocument();
    expect(screen.getByText("Save in")).toBeInTheDocument();
    expect(screen.getByText("Personal")).toBeInTheDocument();
  });

  it("opens an existing note in view mode until Edit is pressed", () => {
    renderEditor(vi.fn().mockResolvedValue(undefined), { note: savedNote, noteId: "n1" });
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Options/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Checklist" })).not.toBeInTheDocument();
    expect(screen.getByText("Shopping")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Edit/ }));
    expect(screen.getByRole("button", { name: /Options/ })).toBeInTheDocument();
  });

  it("saves an on-paper checklist through the legacy-compatible fields", async () => {
    const onSave = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Options/ }));
    fireEvent.change(screen.getByPlaceholderText("Title (optional)"), { target: { value: "Weekend jobs" } });
    fireEvent.click(screen.getByRole("button", { name: "Checklist" }));
    fireEvent.change(screen.getByPlaceholderText("List item"), { target: { value: "Clean kitchen" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: "Weekend jobs",
      checklist: [expect.objectContaining({ text: "Clean kitchen" })],
      canvas: expect.objectContaining({
        blocks: expect.arrayContaining([expect.objectContaining({ type: "checklist" })]),
      }),
    }), expect.objectContaining({ showOnDashboard: false })));
  });

  it("names a blank note from the first line of paper", async () => {
    const onSave = renderEditor();
    fireEvent.click(screen.getByTestId("note-paper"), { clientX: 40, clientY: 50 });
    fireEvent.change(await screen.findByPlaceholderText("Start typing…"), { target: { value: "Buy milk\nAnd bread" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Buy milk", body: "Buy milk\nAnd bread" }),
      expect.anything(),
    ));
  });

  it("opens a diagram board when a template is passed in", () => {
    renderEditor(vi.fn().mockResolvedValue(undefined), {
      noteId: "new-diagram",
      initialDiagram: {
        nodes: [{ id: "a", label: "Router", x: 80, y: 60, shape: "box" }],
        edges: [],
      },
    });
    expect(screen.getByText("New diagram")).toBeInTheDocument();
    expect(screen.getByLabelText("Diagram board")).toBeInTheDocument();
    expect(screen.getByText("Router")).toBeInTheDocument();
  });

  it("saves show-on-dashboard when the switch is on", async () => {
    const onSave = renderEditor();
    fireEvent.click(screen.getByRole("button", { name: /Options/ }));
    fireEvent.change(screen.getByPlaceholderText("Title (optional)"), { target: { value: "Milk" } });
    fireEvent.click(screen.getByRole("switch", { name: "Show on dashboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Milk" }),
      expect.objectContaining({ showOnDashboard: true }),
    ));
  });

  it("lets you tick a checklist in the expanded view without entering Edit", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const checklistNote: HubNote = {
      ...savedNote,
      id: "list-1",
      kind: "checklist",
      title: "Jobs",
      body: "",
      checklist: [{ id: "i1", text: "Milk", done: false }],
      canvas: {
        version: 1,
        height: 520,
        blocks: [{
          id: "c1",
          type: "checklist",
          x: 28,
          y: 28,
          width: 330,
          height: 210,
          title: "Jobs",
          items: [{ id: "i1", text: "Milk", done: false }],
        }],
      },
    };
    renderEditor(onSave, { note: checklistNote, noteId: "list-1" });
    expect(screen.getByRole("button", { name: /Edit/ })).toBeInTheDocument();
    const box = screen.getByRole("checkbox");
    expect(box).not.toBeDisabled();
    fireEvent.click(box);
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      checklist: [expect.objectContaining({ id: "i1", done: true })],
    })));
  });
});

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NotesWidget } from "@/components/widgets/NotesWidget";
import type { HubNote } from "@/types/notes";

const state = vi.hoisted(() => {
  const shopping: HubNote = {
    id: "milk",
    ownerId: "owner",
    folderId: null,
    kind: "checklist",
    title: "Weekend shop",
    body: "Don't forget the dog food",
    color: "yellow",
    category: "shopping",
    pinned: false,
    archived: false,
    tags: [],
    checklist: [
      { id: "a", text: "Milk", done: false },
      { id: "b", text: "Eggs", done: true },
    ],
    locked: false,
    vault: false,
    sharedWith: [],
  };
  return {
    dashboardNoteId: "milk" as string | null,
    shopping,
    other: {
      ...shopping,
      id: "other",
      title: "Other note",
      body: "",
      checklist: [],
      pinned: true,
    } satisfies HubNote,
  };
});

vi.mock("@/hooks/useNotes", () => ({
  useNotes: () => ({
    notes: [state.shopping, state.other],
    loading: false,
    prefs: { dashboardNoteId: state.dashboardNoteId },
  }),
}));

function SearchProbe() {
  const loc = useLocation();
  return <span data-testid="search">{loc.search}</span>;
}

describe("NotesWidget", () => {
  it("shows the featured dashboard note instead of the notes list", () => {
    state.dashboardNoteId = "milk";
    render(
      <MemoryRouter>
        <NotesWidget />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("dashboard-note")).toBeInTheDocument();
    expect(screen.getByText("Weekend shop")).toBeInTheDocument();
    expect(screen.getByText("Don't forget the dog food")).toBeInTheDocument();
    expect(screen.getByText("Milk")).toBeInTheDocument();
    expect(screen.queryByText("Other note")).not.toBeInTheDocument();
  });

  it("opens that note from the dashboard widget", () => {
    state.dashboardNoteId = "milk";
    render(
      <MemoryRouter>
        <SearchProbe />
        <NotesWidget />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByTestId("dashboard-note"));
    expect(screen.getByTestId("search")).toHaveTextContent("note=milk");
  });
});

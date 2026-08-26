import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT,
  pinNotesWidgetFirst,
  unpinNotesWidget,
  isNotesPinnedFirst,
  DASHBOARD_NOTE_WIDGET_H,
} from "@/hooks/useDashboardLayout";

describe("pinNotesWidgetFirst", () => {
  it("places the notes widget full-width at the top and shifts the rest down", () => {
    const next = pinNotesWidgetFirst(DEFAULT_LAYOUT);
    const notes = next.find((w) => w.id === "notes")!;
    const greeting = next.find((w) => w.id === "greeting")!;

    expect(notes.visible).toBe(true);
    expect(notes.y).toBe(0);
    expect(notes.wFrac).toBe(1);
    expect(notes.h).toBe(DASHBOARD_NOTE_WIDGET_H);
    expect(greeting.y).toBeGreaterThanOrEqual(DASHBOARD_NOTE_WIDGET_H);
    expect(isNotesPinnedFirst(next)).toBe(true);
  });

  it("does not keep stacking widgets if notes is already first", () => {
    const pinned = pinNotesWidgetFirst(DEFAULT_LAYOUT);
    const greetingY = pinned.find((w) => w.id === "greeting")!.y;
    const again = pinNotesWidgetFirst(pinned);
    expect(again.find((w) => w.id === "greeting")!.y).toBe(greetingY);
    expect(again.find((w) => w.id === "notes")!.y).toBe(0);
  });

  it("hides notes and pulls greeting back up when unpinned", () => {
    const pinned = pinNotesWidgetFirst(DEFAULT_LAYOUT);
    const unpinned = unpinNotesWidget(pinned);
    const notes = unpinned.find((w) => w.id === "notes")!;
    const greeting = unpinned.find((w) => w.id === "greeting")!;

    expect(notes.visible).toBe(false);
    expect(greeting.y).toBe(0);
    expect(isNotesPinnedFirst(unpinned)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  PAGE_PRESETS,
  activeDisplayPages,
  applyPageLayout,
  createDisplayWidget,
  durationLabel,
  isPageActiveAt,
  layoutSlots,
  stripUndefined,
  type DisplayPage,
} from "@/lib/displayPages";

function page(overrides: Partial<DisplayPage>): DisplayPage {
  return {
    id: "page",
    name: "Page",
    durationSeconds: 300,
    background: "#09090b",
    layout: "full",
    widgets: [],
    ...overrides,
  };
}

describe("display page layouts", () => {
  it("snaps widgets onto the chosen layout so the editor matches the screen", () => {
    const snapped = applyPageLayout(page({
      layout: "halves",
      widgets: [
        { id: "a", type: "photos", x: 3, y: 7, w: 2, h: 2 },
        { id: "b", type: "tasks", x: 9, y: 1, w: 5, h: 5 },
      ],
    }));
    expect(snapped.widgets.map(({ x, y, w, h }) => ({ x, y, w, h }))).toEqual(layoutSlots("halves"));
  });

  it("drops widgets that no longer fit after switching to a smaller layout", () => {
    const snapped = applyPageLayout(page({
      layout: "full",
      widgets: [
        { id: "a", type: "clock", x: 0, y: 0, w: 6, h: 12 },
        { id: "b", type: "tasks", x: 6, y: 0, w: 6, h: 12 },
      ],
    }));
    expect(snapped.widgets).toHaveLength(1);
    expect(snapped.widgets[0].w).toBe(12);
  });

  it("resizes the areas of a split layout without leaving gaps", () => {
    const wide = applyPageLayout(page({
      layout: "halves",
      splitRatio: 0.75,
      widgets: [
        { id: "a", type: "calendar", x: 0, y: 0, w: 6, h: 12 },
        { id: "b", type: "tasks", x: 6, y: 0, w: 6, h: 12 },
      ],
    }));
    expect(wide.widgets[0]).toMatchObject({ x: 0, w: 9 });
    expect(wide.widgets[1]).toMatchObject({ x: 9, w: 3 });
  });

  it("keeps an area big enough to be useful however far it is dragged", () => {
    expect(layoutSlots("stack", 0.01)[0].h).toBe(3);
    expect(layoutSlots("stack", 4)[0].h).toBe(9);
  });

  it("infers a layout for pages built before layouts existed", () => {
    const legacy = applyPageLayout({
      id: "legacy",
      name: "Legacy",
      durationSeconds: 30,
      background: "#000",
      widgets: [
        { id: "a", type: "clock", x: 1, y: 1, w: 4, h: 4 },
        { id: "b", type: "tasks", x: 7, y: 2, w: 4, h: 4 },
      ],
    });
    expect(legacy.layout).toBe("halves");
  });
});

describe("display page scheduling", () => {
  const nightClock = page({ id: "clock", name: "Clock", activeFrom: "21:00", activeTo: "06:00" });
  const dayPage = page({ id: "today", name: "Today", activeFrom: "06:00", activeTo: "21:00" });

  it("runs an overnight window through midnight", () => {
    expect(isPageActiveAt(nightClock, new Date("2026-08-23T22:30:00"))).toBe(true);
    expect(isPageActiveAt(nightClock, new Date("2026-08-24T02:00:00"))).toBe(true);
    expect(isPageActiveAt(nightClock, new Date("2026-08-24T10:00:00"))).toBe(false);
  });

  it("shows only the pages due at that time of day", () => {
    const pages = [nightClock, dayPage];
    expect(activeDisplayPages(pages, new Date("2026-08-23T23:15:00")).map((item) => item.id)).toEqual(["clock"]);
    expect(activeDisplayPages(pages, new Date("2026-08-23T09:15:00")).map((item) => item.id)).toEqual(["today"]);
  });

  it("treats a page with no window as always available", () => {
    expect(isPageActiveAt(page({}), new Date("2026-08-23T03:00:00"))).toBe(true);
  });

  it("never leaves a screen blank when no window matches", () => {
    const gap = [page({ id: "one", activeFrom: "09:00", activeTo: "10:00" })];
    expect(activeDisplayPages(gap, new Date("2026-08-23T23:00:00"))).toHaveLength(1);
  });
});

describe("display page presets", () => {
  it("builds a full-screen month calendar", () => {
    const built = PAGE_PRESETS.find((preset) => preset.id === "month-calendar")!.build();
    expect(built.widgets).toHaveLength(1);
    expect(built.widgets[0]).toMatchObject({ type: "calendar", calendarView: "month", w: 12, h: 12 });
  });

  it("builds a night clock that only runs overnight", () => {
    const built = PAGE_PRESETS.find((preset) => preset.id === "clock")!.build();
    expect(isPageActiveAt(built, new Date("2026-08-23T23:00:00"))).toBe(true);
    expect(isPageActiveAt(built, new Date("2026-08-23T12:00:00"))).toBe(false);
  });

  it("alternates photos with the task list side by side", () => {
    const built = PAGE_PRESETS.find((preset) => preset.id === "photos-tasks")!.build();
    expect(built.widgets.map((widget) => widget.type)).toEqual(["photos", "tasks"]);
    expect(built.durationSeconds).toBe(300);
  });

  it("gives every widget field a value so Firestore never sees undefined", () => {
    const widget = createDisplayWidget("clock");
    expect(Object.values(widget).some((value) => value === undefined)).toBe(false);
    expect(stripUndefined([{ keep: 1, drop: undefined, nested: [{ drop: undefined, keep: "yes" }] }]))
      .toEqual([{ keep: 1, nested: [{ keep: "yes" }] }]);
  });

  it("describes durations in plain words", () => {
    expect(durationLabel(30)).toBe("30 seconds");
    expect(durationLabel(300)).toBe("5 minutes");
    expect(durationLabel(3600)).toBe("1 hour");
  });
});

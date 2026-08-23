import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DisplayPageRenderer } from "@/components/display/DisplayPageRenderer";
import type { DisplayPage } from "@/hooks/useDeviceSettings";
import type { CalendarEvent, Task } from "@/types/app";

const page: DisplayPage = {
  id: "main",
  name: "Morning",
  durationSeconds: 30,
  background: "#09090b",
  widgets: [
    { id: "tasks", type: "tasks", x: 0, y: 0, w: 6, h: 6, taskFilter: "today", taskLimit: 3 },
    { id: "calendar", type: "calendar", x: 6, y: 0, w: 6, h: 6, calendarDaysAhead: 14 },
  ],
};

const tasks: Task[] = [
  { id: "today", title: "Pack school bag", priority: "medium", status: "todo", category: "Home", isToday: true, tags: [] },
  { id: "later", title: "Hidden later task", priority: "low", status: "todo", category: "Home", isToday: false, tags: [] },
];

const events: CalendarEvent[] = [
  {
    id: "event",
    title: "Dentist",
    category: "health",
    startDate: new Date(Date.now() + 86_400_000).toISOString(),
    endDate: new Date(Date.now() + 90_000_000).toISOString(),
  },
];

describe("DisplayPageRenderer", () => {
  it("renders only the selected account-safe task filter and upcoming calendar", () => {
    render(<DisplayPageRenderer page={page} photos={[]} calendarEvents={events} tasks={tasks} />);
    expect(screen.getByText("Pack school bag")).toBeInTheDocument();
    expect(screen.queryByText("Hidden later task")).not.toBeInTheDocument();
    expect(screen.getByText("Dentist")).toBeInTheDocument();
  });
});

import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { addDays, format } from "date-fns";
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
    { id: "calendar", type: "calendar", x: 6, y: 0, w: 6, h: 6, calendarView: "agenda", calendarDaysAhead: 14 },
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

  it("fills the screen with a month grid when the calendar is set to month view", () => {
    const today = new Date();
    const midMonth = new Date(today.getFullYear(), today.getMonth(), 15, 9, 0).toISOString();
    const monthPage: DisplayPage = {
      id: "calendar",
      name: "Calendar",
      durationSeconds: 3600,
      background: "#09090b",
      layout: "full",
      widgets: [{ id: "month", type: "calendar", x: 0, y: 0, w: 12, h: 12, calendarView: "month" }],
    };
    render(
      <DisplayPageRenderer
        page={monthPage}
        photos={[]}
        calendarEvents={[{ ...events[0], id: "mid", title: "Parents evening", startDate: midMonth, endDate: midMonth }]}
        tasks={[]}
      />,
    );
    expect(screen.getByText(format(new Date(), "MMMM yyyy"))).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText(/Parents evening/)).toBeInTheDocument();
  });

  it("shows the real jobs hiding under a parent task, with its progress", () => {
    const parented: Task[] = [{
      id: "acme",
      title: "Acme Ltd",
      priority: "medium",
      status: "todo",
      category: "Work",
      isToday: false,
      tags: [],
      subtasks: [
        { id: "s1", title: "File VAT return", done: false },
        { id: "s2", title: "Chase invoice 402", done: false },
        { id: "s3", title: "Pay supplier", done: true },
      ],
    }];
    const listPage: DisplayPage = {
      ...page,
      widgets: [{ id: "tasks", type: "tasks", x: 0, y: 0, w: 12, h: 12, taskFilter: "open", taskLimit: 10 }],
    };
    render(<DisplayPageRenderer page={listPage} photos={[]} calendarEvents={[]} tasks={parented} />);

    expect(screen.getByText("Acme Ltd")).toBeInTheDocument();
    expect(screen.getByText("1 of 3 done")).toBeInTheDocument();
    expect(screen.getByText("File VAT return")).toBeInTheDocument();
    expect(screen.getByText("Chase invoice 402")).toBeInTheDocument();
    expect(screen.queryByText("Pay supplier")).not.toBeInTheDocument();
  });

  it("moves a list on by itself when it is longer than the space", async () => {
    vi.useFakeTimers();
    const many: Task[] = Array.from({ length: 5 }, (_, index) => ({
      id: `task-${index}`,
      title: `Job ${index}`,
      priority: "medium",
      status: "todo",
      category: "Home",
      isToday: false,
      tags: [],
    }));
    const listPage: DisplayPage = {
      ...page,
      widgets: [{ id: "tasks", type: "tasks", x: 0, y: 0, w: 12, h: 12, taskFilter: "open", taskLimit: 2, autoCycleSeconds: 10 }],
    };
    render(<DisplayPageRenderer page={listPage} photos={[]} calendarEvents={[]} tasks={many} />);

    expect(screen.getByText("Job 0")).toBeInTheDocument();
    expect(screen.queryByText("Job 2")).not.toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(screen.getByText("Job 2")).toBeInTheDocument();
    expect(screen.queryByText("Job 0")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("can hide event titles and mark the days with a coloured dot instead", () => {
    const today = new Date();
    const midMonth = new Date(today.getFullYear(), today.getMonth(), 15, 9, 0).toISOString();
    const dotsPage: DisplayPage = {
      ...page,
      layout: "full",
      widgets: [{
        id: "month", type: "calendar", x: 0, y: 0, w: 12, h: 12,
        calendarView: "month", calendarEventStyle: "dots", eventColor: "#ff0000",
      }],
    };
    const { container } = render(
      <DisplayPageRenderer
        page={dotsPage}
        photos={[]}
        calendarEvents={[{ ...events[0], id: "mid", title: "Parents evening", startDate: midMonth, endDate: midMonth }]}
        tasks={[]}
      />,
    );
    expect(screen.queryByText(/Parents evening/)).not.toBeInTheDocument();
    expect(container.querySelector('[style*="rgb(255, 0, 0)"]')).toBeTruthy();
  });

  it("counts down to a date and shows a household message", () => {
    const mixed: DisplayPage = {
      ...page,
      layout: "halves",
      widgets: [
        { id: "count", type: "countdown", x: 0, y: 0, w: 6, h: 12, countdownTo: format(addDays(new Date(), 12), "yyyy-MM-dd"), countdownLabel: "Cornwall" },
        { id: "note", type: "message", x: 6, y: 0, w: 6, h: 12, message: "Bins out tonight" },
      ],
    };
    render(<DisplayPageRenderer page={mixed} photos={[]} calendarEvents={[]} tasks={[]} />);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("days to go")).toBeInTheDocument();
    expect(screen.getByText("Cornwall")).toBeInTheDocument();
    expect(screen.getByText("Bins out tonight")).toBeInTheDocument();
  });

  it("asks for a location when the screen itself cannot provide one", () => {
    const weatherPage: DisplayPage = {
      ...page,
      layout: "full",
      widgets: [{ id: "weather", type: "weather", x: 0, y: 0, w: 12, h: 12 }],
    };
    render(<DisplayPageRenderer page={weatherPage} photos={[]} calendarEvents={[]} tasks={[]} />);
    expect(screen.getByText(/Checking the forecast|Choose a location/)).toBeInTheDocument();
  });

  it("summarises the day on a Today page", () => {
    const todayPage: DisplayPage = {
      id: "today",
      name: "Today",
      durationSeconds: 300,
      background: "#09090b",
      layout: "full",
      widgets: [{ id: "today-main", type: "today", x: 0, y: 0, w: 12, h: 12 }],
    };
    render(<DisplayPageRenderer page={todayPage} photos={[]} calendarEvents={events} tasks={tasks} />);
    expect(screen.getByText("What’s on")).toBeInTheDocument();
    expect(screen.getByText("To do")).toBeInTheDocument();
    expect(screen.getByText("Dentist")).toBeInTheDocument();
    expect(screen.getByText("Pack school bag")).toBeInTheDocument();
  });

  it("shows uploaded photos and ignores ones that failed to load", () => {
    const album: DisplayPage = {
      id: "photos",
      name: "Photos",
      durationSeconds: 300,
      background: "#09090b",
      layout: "full",
      widgets: [{ id: "photos-main", type: "photos", x: 0, y: 0, w: 12, h: 12, photoIds: [] }],
    };
    render(
      <DisplayPageRenderer
        page={album}
        photos={[
          { id: "ok", url: "https://cdn.example.com/garden.jpg", storagePath: "displayPhotos/owner/a.jpg", caption: "Garden", source: "upload", createdAt: null },
          { id: "blank", url: "", storagePath: "displayPhotos/owner/b.jpg", caption: "Broken", source: "upload", createdAt: null },
        ]}
        calendarEvents={[]}
        tasks={[]}
      />,
    );
    expect(screen.getByAltText("Garden")).toBeInTheDocument();
    expect(screen.queryByAltText("Broken")).not.toBeInTheDocument();
  });
});

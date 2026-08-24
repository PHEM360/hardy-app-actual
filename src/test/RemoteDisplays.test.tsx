import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import RemoteDisplays from "@/pages/RemoteDisplays";
import { DEFAULT_DISPLAY_PAGES, type DeviceDoc } from "@/hooks/useDeviceSettings";

const mocks = vi.hoisted(() => ({
  updatePages: vi.fn().mockResolvedValue(undefined),
  forgetDevice: vi.fn().mockResolvedValue(undefined),
}));

const device: DeviceDoc = {
  id: "kitchen",
  uid: "owner",
  householdId: null,
  label: "Kitchen display",
  pairedVia: "qr",
  revoked: false,
  settings: {
    clock: { style: "digital", format24h: true, showSeconds: false, showDate: true, accentColor: "#7dd3fc", size: "large" },
    alarms: [],
    photoFrame: { enabled: false, intervalSeconds: 20, shuffle: true, showCaptions: true, photoIds: [] },
    calendar: { enabled: false, daysAhead: 14 },
    overview: { enabled: false, widgets: [] },
    scenes: { rotateSeconds: 30 },
    pages: DEFAULT_DISPLAY_PAGES,
  },
};

vi.mock("@/components/layout/FeaturePageShell", () => ({
  default: ({ title, action, children }: { title: string; action: React.ReactNode; children: React.ReactNode }) => (
    <main><h1>{title}</h1>{action}{children}</main>
  ),
}));
vi.mock("@/auth/AuthContext", () => ({ useAuth: () => ({ dataUid: "owner" }) }));
vi.mock("@/hooks/useMyDevices", () => ({
  useMyDevices: () => ({
    devices: [{ id: "kitchen", label: "Kitchen display", pairedVia: "qr", revoked: false, createdAt: null, lastSeenAt: null }],
    loading: false,
    renameDevice: vi.fn(),
    forgetDevice: mocks.forgetDevice,
  }),
}));
vi.mock("@/hooks/useDeviceSettings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useDeviceSettings")>();
  return {
    ...actual,
    useDeviceSettings: () => ({
      device,
      loading: false,
      updatePages: mocks.updatePages,
      updateSceneSettings: vi.fn(),
      addAlarm: vi.fn(),
      updateAlarm: vi.fn(),
      deleteAlarm: vi.fn(),
    }),
  };
});
vi.mock("@/hooks/useRemoteDisplayPhotos", () => ({
  useRemoteDisplayPhotos: () => ({
    photos: [],
    loading: false,
    addPhotos: vi.fn(),
    updateCaption: vi.fn(),
    deletePhoto: vi.fn(),
  }),
}));
vi.mock("@/hooks/useTasks", () => ({
  useTasks: () => ({
    tasks: [{ id: "task-1", title: "Put bins out", status: "todo", priority: "medium", category: "Home", isToday: true, tags: [] }],
    loading: false,
  }),
}));
vi.mock("@/hooks/useCalendar", () => ({
  useCalendar: () => ({ events: [], settings: {}, loading: false }),
}));

describe("RemoteDisplays", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("adds a ready-made page from a preset and saves it", async () => {
    vi.useFakeTimers();
    render(<RemoteDisplays />);

    expect(screen.getAllByText("Kitchen display").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Add page/ }));
    fireEvent.click(screen.getByText("Full month calendar"));

    await vi.advanceTimersByTimeAsync(400);
    expect(mocks.updatePages).toHaveBeenCalled();
    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { widgets: { type: string }[] }[];
    expect(saved.at(-1)?.widgets.map((widget) => widget.type)).toEqual(["calendar"]);
  });

  it("lets a page be scheduled to overnight hours only", async () => {
    vi.useFakeTimers();
    render(<RemoteDisplays />);

    fireEvent.change(screen.getByLabelText("Page hours"), { target: { value: "custom" } });
    await vi.advanceTimersByTimeAsync(400);

    expect(screen.getByLabelText("Show from")).toHaveValue("21:00");
    expect(screen.getByLabelText("Show until")).toHaveValue("06:00");
    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { activeFrom?: string; activeTo?: string }[];
    expect(saved[0]).toMatchObject({ activeFrom: "21:00", activeTo: "06:00" });
  });

  it("chooses what fills each area of the page", async () => {
    vi.useFakeTimers();
    render(<RemoteDisplays />);

    fireEvent.change(screen.getByLabelText("Widget for area 1"), { target: { value: "photos" } });
    await vi.advanceTimersByTimeAsync(400);

    expect(screen.getByText("Photo frame settings")).toBeInTheDocument();
    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { widgets: { type: string }[] }[];
    expect(saved[0].widgets[0].type).toBe("photos");
  });

  it("switches the layout so two widgets sit side by side", async () => {
    vi.useFakeTimers();
    render(<RemoteDisplays />);

    fireEvent.click(screen.getByRole("button", { name: /Side by side/ }));
    fireEvent.change(screen.getByLabelText("Widget for area 2"), { target: { value: "tasks" } });
    await vi.advanceTimersByTimeAsync(400);

    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { widgets: { type: string; x: number; w: number }[] }[];
    expect(saved[0].widgets).toHaveLength(2);
    expect(saved[0].widgets[1]).toMatchObject({ type: "tasks", x: 6, w: 6 });
  });

  it("never writes an undefined field, which Firestore would reject", async () => {
    vi.useFakeTimers();
    render(<RemoteDisplays />);

    fireEvent.change(screen.getByLabelText("Widget for area 1"), { target: { value: "clock" } });
    fireEvent.change(screen.getByLabelText("Page hours"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Page hours"), { target: { value: "all" } });
    await vi.advanceTimersByTimeAsync(400);

    const undefinedFields: string[] = [];
    const scan = (value: unknown, path: string) => {
      if (value === undefined) undefinedFields.push(path);
      else if (Array.isArray(value)) value.forEach((item, index) => scan(item, `${path}[${index}]`));
      else if (value && typeof value === "object") {
        Object.entries(value).forEach(([key, item]) => scan(item, `${path}.${key}`));
      }
    };
    scan(mocks.updatePages.mock.calls.at(-1)?.[0], "pages");
    expect(undefinedFields).toEqual([]);
  });

  it("opens a widget’s settings from its Settings button", async () => {
    vi.useFakeTimers();
    render(<RemoteDisplays />);

    fireEvent.change(screen.getByLabelText("Widget for area 1"), { target: { value: "clock" } });
    fireEvent.click(screen.getByRole("button", { name: /Close widget settings/ }));
    expect(screen.queryByText("Clock settings")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Settings/ }));
    expect(screen.getByText("Clock settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Heading on screen")).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(400);
  });

  it("revokes a linked display from its management page", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RemoteDisplays />);
    fireEvent.click(screen.getByRole("button", { name: /Disconnect/ }));
    expect(mocks.forgetDevice).toHaveBeenCalledWith("kitchen");
  });
});

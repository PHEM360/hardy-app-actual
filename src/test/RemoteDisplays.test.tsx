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
vi.mock("react-rnd", () => ({
  Rnd: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
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

  it("lists the linked account device and builds a second widget page", async () => {
    vi.useFakeTimers();
    render(<RemoteDisplays />);

    expect(screen.getAllByText("Kitchen display").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Page" }));
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Task summary" }));
    expect(screen.getByText("Widget settings")).toBeInTheDocument();
    expect(screen.getByText("Tasks to show")).toBeInTheDocument();

    await vi.advanceTimersByTimeAsync(400);
    expect(mocks.updatePages).toHaveBeenCalled();
  });

  it("revokes a linked display from its management page", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<RemoteDisplays />);
    fireEvent.click(screen.getByRole("button", { name: /Disconnect/ }));
    expect(mocks.forgetDevice).toHaveBeenCalledWith("kitchen");
  });
});

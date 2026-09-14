import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import RemoteDisplays from "@/pages/RemoteDisplays";
import { DEFAULT_DISPLAY_CONTROL_SETTINGS, DEFAULT_DISPLAY_PAGES, DEFAULT_LIGHT_SETTINGS, DEFAULT_NIGHT_MODE, type DeviceDoc } from "@/hooks/useDeviceSettings";

const mocks = vi.hoisted(() => ({
  updatePages: vi.fn().mockResolvedValue(undefined),
  forgetDevice: vi.fn().mockResolvedValue(undefined),
  copyLookFrom: vi.fn(),
}));

const device: DeviceDoc = {
  id: "kitchen",
  uid: "owner",
  householdId: null,
  label: "Kitchen display",
  deviceType: "display",
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
    nightMode: { ...DEFAULT_NIGHT_MODE, scheduleEnabled: false },
    light: DEFAULT_LIGHT_SETTINGS,
    control: DEFAULT_DISPLAY_CONTROL_SETTINGS,
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
    devices: [
      { id: "kitchen", label: "Kitchen display", deviceType: "display", pairedVia: "qr", revoked: false, createdAt: null, lastSeenAt: null },
      { id: "hallway", label: "Hallway display", deviceType: "display", pairedVia: "qr", revoked: false, createdAt: null, lastSeenAt: null },
      { id: "porch-light", label: "Porch light", deviceType: "light", pairedVia: "direct", revoked: false, createdAt: null, lastSeenAt: null },
    ],
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
      updateNightMode: vi.fn(),
      updateSceneSettings: vi.fn(),
      updateControl: vi.fn(),
      addAlarm: vi.fn(),
      updateAlarm: vi.fn(),
      deleteAlarm: vi.fn(),
      copyLookFrom: mocks.copyLookFrom,
    }),
  };
});
vi.mock("@/hooks/useRemoteDisplayPhotos", () => ({
  useRemoteDisplayPhotos: () => ({
    photos: [],
    loading: false,
    addPhotos: vi.fn(),
    addLinkedPhotos: vi.fn(),
    updateCaption: vi.fn(),
    deletePhoto: vi.fn(),
  }),
}));
vi.mock("@/hooks/useDisplayOwnerPhotos", () => ({
  useDisplayOwnerPhotos: () => ({
    photos: [],
    albums: [],
    loading: false,
    addPhotos: vi.fn(),
    addLinkedPhotos: vi.fn(),
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
vi.mock("@/hooks/useBirthdays", () => ({
  useBirthdays: () => ({ birthdays: [], loading: false, addBirthday: vi.fn(), updateBirthday: vi.fn(), deleteBirthday: vi.fn() }),
}));
vi.mock("@/hooks/useFamilyMessages", () => ({
  useFamilyMessages: () => ({ messages: [], loading: false, householdId: null, post: vi.fn(), remove: vi.fn(), uid: "owner" }),
}));

function openCustomise(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label, exact: true }));
}

describe("RemoteDisplays", () => {
  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
    HTMLCanvasElement.prototype.getContext = () => null;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("adds a ready-made page from a preset and saves it", async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);

    expect(screen.getAllByText("Kitchen display").length).toBeGreaterThan(0);
    openCustomise("Layout");
    fireEvent.click(screen.getByRole("button", { name: /Add page/ }));
    fireEvent.click(screen.getByText("Full month calendar"));

    await vi.advanceTimersByTimeAsync(400);
    expect(mocks.updatePages).toHaveBeenCalled();
    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { widgets: { type: string }[] }[];
    expect(saved.at(-1)?.widgets.map((widget) => widget.type)).toEqual(["calendar"]);
  });

  it("lets a page be scheduled to overnight hours only", async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);

    openCustomise("Layout");
    fireEvent.change(screen.getByLabelText("Page hours"), { target: { value: "custom" } });
    await vi.advanceTimersByTimeAsync(400);

    expect(screen.getByLabelText("Show from")).toHaveValue("21:00");
    expect(screen.getByLabelText("Show until")).toHaveValue("06:00");
    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { activeFrom?: string; activeTo?: string }[];
    expect(saved[0]).toMatchObject({ activeFrom: "21:00", activeTo: "06:00" });
  });

  it("chooses what fills each area of the page", async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);

    openCustomise("Layout");
    fireEvent.change(screen.getByLabelText("Widget for area 1"), { target: { value: "photos" } });
    await vi.advanceTimersByTimeAsync(400);

    expect(screen.getByText("Photo frame settings")).toBeInTheDocument();
    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { widgets: { type: string }[] }[];
    expect(saved[0].widgets[0].type).toBe("photos");
  });

  it("switches the layout so two widgets sit side by side", async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);

    openCustomise("Layout");
    fireEvent.click(screen.getByRole("button", { name: /Side by side/ }));
    fireEvent.change(screen.getByLabelText("Widget for area 2"), { target: { value: "tasks" } });
    await vi.advanceTimersByTimeAsync(400);

    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { widgets: { type: string; x: number; w: number }[] }[];
    expect(saved[0].widgets).toHaveLength(2);
    expect(saved[0].widgets[1]).toMatchObject({ type: "tasks", x: 6, w: 6 });
  });

  it("never writes an undefined field, which Firestore would reject", async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);

    openCustomise("Layout");
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
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);

    openCustomise("Layout");
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
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Disconnect/ }));
    expect(mocks.forgetDevice).toHaveBeenCalledWith("kitchen");
  });

  it("explains how to fill the photo library without using Firebase storage", () => {
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);
    openCustomise("Photos");
    expect(screen.getByRole("heading", { name: "Quick library" })).toBeTruthy();
    expect(screen.getByText(/For albums, sharing and Drive folders use the Photos page/)).toBeTruthy();
  });

  it("keeps night mode on the screen section", () => {
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);
    openCustomise("Screen");
    expect(screen.getByRole("button", { name: "Night mode" })).toBeTruthy();
  });

  it("keeps sunrise lights out of the connected screens list but shows them in their own panel", () => {
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);
    expect(screen.getAllByText("Kitchen display").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Porch light/ })).not.toBeInTheDocument();
    openCustomise("Lights");
    expect(screen.getByText("Porch light")).toBeInTheDocument();
  });

  it("lets a page pick a coastal or farming background", async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);

    expect(screen.getByRole("button", { name: /Harbour evening/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Under sail/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Summer pasture/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Harvest fields/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Under sail/ }));
    await vi.advanceTimersByTimeAsync(400);

    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { backdrop?: string }[];
    expect(saved[0].backdrop).toBe("sailing");
  });

  it("lets an alarm be linked to a sunrise light", () => {
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);
    openCustomise("Screen");
    fireEvent.click(screen.getByRole("button", { name: /Add alarm/ }));
    expect(screen.getByText("Also wake")).toBeInTheDocument();
    expect(screen.getAllByText("Porch light").length).toBeGreaterThanOrEqual(1);
  });

  it("duplicates the current page with a new id", async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);
    openCustomise("Layout");
    fireEvent.click(screen.getByRole("button", { name: /Duplicate page/ }));
    await vi.advanceTimersByTimeAsync(400);
    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { id: string; name: string }[];
    expect(saved).toHaveLength(2);
    expect(saved[1].name).toBe("Today copy");
    expect(saved[1].id).not.toBe(saved[0].id);
  });

  it("applies a whole-screen template after confirmation", async () => {
    vi.useFakeTimers();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);
    openCustomise("Screen");
    fireEvent.click(screen.getByRole("button", { name: /Morning briefing plus photos and jobs/ }));
    await vi.advanceTimersByTimeAsync(400);
    const saved = mocks.updatePages.mock.calls.at(-1)?.[0] as { name: string }[];
    expect(saved.map((page) => page.name)).toEqual(["Morning", "Photos & jobs"]);
  });

  it("copies the look from another owned screen", async () => {
    mocks.copyLookFrom.mockResolvedValue(DEFAULT_DISPLAY_PAGES);
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);
    openCustomise("Screen");
    fireEvent.change(screen.getByLabelText("Copy look from another screen"), { target: { value: "hallway" } });
    expect(mocks.copyLookFrom).toHaveBeenCalledWith("hallway");
  });

  it("hides long pairing how-to behind Link a screen", () => {
    render(<MemoryRouter><RemoteDisplays /></MemoryRouter>);
    expect(screen.queryByText("On the screen itself")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Link a screen/ }));
    expect(screen.getByText("On the screen itself")).toBeInTheDocument();
  });
});

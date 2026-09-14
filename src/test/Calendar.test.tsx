import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CalendarPage from "@/pages/Calendar";

const mocks = vi.hoisted(() => ({
  saveSettings: vi.fn(),
  addEvent: vi.fn().mockResolvedValue("new-id"),
}));

vi.mock("@/components/layout/FeaturePageShell", () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

vi.mock("@/hooks/useSharedScope", () => ({
  useSharedScope: () => ({
    scopeUserId: "me",
    permission: "edit",
    pageTitle: "Calendar",
    isOwnScope: true,
  }),
}));

vi.mock("@/hooks/useCalendar", () => ({
  useCalendar: () => ({
    events: [
      {
        id: "evt-1",
        title: "Dentist",
        category: "health",
        startDate: "2026-09-14T09:00:00.000Z",
        endDate: "2026-09-14T10:00:00.000Z",
        allDay: false,
        source: "local",
      },
    ],
    settings: { defaultView: "month" },
    addEvent: mocks.addEvent,
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
    saveSettings: mocks.saveSettings,
    loading: false,
  }),
}));

vi.mock("@/hooks/useHousehold", () => ({
  useHouseholdSettings: () => ({ settings: { members: [] } }),
  useHouseholdItems: () => ({ items: [] }),
}));

vi.mock("@/auth/useEffectiveRole", () => ({
  useEffectiveRole: () => ({ role: "admin" }),
}));

vi.mock("@/hooks/usePushNotifications", () => ({
  usePushNotifications: () => ({ isSupported: false, permission: "denied", requestPermission: vi.fn() }),
}));

vi.mock("@/hooks/usePets", () => ({ usePets: () => ({ pets: [] }) }));
vi.mock("@/hooks/useTasks", () => ({ useTasks: () => ({ tasks: [] }) }));
vi.mock("@/hooks/useCompanies", () => ({ useCompanies: () => ({ companies: [] }) }));
vi.mock("@/hooks/useNotes", () => ({ useNotes: () => ({ datedNotes: [] }) }));
vi.mock("@/hooks/useMail", () => ({
  useMail: () => ({
    messages: [
      {
        id: "mail-1",
        from: "school@example.test",
        subject: "Sports day",
        bodyText: "Sports day is 20 September 2026 at 1pm.",
        snippet: "",
        isMailingList: false,
      },
    ],
    accounts: [],
    settings: { instructions: "", autoClassify: true },
    aiResult: null,
    loading: false,
  }),
}));
vi.mock("@/lib/googleCalendarApi", () => ({
  disconnectGoogleCalendar: vi.fn(),
  listGoogleCalendars: vi.fn(),
  saveGoogleCalendarSelection: vi.fn(),
  startGoogleCalendarConnect: vi.fn(),
  syncGoogleCalendar: vi.fn(),
}));
vi.mock("@/lib/calendarFeedsApi", () => ({
  mergedCalendarSubscribeUrl: () => "https://example.test/cal",
  publishMergedCalendar: vi.fn(),
  syncCalendarFeed: vi.fn(),
}));

describe("Calendar page", () => {
  beforeEach(() => {
    mocks.saveSettings.mockReset();
    mocks.addEvent.mockReset();
    mocks.addEvent.mockResolvedValue("new-id");
  });

  it("switches between day, week, month and agenda", () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Calendar" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Day" }));
    expect(screen.getByText("All day")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Week" }));
    expect(screen.getByRole("button", { name: "Week" }).className).toMatch(/bg-gradient-primary/);
    fireEvent.click(screen.getByRole("button", { name: "Agenda" }));
    expect(screen.getByText("Coming up")).toBeInTheDocument();
  });

  it("asks before turning a mail suggestion into an event", async () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );
    expect(screen.getByText("Suggested from mail")).toBeInTheDocument();
    expect(screen.getByText("Sports day")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add event" }));
    await waitFor(() => expect(mocks.addEvent).toHaveBeenCalled());
    expect(mocks.addEvent.mock.calls[0][0].title).toBe("Sports day");
  });

  it("saves day as the default view and can hide junk invites", () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Calendar settings" }));
    fireEvent.click(screen.getByRole("button", { name: "day" }));
    expect(mocks.saveSettings).toHaveBeenCalledWith(expect.objectContaining({ defaultView: "day" }));
    fireEvent.click(screen.getByRole("switch", { name: "Hide likely junk invites" }));
    expect(mocks.saveSettings).toHaveBeenCalledWith(expect.objectContaining({
      mergeRules: expect.objectContaining({ hideLikelyJunk: true }),
    }));
    expect(screen.getByRole("button", { name: /Choose ICS file/ })).toBeInTheDocument();
    expect(screen.getByText(/Outlook: calendar/)).toBeInTheDocument();
    expect(screen.getByText(/Add Calendar to your home screen/)).toBeInTheDocument();
  });
});

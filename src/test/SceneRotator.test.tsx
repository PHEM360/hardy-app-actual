import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SceneRotator } from "@/components/display/SceneRotator";
import type { DeviceDoc } from "@/hooks/useDeviceSettings";
import type { DisplayPage } from "@/lib/displayPages";

function messagePage(id: string, name: string, message: string): DisplayPage {
  return {
    id,
    name,
    durationSeconds: 3_600,
    background: "#09090b",
    layout: "full",
    widgets: [{
      id: `${id}-msg`,
      type: "message",
      x: 0,
      y: 0,
      w: 12,
      h: 12,
      message,
    }],
  };
}

function deviceWith(pages: DisplayPage[]): DeviceDoc {
  return {
    id: "kitchen",
    uid: "owner",
    householdId: null,
    label: "Kitchen",
    pairedVia: "qr",
    revoked: false,
    settings: {
      clock: { style: "digital", format24h: true, showSeconds: false, showDate: true, accentColor: "#7dd3fc", size: "large" },
      alarms: [],
      photoFrame: { enabled: false, intervalSeconds: 20, shuffle: true, showCaptions: true, photoIds: [] },
      calendar: { enabled: false, daysAhead: 14 },
      overview: { enabled: false, widgets: [] },
      scenes: { rotateSeconds: 3_600 },
      pages,
    },
  };
}

describe("SceneRotator", () => {
  it("hides page controls when there is only one page", () => {
    render(
      <SceneRotator
        device={deviceWith([messagePage("today", "Today", "Just today")])}
        photos={[]}
        calendarEvents={[]}
        tasks={[]}
      />,
    );
    expect(screen.getByText("Just today")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Next page" })).not.toBeInTheDocument();
  });

  it("advances with the on-screen buttons so a mouse or TV pointer can change page", () => {
    render(
      <SceneRotator
        device={deviceWith([
          messagePage("today", "Today", "Morning briefing"),
          messagePage("photos", "Photos", "Family album"),
        ])}
        photos={[]}
        calendarEvents={[]}
        tasks={[]}
      />,
    );
    expect(screen.getByText("Morning briefing")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Family album")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
    expect(screen.getByText("Morning briefing")).toBeInTheDocument();
  });

  it("rotates with keyboard and remote keys when the screen cannot be touched", () => {
    render(
      <SceneRotator
        device={deviceWith([
          messagePage("today", "Today", "Morning briefing"),
          messagePage("photos", "Photos", "Family album"),
          messagePage("clock", "Clock", "Night clock"),
        ])}
        photos={[]}
        calendarEvents={[]}
        tasks={[]}
      />,
    );

    fireEvent.keyDown(window, { key: "ArrowRight" });
    expect(screen.getByText("Family album")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: " " });
    expect(screen.getByText("Night clock")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "ArrowLeft" });
    expect(screen.getByText("Family album")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "3" });
    expect(screen.getByText("Night clock")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Home" });
    expect(screen.getByText("Morning briefing")).toBeInTheDocument();
  });
});

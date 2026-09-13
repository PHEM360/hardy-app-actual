import { describe, expect, it } from "vitest";
import { buildHouseholdNotesPdf } from "@/lib/householdNotesPdf";
import type { HouseholdNote } from "@/types/app";

describe("buildHouseholdNotesPdf", () => {
  it("builds a non-empty PDF blob grouped by note type", async () => {
    const notes: HouseholdNote[] = [
      {
        id: "1",
        title: "Boiler",
        body: "Reset under the panel.",
        noteType: "Utilities",
        updatedAt: "2026-09-01T10:00:00.000Z",
      },
      {
        id: "2",
        title: "Keys",
        body: "Spare with next door.",
        noteType: "Keys & Access",
        updatedAt: "2026-08-01T10:00:00.000Z",
      },
      {
        id: "3",
        title: "Misc",
        body: "No type yet",
        noteType: "",
      },
    ];

    const blob = buildHouseholdNotesPdf(notes, {
      householdName: "Ash Grove",
      noteTypes: ["Utilities", "Keys & Access", "Handover"],
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toContain("pdf");
    expect(blob.size).toBeGreaterThan(500);
  });

  it("still returns a PDF when there are no notes", async () => {
    const blob = buildHouseholdNotesPdf([], {
      householdName: "Empty House",
      noteTypes: ["General"],
    });
    expect(blob.size).toBeGreaterThan(200);
  });
});

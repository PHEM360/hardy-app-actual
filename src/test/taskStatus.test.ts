import { describe, expect, it } from "vitest";
import { normalizeTaskStatus, taskStatusIsClosed } from "@/types/app";

describe("task lifecycle statuses", () => {
  it("upgrades the legacy in-progress value to the on-track status", () => {
    expect(normalizeTaskStatus("in_progress")).toBe("in_progress_on_track");
  });

  it("keeps each new lifecycle status intact", () => {
    expect(normalizeTaskStatus("in_progress_off_track")).toBe("in_progress_off_track");
    expect(normalizeTaskStatus("in_progress_reassess")).toBe("in_progress_reassess");
    expect(normalizeTaskStatus("no_longer_needed")).toBe("no_longer_needed");
  });

  it("treats completed and no-longer-needed tasks as closed", () => {
    expect(taskStatusIsClosed("done")).toBe(true);
    expect(taskStatusIsClosed("no_longer_needed")).toBe(true);
    expect(taskStatusIsClosed("in_progress_on_track")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import {
  draftEventsFromMail,
  draftFromPastedText,
  draftToEventInput,
  unsubscribeActionFromText,
} from "@/lib/mailEventDrafts";

const now = new Date("2026-09-01T12:00:00");

describe("mail event drafts", () => {
  it("suggests an event from a dated message and never auto-creates it", () => {
    const drafts = draftEventsFromMail(
      [{
        id: "m1",
        from: "school@example.test",
        subject: "Parents evening",
        bodyText: "Please come on 14 September 2026 at 6pm.",
      }],
      now,
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0]).toMatchObject({
      suggestedTitle: "Parents evening",
      suggestedDate: "2026-09-14",
      suggestedTime: "18:00",
    });
    const payload = draftToEventInput(drafts[0]);
    expect(payload.source).toBe("local");
    expect(payload.title).toBe("Parents evening");
    expect(payload.startDate).toContain("2026-09-14");
  });

  it("skips mailing lists and newsletter subjects", () => {
    expect(draftEventsFromMail([{
      id: "list",
      subject: "Club night 14 September 2026",
      bodyText: "See you then",
      isMailingList: true,
    }], now)).toEqual([]);
    expect(draftEventsFromMail([{
      id: "news",
      subject: "September newsletter",
      bodyText: "Event on 14 September 2026",
    }], now)).toEqual([]);
  });

  it("reads a date from pasted text", () => {
    const draft = draftFromPastedText("Swim gala\n14/09/2026 10:00-11:30", now);
    expect(draft).toMatchObject({
      suggestedDate: "2026-09-14",
      suggestedTime: "10:00",
      suggestedEndTime: "11:30",
    });
  });

  it("finds List-Unsubscribe and obvious unsubscribe URLs", () => {
    expect(unsubscribeActionFromText("List-Unsubscribe: <https://brand.test/unsub>")).toEqual({
      http: "https://brand.test/unsub",
    });
    expect(unsubscribeActionFromText("Manage preferences at https://list-manage.com/unsub?u=1")).toEqual({
      http: "https://list-manage.com/unsub?u=1",
    });
  });
});

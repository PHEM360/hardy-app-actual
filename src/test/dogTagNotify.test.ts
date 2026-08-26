import { describe, expect, it } from "vitest";
import { buildScanNotifyTargets, normalizeNotifyEmail, parseNotifyEmails, petAccessUids } from "../../functions/src/dogTagNotify";

describe("dog tag scan notify list", () => {
  it("notifies the owner and people this pet is shared with, not the whole household", () => {
    expect(petAccessUids(
      { ownerId: "owner", sharedWith: ["sitter", "owner"] },
      ["page-share"],
    )).toEqual(["owner", "sitter", "page-share"]);
  });

  it("keeps extra emails and skips duplicates already covered by access", () => {
    const targets = buildScanNotifyTargets({
      accessUids: ["owner"],
      extraUids: ["neighbour"],
      extraEmails: ["chris@example.com", "neighbour@example.com", "not-an-email"],
      users: {
        owner: { email: "chris@example.com", name: "Chris" },
        neighbour: { email: "neighbour@example.com", name: "Sam" },
      },
    });
    expect(targets.map((item) => item.email)).toEqual(["chris@example.com", "neighbour@example.com"]);
    expect(targets.map((item) => item.source)).toEqual(["access", "extra"]);
  });

  it("accepts a well-formed extra email", () => {
    expect(normalizeNotifyEmail("  Sam@Example.COM ")).toBe("sam@example.com");
    expect(parseNotifyEmails(["sam@example.com", "sam@example.com"])).toEqual(["sam@example.com"]);
  });
});

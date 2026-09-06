import { describe, expect, it } from "vitest";
import {
  extractEmailAddress,
  filterMailMessages,
  guessMailHosts,
  inferMailCategory,
  isMailingListMessage,
  parseListUnsubscribe,
  quoteReplyBody,
  replySubject,
  sanitizeMailText,
} from "@/lib/mailLogic";
import type { MailMessage } from "@/types/mail";

const message = (partial: Partial<MailMessage>): MailMessage => ({
  id: partial.id || "1",
  accountId: partial.accountId || "a",
  providerMessageId: "p",
  threadId: "t",
  folder: partial.folder || "inbox",
  from: partial.from || "Ada <ada@family.test>",
  fromName: partial.fromName || "Ada",
  to: ["chris@family.test"],
  cc: [],
  subject: partial.subject || "Hello",
  snippet: partial.snippet || "Hi there",
  bodyText: partial.bodyText || "Hi there",
  date: partial.date || "2026-09-06T10:00:00.000Z",
  unread: partial.unread ?? true,
  starred: partial.starred ?? false,
  labels: [],
  aiCategory: "",
  aiSummary: "",
  isMailingList: partial.isMailingList ?? false,
  listUnsubscribe: partial.listUnsubscribe || "",
  listUnsubscribePost: "",
});

describe("mail helpers", () => {
  it("guesses Gmail and iCloud hosts", () => {
    expect(guessMailHosts("Chris Hardy <chris.hardy.07@googlemail.com>")).toEqual({
      imap: "imap.gmail.com",
      smtp: "smtp.gmail.com",
    });
    expect(guessMailHosts("me@icloud.com")?.imap).toBe("imap.mail.me.com");
    expect(guessMailHosts("odd@example.test")).toBeNull();
  });

  it("reads List-Unsubscribe mailto and https targets", () => {
    expect(parseListUnsubscribe("<mailto:leave@brand.test?subject=unsub>, <https://brand.test/unsub>")).toEqual({
      mailto: "leave@brand.test?subject=unsub",
      http: "https://brand.test/unsub",
    });
  });

  it("spots mailing lists from headers and no-reply senders", () => {
    expect(isMailingListMessage({ listUnsubscribe: "<mailto:x@y.test>" })).toBe(true);
    expect(isMailingListMessage({ precedence: "bulk" })).toBe(true);
    expect(isMailingListMessage({ from: "Shop <noreply@shop.test>" })).toBe(true);
    expect(isMailingListMessage({ from: "Mum <mum@family.test>" })).toBe(false);
  });

  it("filters inbox, unread, lists and search", () => {
    const rows = [
      message({ id: "1", subject: "School trip", unread: true }),
      message({ id: "2", subject: "Weekly deals", isMailingList: true, unread: false }),
      message({ id: "3", subject: "Sent note", folder: "sent", unread: false }),
    ];
    expect(filterMailMessages(rows, "inbox", "all", "").map((row) => row.id)).toEqual(["1", "2"]);
    expect(filterMailMessages(rows, "unread", "all", "").map((row) => row.id)).toEqual(["1"]);
    expect(filterMailMessages(rows, "lists", "all", "").map((row) => row.id)).toEqual(["2"]);
    expect(filterMailMessages(rows, "inbox", "all", "school").map((row) => row.id)).toEqual(["1"]);
  });

  it("strips html and quotes a reply", () => {
    expect(sanitizeMailText("<p>Hi <script>alert(1)</script>Mum</p>")).toBe("Hi Mum");
    expect(replySubject("Re: Dinner")).toBe("Re: Dinner");
    expect(quoteReplyBody("Mum", "6 Sep", "Come over")).toContain("> Come over");
  });

  it("infers list and receipt categories", () => {
    expect(inferMailCategory(message({ isMailingList: true }))).toBe("list");
    expect(inferMailCategory(message({ subject: "Your order receipt from Apple" }))).toBe("receipt");
    expect(extractEmailAddress("Ada Lovelace <ada@family.test>")).toBe("ada@family.test");
  });
});

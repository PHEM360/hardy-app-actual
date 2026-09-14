import { describe, expect, it } from "vitest";
import {
  captureExpenseAllowed,
  capturePagesLabel,
  categoriesForCapture,
  GENERIC_EXPENSE_CATEGORIES,
  inboxItemName,
} from "@/lib/captureInbox";
import { ALL_LINKS } from "@/components/widgets/QuickLinksWidget";

describe("capture destinations", () => {
  it("lets expenses go to unallocated, companies, households and flats", () => {
    expect(captureExpenseAllowed("unallocated")).toBe(true);
    expect(captureExpenseAllowed("company")).toBe(true);
    expect(captureExpenseAllowed("household")).toBe(true);
    expect(captureExpenseAllowed("flat")).toBe(true);
    expect(captureExpenseAllowed("pets")).toBe(false);
    expect(captureExpenseAllowed("notes")).toBe(false);
  });

  it("uses company and flat category lists when those destinations are picked", () => {
    expect(categoriesForCapture("unallocated")).toEqual(GENERIC_EXPENSE_CATEGORIES);
    expect(categoriesForCapture("company", ["Travel", "Other"])).toEqual(["Travel", "Other"]);
    expect(categoriesForCapture("flat")).toContain("Ground Rent");
  });
});

describe("multi-page capture", () => {
  it("labels one inbox item from the draft name, not each file", () => {
    expect(inboxItemName({ name: "Waitrose" }, [{ name: "page1.jpg" }, { name: "page2.jpg" }])).toBe("Waitrose");
    expect(inboxItemName({ name: "  " }, [{ name: "receipt-front.jpg" }])).toBe("receipt-front");
  });

  it("counts extra photos as pages of the same item", () => {
    expect(capturePagesLabel(1)).toBe("1 page");
    expect(capturePagesLabel(3)).toBe("3 pages");
  });
});

describe("quick links", () => {
  it("renames the expense shortcut to add expense or document", () => {
    const expense = ALL_LINKS.find((link) => link.id === "expense");
    expect(expense).toMatchObject({
      label: "Add expense or document",
      action: "expense",
    });
  });
});

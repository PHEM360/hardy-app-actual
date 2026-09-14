import { describe, expect, it } from "vitest";
import {
  captureExpenseAllowed,
  categoriesForCapture,
  GENERIC_EXPENSE_CATEGORIES,
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

describe("quick links", () => {
  it("renames the expense shortcut to add expense or document", () => {
    const expense = ALL_LINKS.find((link) => link.id === "expense");
    expect(expense).toMatchObject({
      label: "Add expense or document",
      action: "expense",
    });
  });
});

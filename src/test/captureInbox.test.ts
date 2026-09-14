import { describe, expect, it } from "vitest";
import {
  addFilesAsBundles,
  appendPagesToBundle,
  captureBatchCounts,
  captureExpenseAllowed,
  capturePagesLabel,
  captureProgressPercent,
  categoriesForCapture,
  GENERIC_EXPENSE_CATEGORIES,
  inboxItemName,
  mergeBundleWithPrevious,
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
  const file = (name: string) => new File(["x"], name, { type: "image/jpeg" });

  it("labels one inbox item from the draft name, not each file", () => {
    expect(inboxItemName({ name: "Waitrose" }, [{ name: "page1.jpg" }, { name: "page2.jpg" }])).toBe("Waitrose");
    expect(inboxItemName({ name: "  " }, [{ name: "receipt-front.jpg" }])).toBe("receipt-front");
  });

  it("counts extra photos as pages of the same item", () => {
    expect(capturePagesLabel(1)).toBe("1 page");
    expect(capturePagesLabel(3)).toBe("3 pages");
  });

  it("treats each new photo as its own receipt", () => {
    const bundles = addFilesAsBundles([], [file("a.jpg"), file("b.jpg")]);
    expect(bundles).toHaveLength(2);
    expect(bundles.map((bundle) => bundle.files.map((item) => item.name))).toEqual([["a.jpg"], ["b.jpg"]]);
    expect(captureBatchCounts(bundles)).toEqual({ items: 2, pages: 2 });
  });

  it("appends extra photos as pages of one receipt", () => {
    let bundles = addFilesAsBundles([], [file("a.jpg")]);
    bundles = appendPagesToBundle(bundles, bundles[0].id, [file("a2.jpg"), file("a3.jpg")]);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].files.map((item) => item.name)).toEqual(["a.jpg", "a2.jpg", "a3.jpg"]);
    expect(captureBatchCounts(bundles)).toEqual({ items: 1, pages: 3 });
  });

  it("turns page counts into an upload percent", () => {
    expect(captureProgressPercent({ doneItems: 1, totalItems: 4, donePages: 3, totalPages: 10 })).toBe(30);
    expect(captureProgressPercent({ doneItems: 1, totalItems: 2, donePages: 0, totalPages: 0 })).toBe(50);
  });

  it("joins a later snap onto the previous receipt", () => {
    let bundles = addFilesAsBundles([], [file("1.jpg"), file("2.jpg"), file("3.jpg")]);
    bundles = mergeBundleWithPrevious(bundles, bundles[1].id);
    expect(bundles.map((bundle) => bundle.files.map((item) => item.name))).toEqual([["1.jpg", "2.jpg"], ["3.jpg"]]);
    bundles = mergeBundleWithPrevious(bundles, bundles[1].id);
    expect(bundles).toHaveLength(1);
    expect(bundles[0].files.map((item) => item.name)).toEqual(["1.jpg", "2.jpg", "3.jpg"]);
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

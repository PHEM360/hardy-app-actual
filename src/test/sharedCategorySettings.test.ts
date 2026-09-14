import { describe, expect, it } from "vitest";
import { normalizeSharedCategories } from "@/lib/sharedCategories";
import { SHARED_CATEGORY_SETTINGS_ID, sortCategoriesOtherLast } from "@/types/app";

describe("shared category settings", () => {
  it("uses a dedicated family document id that is not a real company", () => {
    expect(SHARED_CATEGORY_SETTINGS_ID).toBe("__family__");
  });

  it("keeps Other last when editing lists", () => {
    expect(sortCategoriesOtherLast(["Other", "Travel", "Payroll"])).toEqual(["Travel", "Payroll", "Other"]);
  });

  it("keeps an empty saved list instead of restoring defaults", () => {
    expect(normalizeSharedCategories({
      incomeCategories: ["Consulting"],
      expenseCategories: [],
      documentCategories: ["Invoice"],
    })).toEqual({
      incomeCategories: ["Consulting"],
      expenseCategories: [],
      documentCategories: ["Invoice"],
    });
  });

  it("falls back to defaults only when a field was never saved", () => {
    const normalized = normalizeSharedCategories({});
    expect(normalized.incomeCategories.length).toBeGreaterThan(0);
    expect(normalized.expenseCategories.length).toBeGreaterThan(0);
    expect(normalized.documentCategories.length).toBeGreaterThan(0);
  });
});

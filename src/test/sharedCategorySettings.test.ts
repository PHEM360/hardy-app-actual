import { describe, expect, it } from "vitest";
import { SHARED_CATEGORY_SETTINGS_ID, sortCategoriesOtherLast } from "@/types/app";

describe("shared category settings", () => {
  it("uses a dedicated family document id that is not a real company", () => {
    expect(SHARED_CATEGORY_SETTINGS_ID).toBe("__family__");
  });

  it("keeps Other last when editing lists", () => {
    expect(sortCategoriesOtherLast(["Other", "Travel", "Payroll"])).toEqual(["Travel", "Payroll", "Other"]);
  });
});

import { describe, expect, it } from "vitest";
import { pathFromAppUrl } from "@/lib/nativeApp";

describe("native deep links", () => {
  it("keeps https Hardy Hub paths for Universal Links", () => {
    expect(pathFromAppUrl("https://hardyapp.co.uk/finance/bank-callback?code=1&state=2")).toBe(
      "/finance/bank-callback?code=1&state=2",
    );
  });

  it("unwraps the hardyapp:// scheme used on iOS and Android", () => {
    expect(pathFromAppUrl("hardyapp://notes?new=1")).toBe("/notes?new=1");
    expect(pathFromAppUrl("hardyapp://hardyapp.co.uk/finance/bank-callback?code=1")).toBe(
      "/finance/bank-callback?code=1",
    );
  });

  it("returns null for junk rather than throwing", () => {
    expect(pathFromAppUrl("not a url")).toBeNull();
  });
});

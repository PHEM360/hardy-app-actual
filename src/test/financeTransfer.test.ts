import { describe, expect, it } from "vitest";
import { balanceOnOrBefore, buildTransferPlan, latestBalanceFor } from "@/lib/financeTransfer";

describe("finance transfer", () => {
  it("treats an account with no entries as zero", () => {
    expect(latestBalanceFor("missing", [])).toBe(0);
  });

  it("reads the newest balance for an account", () => {
    expect(
      latestBalanceFor("isa", [
        { accountId: "isa", date: "2026-01-01", balance: 400 },
        { accountId: "isa", date: "2026-10-01", balance: 1000 },
        { accountId: "other", date: "2026-10-02", balance: 50 },
      ]),
    ).toBe(1000);
  });

  it("reads the balance in force on the transfer date", () => {
    expect(
      balanceOnOrBefore("isa", [
        { accountId: "isa", date: "2026-01-01", balance: 400 },
        { accountId: "isa", date: "2026-03-15", balance: 1000 },
        { accountId: "isa", date: "2026-10-01", balance: 1200 },
      ], "2026-03-15"),
    ).toBe(1000);
  });

  it("zeros the closed account and adds the cash to the destination with graph notes", () => {
    const plan = buildTransferPlan({
      from: { id: "barclays", name: "Barclays ISA" },
      to: { id: "vanguard", name: "Vanguard ISA" },
      fromBalance: 1000,
      toBalance: 250,
      date: "2026-10-22",
    });
    expect(plan.fromBalance).toBe(0);
    expect(plan.toBalance).toBe(1250);
    expect(plan.fromNote).toBe("Closed. Transferred £1,000.00 to Vanguard ISA.");
    expect(plan.toNote).toBe("Received £1,000.00 from Barclays ISA.");
  });
});

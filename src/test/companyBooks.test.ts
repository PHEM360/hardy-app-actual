import { describe, expect, it } from "vitest";
import {
  agedPayables,
  agedReceivables,
  cashPosition,
  nextRepeatDate,
  profitAndLoss,
  vatPeriodBounds,
  vatReturn,
} from "@/lib/companyBooks";
import type { CompanyBill, CompanyInvoice } from "@/types/companyHub";

function sale(partial: Partial<CompanyInvoice>): CompanyInvoice {
  return {
    companyId: "c1",
    number: "INV-0001",
    status: "sent",
    source: "hardy",
    customerName: "Nia",
    issueDate: "2026-08-10",
    dueDate: "2026-08-24",
    currency: "GBP",
    lines: [{ id: "l1", description: "Course", quantity: 1, unitPrice: 100, vatRate: 20 }],
    subtotal: 100,
    vatTotal: 20,
    total: 120,
    amountPaid: 0,
    paymentTermsDays: 14,
    ...partial,
  };
}

function bill(partial: Partial<CompanyBill>): CompanyBill {
  return {
    companyId: "c1",
    number: "BILL-0001",
    status: "awaiting",
    supplierName: "Adobe",
    issueDate: "2026-08-12",
    dueDate: "2026-09-01",
    lines: [{ id: "l1", description: "Software", quantity: 1, unitPrice: 50, vatRate: 20, accountCode: "400" }],
    subtotal: 50,
    vatTotal: 10,
    total: 60,
    amountPaid: 0,
    ...partial,
  };
}

describe("companyBooks", () => {
  it("builds a UK VAT quarter from the stagger month", () => {
    expect(vatPeriodBounds("2026-09-19", "quarterly", 1)).toEqual({
      start: "2026-07-01",
      end: "2026-09-30",
      label: "VAT 2026-07-01 to 2026-09-30",
    });
  });

  it("nets credit notes out of sales and VAT box 1", () => {
    const pl = profitAndLoss({
      invoices: [
        sale({}),
        sale({ number: "CN-0001", kind: "credit", issueDate: "2026-08-20", subtotal: 20, vatTotal: 4, total: 24 }),
      ],
      bills: [bill({})],
      income: [],
      expenses: [{ date: "2026-08-15", description: "Travel", amount: 15, category: "Travel" }],
      start: "2026-07-01",
      end: "2026-09-30",
    });
    expect(pl.sales).toBe(80);
    expect(pl.bills).toBe(50);
    expect(pl.expenses).toBe(15);
    expect(pl.net).toBe(15);

    const vat = vatReturn({
      invoices: [
        sale({}),
        sale({ number: "CN-0001", kind: "credit", issueDate: "2026-08-20", subtotal: 20, vatTotal: 4, total: 24 }),
      ],
      bills: [bill({})],
      start: "2026-07-01",
      end: "2026-09-30",
    });
    expect(vat.box1).toBe(16);
    expect(vat.box4).toBe(10);
    expect(vat.box5).toBe(6);
    expect(vat.box6).toBe(80);
    expect(vat.box7).toBe(50);
  });

  it("ages unpaid invoices and bills", () => {
    const ar = agedReceivables([
      sale({ id: "a", dueDate: "2026-09-20", total: 120, amountPaid: 0 }),
      sale({ id: "b", number: "INV-0002", dueDate: "2026-07-01", total: 50, amountPaid: 0, customerName: "Late" }),
      sale({ id: "c", status: "paid", amountPaid: 120 }),
    ], "2026-09-19");
    expect(ar.totals.current).toBe(120);
    expect(ar.totals.d61_90).toBe(50);
    expect(ar.total).toBe(170);

    const ap = agedPayables([bill({ id: "b1", dueDate: "2026-08-01" })], "2026-09-19");
    expect(ap.totals.d31_60).toBe(60);
  });

  it("rolls opening bank with imported lines and counts unmatched", () => {
    const cash = cashPosition({
      invoices: [sale({})],
      bills: [bill({})],
      transactions: [
        { accountId: "tide", date: "2026-08-01", description: "Fee", amount: 120, matchedInvoiceId: "a" },
        { accountId: "tide", date: "2026-08-02", description: "Adobe", amount: -60 },
      ],
      billing: { openingBank: 1000, openingDebtors: 0, openingCreditors: 0, openingVat: 0 },
      today: "2026-09-19",
    });
    expect(cash.bank).toBe(1060);
    expect(cash.unreconciled).toBe(1);
  });

  it("steps repeating invoice dates", () => {
    expect(nextRepeatDate("2026-01-31", "monthly")).toBe("2026-02-28");
    expect(nextRepeatDate("2026-01-15", "yearly")).toBe("2027-01-15");
  });
});

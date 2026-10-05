import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  amountDue,
  derivedInvoiceStatus,
  formatInvoiceNumber,
  invoiceTotals,
  parseBankCsv,
} from "@/lib/companyInvoice";

describe("companyInvoice", () => {
  it("totals lines with VAT", () => {
    expect(invoiceTotals([
      { id: "a", description: "Consult", quantity: 2, unitPrice: 50, vatRate: 20 },
      { id: "b", description: "Kit", quantity: 1, unitPrice: 10, vatRate: 0 },
    ])).toEqual({ subtotal: 110, vatTotal: 20, total: 130 });
  });

  it("marks unpaid sent invoices overdue after the due date", () => {
    expect(derivedInvoiceStatus({
      status: "sent",
      dueDate: "2026-01-01",
      amountPaid: 0,
      total: 100,
    }, "2026-09-19")).toBe("overdue");
  });

  it("formats a professional invoice number", () => {
    expect(formatInvoiceNumber("nbfst", 7)).toBe("NBFST-0007");
  });

  it("reads Tide-style CSV credits and debits", () => {
    const csv = "Date,Description,Paid in,Paid out\n19/09/2026,Course fee,120.00,\n18/09/2026,Software,,18.00\n";
    expect(parseBankCsv(csv)).toEqual([
      { date: "2026-09-19", description: "Course fee", amount: 120 },
      { date: "2026-09-18", description: "Software", amount: -18 },
    ]);
  });

  it("reads Tide exports with extra columns and Starling amount files", () => {
    const tide = "Date,Transaction ID,Description,Paid in (£),Paid out (£),Balance\n19/09/2026,abc,Course fee,120.00,,500\n";
    expect(parseBankCsv(tide)).toEqual([
      { date: "2026-09-19", description: "Course fee", amount: 120 },
    ]);
    const starling = "Date,Counter Party,Reference,Type,Amount (GBP),Balance (GBP)\n2026-09-18,Adobe,Software,FASTER PAYMENT,-18.00,90.00\n";
    expect(parseBankCsv(starling)).toEqual([
      { date: "2026-09-18", description: "Adobe", amount: -18 },
    ]);
    const hsbc = "Date,Type,Description,Paid out,Paid in,Balance\n18 Sep 2026,DD,Insurance,42.00,,\n";
    expect(parseBankCsv(hsbc)).toEqual([
      { date: "2026-09-18", description: "Insurance", amount: -42 },
    ]);
  });

  it("computes the remaining balance", () => {
    expect(amountDue({ total: 100, amountPaid: 25 })).toBe(75);
    expect(addDaysIso("2026-09-01", 14)).toBe("2026-09-15");
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CompanyReportsPanel } from "@/components/companies/CompanyReportsPanel";
import { CompanyBillsPanel } from "@/components/companies/CompanyBillsPanel";
import { CompanyBankRec } from "@/components/companies/CompanyBankRec";
import type { Company } from "@/types/app";
import { DEFAULT_BILLING_PROFILE } from "@/types/companyHub";

vi.mock("@/hooks/useCompanyHub", () => ({
  useCompanyInvoices: () => ({
    invoices: [{
      id: "inv1",
      companyId: "c1",
      number: "INV-0001",
      status: "sent",
      source: "hardy",
      customerName: "Nia",
      issueDate: "2026-08-10",
      dueDate: "2026-08-24",
      currency: "GBP",
      lines: [{ id: "l1", description: "Course", quantity: 1, unitPrice: 100, vatRate: 20, accountCode: "200" }],
      subtotal: 100,
      vatTotal: 20,
      total: 120,
      amountPaid: 0,
      paymentTermsDays: 14,
    }],
    addInvoice: vi.fn(),
    updateInvoice: vi.fn(),
    deleteInvoice: vi.fn(),
  }),
  useCompanyBills: () => ({
    bills: [{
      id: "bill1",
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
    }],
    addBill: vi.fn(),
    updateBill: vi.fn(),
    deleteBill: vi.fn(),
  }),
  useCompanyBilling: () => ({
    profile: { ...DEFAULT_BILLING_PROFILE, vatScheme: "standard", vatRegistered: true },
    saveProfile: vi.fn(),
    loading: false,
  }),
  useCompanyBank: () => ({
    accounts: [],
    transactions: [{ id: "tx1", accountId: "a", date: "2026-08-01", description: "Fee", amount: 120 }],
    addAccount: vi.fn(),
    addTransactions: vi.fn(),
    matchTransaction: vi.fn(),
  }),
  useCompanyCustomers: () => ({ customers: [], addCustomer: vi.fn() }),
}));

vi.mock("@/hooks/useCompanies", () => ({
  useCompanyIncome: () => ({ incomes: [], addIncome: vi.fn() }),
  useCompanyExpenses: () => ({ expenses: [], addExpense: vi.fn() }),
}));

const company: Company = {
  id: "c1",
  name: "NBFST",
  description: "",
  color: "#0f766e",
  emoji: "🏢",
  isRegistered: false,
  companyType: "sole_trader",
  taxYearStart: "2026-04-06",
  contact: {},
};

describe("company books UI", () => {
  it("shows P&L, VAT boxes, aged balances and bank rec", () => {
    render(<CompanyReportsPanel company={company} canEdit />);
    expect(screen.getByText("Company books")).toBeInTheDocument();
    expect(screen.getByText(/Hardy Hub is the accounts system/)).toBeInTheDocument();
    expect(screen.getByText(/Profit and loss/)).toBeInTheDocument();
    expect(screen.getByText("VAT on sales")).toBeInTheDocument();
    expect(screen.getByText("Aged receivables")).toBeInTheDocument();
    expect(screen.getByText("Aged payables")).toBeInTheDocument();
    expect(screen.getByText("Bank rec")).toBeInTheDocument();
    expect(screen.getByText("Opening balances")).toBeInTheDocument();
    expect(screen.getByText("INV-0001 · Nia")).toBeInTheDocument();
    expect(screen.getByText("BILL-0001 · Adobe")).toBeInTheDocument();
  });

  it("lists supplier bills with a primary new bill action", () => {
    render(<CompanyBillsPanel company={company} canEdit />);
    expect(screen.getByRole("button", { name: /New bill/ })).toBeInTheDocument();
    expect(screen.getByText("BILL-0001 · Adobe")).toBeInTheDocument();
    expect(screen.getByText("To pay")).toBeInTheDocument();
  });

  it("imports a bank CSV against a real account id", async () => {
    const addAccount = vi.fn(async () => "acc-1");
    const addTransactions = vi.fn(async () => undefined);
    render(
      <CompanyBankRec
        canEdit
        invoices={[]}
        bills={[]}
        accounts={[]}
        transactions={[]}
        addAccount={addAccount}
        addTransactions={addTransactions}
        matchTransaction={vi.fn()}
      />,
    );
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const csv = "Date,Description,Paid in,Paid out\n19/09/2026,Course fee,120.00,\n";
    const file = new File([csv], "tide.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: async () => csv });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(addAccount).toHaveBeenCalled());
    expect(addTransactions).toHaveBeenCalledWith([
      { date: "2026-09-19", description: "Course fee", amount: 120, accountId: "acc-1" },
    ]);
  });
});

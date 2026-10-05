import { toast } from "sonner";
import { gbp, parseBankCsv } from "@/lib/companyInvoice";
import { derivedBillStatus } from "@/lib/companyBooks";
import { derivedInvoiceStatus } from "@/lib/companyInvoice";
import type { CompanyBankAccount, CompanyBankTransaction, CompanyBill, CompanyInvoice } from "@/types/companyHub";

export function CompanyBankRec({
  canEdit,
  invoices,
  bills,
  accounts,
  transactions,
  addAccount,
  addTransactions,
  matchTransaction,
  onMatchInvoice,
  onMatchBill,
  defaultAccountName = "Business account",
}: {
  canEdit: boolean;
  invoices: CompanyInvoice[];
  bills: CompanyBill[];
  accounts: CompanyBankAccount[];
  transactions: CompanyBankTransaction[];
  addAccount: (account: Omit<CompanyBankAccount, "id" | "createdAt">) => Promise<string | void>;
  addTransactions: (rows: Omit<CompanyBankTransaction, "id">[]) => Promise<void>;
  matchTransaction: (id: string, updates: Partial<CompanyBankTransaction>) => Promise<void>;
  onMatchInvoice?: (invoice: CompanyInvoice) => Promise<void> | void;
  onMatchBill?: (bill: CompanyBill) => Promise<void> | void;
  defaultAccountName?: string;
}) {
  const unmatched = transactions.filter((row) => !row.matchedInvoiceId && !row.matchedBillId);
  const shown = [...unmatched, ...transactions.filter((row) => row.matchedInvoiceId || row.matchedBillId)].slice(0, 40);

  const importCsv = async (file: File) => {
    try {
      const text = await file.text();
      const rows = parseBankCsv(text);
      if (!rows.length) {
        toast.error("No usable rows in that file. Use a Tide, Starling, or bank CSV with a date and amount.");
        return;
      }
      let accountId = accounts[0]?.id;
      if (!accountId) {
        accountId = (await addAccount({ name: defaultAccountName, provider: defaultAccountName, currency: "GBP" })) || "";
      }
      if (!accountId) {
        toast.error("Could not create a bank account for this import.");
        return;
      }
      await addTransactions(rows.map((row) => ({ ...row, accountId })));
      toast.success(`Imported ${rows.length} bank lines`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not import that CSV");
    }
  };

  const matchRow = async (row: CompanyBankTransaction, value: string) => {
    if (!row.id || !value) return;
    const [kind, id] = value.split(":");
    try {
      if (kind === "inv") {
        await matchTransaction(row.id, { matchedInvoiceId: id });
        const invoice = invoices.find((item) => item.id === id);
        if (invoice) await onMatchInvoice?.(invoice);
      }
      if (kind === "bill") {
        await matchTransaction(row.id, { matchedBillId: id });
        const bill = bills.find((item) => item.id === id);
        if (bill) await onMatchBill?.(bill);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not match that line");
    }
  };

  return (
    <section className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-display font-bold">Bank rec</p>
          <p className="text-sm text-muted-foreground">Import a Tide, Starling, or bank CSV. Match money in to invoices and money out to bills.</p>
        </div>
        {canEdit && (
          <label className="cursor-pointer rounded-xl border border-border px-3 py-2 text-xs font-semibold">
            Import CSV
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void importCsv(file);
              event.target.value = "";
            }} />
          </label>
        )}
      </div>
      {transactions.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bank lines yet.</p>
      ) : (
        <div className="space-y-1.5">
          {unmatched.length > 0 && (
            <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/70">{unmatched.length} unmatched</p>
          )}
          {shown.map((row) => (
            <div key={row.id} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: "color-mix(in srgb, hsl(var(--muted)) 55%, hsl(var(--card)))" }}>
              <span className="w-24 shrink-0 text-xs">{row.date}</span>
              <span className="min-w-0 flex-1 truncate">{row.description}</span>
              <span className={`font-semibold ${row.amount >= 0 ? "text-emerald-700" : "text-red-600"}`}>{gbp(row.amount)}</span>
              {!row.matchedInvoiceId && !row.matchedBillId && canEdit && (
                <select
                  className="h-8 max-w-[10rem] rounded-lg border border-border bg-background text-xs"
                  defaultValue=""
                  onChange={(event) => {
                    const value = event.target.value;
                    event.target.value = "";
                    void matchRow(row, value);
                  }}
                >
                  <option value="">Match</option>
                  {row.amount > 0 && invoices.filter((invoice) => invoice.id && derivedInvoiceStatus(invoice) !== "paid" && invoice.kind !== "credit").map((invoice) => (
                    <option key={invoice.id} value={`inv:${invoice.id}`}>{invoice.number}</option>
                  ))}
                  {row.amount < 0 && bills.filter((bill) => bill.id && derivedBillStatus(bill) !== "paid").map((bill) => (
                    <option key={bill.id} value={`bill:${bill.id}`}>{bill.number}</option>
                  ))}
                </select>
              )}
              {(row.matchedInvoiceId || row.matchedBillId) && <span className="text-[10px] font-bold uppercase text-emerald-700">Matched</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

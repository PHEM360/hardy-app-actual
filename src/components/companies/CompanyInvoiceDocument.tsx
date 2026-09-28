import type { Company } from "@/types/app";
import type { CompanyBillingProfile, CompanyInvoice } from "@/types/companyHub";
import { INVOICE_STATUS_LABEL } from "@/types/companyHub";
import { amountDue, companyLetterLines, gbp } from "@/lib/companyInvoice";

export function CompanyInvoiceDocument({
  company,
  billing,
  invoice,
  kind = "invoice",
}: {
  company: Company;
  billing: CompanyBillingProfile;
  invoice: CompanyInvoice;
  kind?: "invoice" | "receipt";
}) {
  const due = amountDue(invoice);
  const letter = companyLetterLines(company, billing);
  const paid = invoice.status === "paid" || due <= 0;

  return (
    <article
      className="invoice-sheet mx-auto w-full max-w-[760px] bg-white text-slate-900 shadow-elevated"
      style={{ borderTop: `8px solid ${company.color || "#1e3a5f"}` }}
    >
      <header className="flex items-start justify-between gap-6 border-b border-slate-200 px-8 py-7">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {company.logoUrl ? (
              <img src={company.logoUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-lg text-xl" style={{ background: `${company.color}22` }}>
                {company.emoji || "🏢"}
              </div>
            )}
            <div>
              <p className="font-display text-xl font-bold tracking-tight">{company.name}</p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {kind === "receipt" ? "Receipt" : invoice.kind === "credit" ? "Credit note" : "Tax invoice"}
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-0.5 text-[12px] leading-5 text-slate-600">
            {letter.slice(1).map((line) => <p key={line}>{line}</p>)}
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-bold">{invoice.number}</p>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {paid ? "Paid" : INVOICE_STATUS_LABEL[invoice.status]}
          </p>
          <dl className="mt-3 space-y-1 text-[12px] text-slate-600">
            <div className="flex justify-end gap-3"><dt>Issued</dt><dd className="font-semibold text-slate-900">{fmtUk(invoice.issueDate)}</dd></div>
            <div className="flex justify-end gap-3"><dt>Due</dt><dd className="font-semibold text-slate-900">{fmtUk(invoice.dueDate)}</dd></div>
            {invoice.paidAt && <div className="flex justify-end gap-3"><dt>Paid</dt><dd className="font-semibold text-slate-900">{fmtUk(invoice.paidAt.slice(0, 10))}</dd></div>}
          </dl>
        </div>
      </header>

      <section className="grid gap-6 px-8 py-6 sm:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Bill to</p>
          <p className="mt-1 font-semibold">{invoice.customerName || "Customer"}</p>
          {invoice.customerEmail && <p className="text-sm text-slate-600">{invoice.customerEmail}</p>}
          {invoice.customerPhone && <p className="text-sm text-slate-600">{invoice.customerPhone}</p>}
          {invoice.customerAddress && <p className="whitespace-pre-wrap text-sm text-slate-600">{invoice.customerAddress}</p>}
        </div>
        <div className="rounded-xl bg-slate-50 p-4 text-right">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Amount {paid ? "paid" : "due"}</p>
          <p className="mt-1 font-display text-3xl font-bold">{gbp(paid ? invoice.total : due)}</p>
        </div>
      </section>

      <table className="w-full border-t border-slate-200 text-sm">
        <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <tr>
            <th className="px-8 py-3 text-left">Description</th>
            <th className="px-3 py-3 text-right">Qty</th>
            <th className="px-3 py-3 text-right">Unit</th>
            <th className="px-3 py-3 text-right">VAT</th>
            <th className="px-8 py-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines.map((line) => {
            const net = Number(line.quantity) * Number(line.unitPrice);
            const gross = net * (1 + Number(line.vatRate || 0) / 100);
            return (
              <tr key={line.id} className="border-t border-slate-100">
                <td className="px-8 py-3">{line.description || "Item"}</td>
                <td className="px-3 py-3 text-right">{line.quantity}</td>
                <td className="px-3 py-3 text-right">{gbp(line.unitPrice)}</td>
                <td className="px-3 py-3 text-right">{line.vatRate}%</td>
                <td className="px-8 py-3 text-right font-semibold">{gbp(gross)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <section className="flex justify-end px-8 py-5">
        <dl className="w-64 space-y-1 text-sm">
          <div className="flex justify-between"><dt className="text-slate-500">Subtotal</dt><dd>{gbp(invoice.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-slate-500">VAT</dt><dd>{gbp(invoice.vatTotal)}</dd></div>
          <div className="flex justify-between border-t border-slate-200 pt-2 font-bold"><dt>Total</dt><dd>{gbp(invoice.total)}</dd></div>
          {invoice.amountPaid > 0 && <div className="flex justify-between text-emerald-700"><dt>Paid</dt><dd>{gbp(invoice.amountPaid)}</dd></div>}
          {!paid && <div className="flex justify-between font-bold"><dt>Balance due</dt><dd>{gbp(due)}</dd></div>}
        </dl>
      </section>

      <footer className="space-y-3 border-t border-slate-200 px-8 py-6 text-[12px] text-slate-600">
        {invoice.notes && <p className="whitespace-pre-wrap">{invoice.notes}</p>}
        <div>
          <p className="font-semibold text-slate-800">Payment</p>
          {billing.bankName && <p>{billing.bankAccountName || company.name} · {billing.bankName}</p>}
          {billing.bankSortCode && <p>Sort code {billing.bankSortCode} · Account {billing.bankAccountNumber}</p>}
          {billing.bankIban && <p>IBAN {billing.bankIban}</p>}
          {billing.paymentInstructions && <p className="mt-1 whitespace-pre-wrap">{billing.paymentInstructions}</p>}
        </div>
        {billing.footerNote && <p>{billing.footerNote}</p>}
      </footer>
    </article>
  );
}

function fmtUk(iso: string) {
  const [y, m, d] = String(iso || "").split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

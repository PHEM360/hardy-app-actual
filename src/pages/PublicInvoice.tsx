import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { CompanyInvoiceDocument } from "@/components/companies/CompanyInvoiceDocument";
import { publicInvoiceApiUrl } from "@/lib/companyHubApi";
import { DEFAULT_BILLING_PROFILE } from "@/types/companyHub";
import type { Company } from "@/types/app";
import type { CompanyInvoice } from "@/types/companyHub";

export default function PublicInvoice() {
  const { companyId, invoiceId } = useParams<{ companyId: string; invoiceId: string }>();
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const [error, setError] = useState("");
  const [payload, setPayload] = useState<{
    company: Company;
    billing: typeof DEFAULT_BILLING_PROFILE;
    invoice: CompanyInvoice;
  } | null>(null);

  useEffect(() => {
    if (!companyId || !invoiceId || !token) {
      setError("This invoice link is missing details.");
      return;
    }
    void fetch(publicInvoiceApiUrl(companyId, invoiceId, token))
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Could not open this invoice");
        setPayload({
          company: { ...body.company, taxYearStart: "", contact: body.company.contact || {} },
          billing: { ...DEFAULT_BILLING_PROFILE, ...body.billing },
          invoice: { ...body.invoice, companyId, lines: body.invoice.lines || [], amountPaid: body.invoice.amountPaid || 0 },
        });
      })
      .catch((err: Error) => setError(err.message));
  }, [companyId, invoiceId, token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="max-w-md rounded-2xl bg-white p-6 text-center text-sm text-slate-700 shadow-card">{error}</p>
      </div>
    );
  }
  if (!payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <p className="text-sm text-slate-600">Loading invoice…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 py-8">
      <CompanyInvoiceDocument
        company={payload.company}
        billing={payload.billing}
        invoice={payload.invoice}
        kind={payload.invoice.status === "paid" ? "receipt" : "invoice"}
      />
      <p className="mx-auto mt-6 max-w-[760px] px-6 text-center text-xs text-slate-500">
        Pay using the bank details on this invoice. Card payments made on the company website update this page automatically.
      </p>
    </div>
  );
}

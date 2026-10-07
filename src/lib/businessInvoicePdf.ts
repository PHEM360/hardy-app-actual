import { jsPDF } from "jspdf";
import type { Company } from "@/types/app";
import type { BusinessInvoice } from "@/types/businessHub";
import { money } from "@/lib/businessHub";

function clean(value?: string) {
  return String(value || "").trim();
}

function issuerLabel(brand: Company, legal: Company) {
  if (brand.id && legal.id && brand.id !== legal.id) return `${legal.name} trading as ${brand.name}`;
  return legal.name || brand.name;
}

function addWrapped(doc: jsPDF, text: string, x: number, y: number, width: number, size = 9) {
  doc.setFontSize(size);
  const lines = doc.splitTextToSize(text, width);
  doc.text(lines, x, y);
  return y + lines.length * (size * 0.42 + 1.2);
}

export function downloadBusinessInvoicePdf(
  invoice: BusinessInvoice,
  brand: Company,
  legal: Company,
  kind: "invoice" | "receipt" = "invoice",
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const left = 18;
  const right = 192;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(brand.name, left, y);
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(issuerLabel(brand, legal), left, y);
  y += 5;

  const issuerBits = [
    clean(legal.contact.address),
    legal.contact.companyNumber ? `Company no. ${legal.contact.companyNumber}` : "",
    legal.contact.vatNumber ? `VAT ${legal.contact.vatNumber}` : "",
    clean(brand.contact.email || legal.contact.email),
    clean(brand.contact.phone || legal.contact.phone),
    clean(brand.contact.website || legal.contact.website),
  ].filter(Boolean);
  for (const bit of issuerBits) y = addWrapped(doc, bit, left, y, 90, 8.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(kind === "receipt" ? "RECEIPT" : "INVOICE", right, 20, { align: "right" });
  doc.setFontSize(10);
  doc.text(invoice.invoiceNumber, right, 27, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`Issue date: ${invoice.issueDate}`, right, 34, { align: "right" });
  doc.text(`Due date: ${invoice.dueDate}`, right, 39, { align: "right" });
  if (kind === "receipt" && invoice.paidAt) {
    doc.text(`Paid: ${invoice.paidAt.slice(0, 10)}`, right, 44, { align: "right" });
  }

  y = Math.max(y + 8, 62);
  doc.setDrawColor(210);
  doc.line(left, y, right, y);
  y += 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(kind === "receipt" ? "Received from" : "Bill to", left, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(invoice.recipient.name || "Recipient", left, y);
  y += 5;
  if (invoice.recipient.email) {
    doc.setFontSize(8.5);
    doc.text(invoice.recipient.email, left, y);
    y += 4.5;
  }
  if (invoice.recipient.address) y = addWrapped(doc, invoice.recipient.address, left, y, 90, 8.5);

  y += 8;
  const cols = { desc: left, qty: 125, unit: 145, vat: 166, total: right };
  doc.setFillColor(245, 245, 245);
  doc.rect(left, y - 5, right - left, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("Description", cols.desc, y);
  doc.text("Qty", cols.qty, y, { align: "right" });
  doc.text("Unit", cols.unit, y, { align: "right" });
  doc.text("VAT", cols.vat, y, { align: "right" });
  doc.text("Total", cols.total, y, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  const lines = invoice.lineItems.length ? invoice.lineItems : [{
    id: "summary",
    description: kind === "receipt" ? "Payment received" : "Invoice total",
    quantity: 1,
    unitPrice: invoice.subtotal || invoice.total,
    vatRate: invoice.subtotal ? (invoice.vatAmount / invoice.subtotal) * 100 : 0,
  }];

  for (const line of lines) {
    if (y > 255) {
      doc.addPage();
      y = 22;
    }
    const lineTotal = (Number(line.quantity) || 0) * (Number(line.unitPrice) || 0) * (1 + (Number(line.vatRate) || 0) / 100);
    const wrapped = doc.splitTextToSize(line.description || "Item", 95);
    doc.setFontSize(8.5);
    doc.text(wrapped, cols.desc, y);
    doc.text(String(line.quantity || 0), cols.qty, y, { align: "right" });
    doc.text(money(Number(line.unitPrice) || 0), cols.unit, y, { align: "right" });
    doc.text(`${Number(line.vatRate) || 0}%`, cols.vat, y, { align: "right" });
    doc.text(money(lineTotal), cols.total, y, { align: "right" });
    y += Math.max(7, wrapped.length * 4.2 + 2);
    doc.setDrawColor(235);
    doc.line(left, y - 2.5, right, y - 2.5);
  }

  y += 6;
  const labelX = 150;
  doc.setFontSize(9);
  doc.text("Subtotal", labelX, y, { align: "right" });
  doc.text(money(invoice.subtotal), right, y, { align: "right" });
  y += 5;
  doc.text("VAT", labelX, y, { align: "right" });
  doc.text(money(invoice.vatAmount), right, y, { align: "right" });
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(kind === "receipt" ? "Amount received" : "Total", labelX, y, { align: "right" });
  doc.text(money(kind === "receipt" ? invoice.amountPaid || invoice.total : invoice.total), right, y, { align: "right" });

  if (kind === "invoice" && invoice.amountPaid > 0 && invoice.amountPaid < invoice.total) {
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("Paid to date", labelX, y, { align: "right" });
    doc.text(money(invoice.amountPaid), right, y, { align: "right" });
    y += 5;
    doc.text("Balance due", labelX, y, { align: "right" });
    doc.text(money(Math.max(0, invoice.total - invoice.amountPaid)), right, y, { align: "right" });
  }

  if (invoice.notes) {
    y = Math.max(y + 14, 215);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Notes", left, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    y = addWrapped(doc, invoice.notes, left, y, 174, 8.5);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(110);
  doc.text(
    `${issuerLabel(brand, legal)} · Reference ${invoice.invoiceNumber}`,
    left,
    287,
  );

  const safe = invoice.invoiceNumber.replace(/[^A-Za-z0-9_-]+/g, "-");
  doc.save(`${kind === "receipt" ? "Receipt" : "Invoice"}-${safe}.pdf`);
}

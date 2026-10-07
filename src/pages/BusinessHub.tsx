import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Banknote,
  Building2,
  CheckCircle2,
  CircleAlert,
  FileText,
  Inbox,
  Landmark,
  Megaphone,
  Plus,
  RefreshCw,
  Settings2,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import BusinessIntegrationDialog from "@/components/companies/BusinessIntegrationDialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useBusinessHub } from "@/hooks/useBusinessHub";
import type {
  BusinessIntegrationProvider,
  BusinessInvoice,
  BusinessInvoiceLine,
  BusinessLeadStatus,
} from "@/types/businessHub";
import { companyTotals, invoiceStatus, legalEntityForCompany, money, totalBusiness } from "@/lib/businessHub";
import { downloadBusinessInvoicePdf } from "@/lib/businessInvoicePdf";
import { approveMarketingContent } from "@/lib/marketingApi";
import { toast } from "sonner";

type Tab = "overview" | "invoices" | "banking" | "leads" | "content" | "compliance" | "integrations";

const TABS: Array<{ id: Tab; label: string; icon: typeof Building2 }> = [
  { id: "overview", label: "Overview", icon: Building2 },
  { id: "invoices", label: "Invoices", icon: FileText },
  { id: "banking", label: "Banking", icon: Landmark },
  { id: "leads", label: "Leads & forms", icon: Inbox },
  { id: "content", label: "Content", icon: Megaphone },
  { id: "compliance", label: "Tax & filings", icon: FileText },
  { id: "integrations", label: "Integrations", icon: Settings2 },
];

const emptyLine = (): BusinessInvoiceLine => ({
  id: crypto.randomUUID(),
  description: "",
  quantity: 1,
  unitPrice: 0,
  vatRate: 0,
});

function Metric({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  helper?: string;
  icon: typeof Building2;
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
          <p className={`mt-2 font-display text-2xl font-bold ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-destructive" : "text-foreground"}`}>
            {value}
          </p>
          {helper && <p className="mt-1 text-[11px] text-muted-foreground">{helper}</p>}
        </div>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/70">
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

function statusClass(status: string) {
  if (status === "paid" || status === "converted" || status === "published") return "bg-emerald-500/10 text-emerald-700";
  if (status === "overdue" || status === "failed" || status === "spam") return "bg-destructive/10 text-destructive";
  if (status === "draft" || status === "new" || status === "suggestion") return "bg-muted text-muted-foreground";
  return "bg-primary/10 text-primary";
}

function InvoiceDialog({
  open,
  onOpenChange,
  companies,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Array<{ id?: string; name: string }>;
  onCreate: ReturnType<typeof useBusinessHub>["createInvoice"];
}) {
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<BusinessInvoiceLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCompanyId("");
    setName("");
    setEmail("");
    setAddress("");
    setDueDate("");
    setNotes("");
    setLines([emptyLine()]);
  };

  const save = async () => {
    if (!companyId || !name.trim() || !lines.some((line) => line.description.trim() && line.unitPrice > 0)) {
      toast.error("Choose a company, recipient and at least one priced line item.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        companyId,
        recipient: { name: name.trim(), email: email.trim() || undefined, address: address.trim() || undefined },
        dueDate: dueDate || undefined,
        notes,
        lineItems: lines.filter((line) => line.description.trim()),
      });
      toast.success("Invoice draft created");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create invoice.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>Create invoice</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Trading business</Label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger><SelectValue placeholder="Choose company…" /></SelectTrigger>
                <SelectContent>{companies.filter((c) => c.id).map((company) => (
                  <SelectItem key={company.id} value={company.id!}>{company.name}</SelectItem>
                ))}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Due date</Label>
              <Input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Recipient</Label>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Client / patient / organisation" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="accounts@example.com" />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Billing address</Label>
              <Textarea value={address} onChange={(event) => setAddress(event.target.value)} rows={2} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Line items</Label>
              <Button type="button" variant="outline" size="sm" onClick={() => setLines((current) => [...current, emptyLine()])}>
                <Plus className="mr-1 h-3.5 w-3.5" /> Add line
              </Button>
            </div>
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 rounded-xl border border-border/50 bg-muted/20 p-2">
                  <Input
                    className="col-span-12 sm:col-span-5"
                    value={line.description}
                    placeholder="Description"
                    onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, description: event.target.value } : item))}
                  />
                  <Input
                    className="col-span-3 sm:col-span-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.quantity}
                    onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: Number(event.target.value) } : item))}
                  />
                  <Input
                    className="col-span-4 sm:col-span-2"
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unitPrice}
                    placeholder="£"
                    onChange={(event) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, unitPrice: Number(event.target.value) } : item))}
                  />
                  <Select
                    value={String(line.vatRate)}
                    onValueChange={(value) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, vatRate: Number(value) } : item))}
                  >
                    <SelectTrigger className="col-span-4 sm:col-span-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0% VAT</SelectItem>
                      <SelectItem value="5">5% VAT</SelectItem>
                      <SelectItem value="20">20% VAT</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="col-span-1"
                    disabled={lines.length === 1}
                    onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Invoice notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Payment reference, terms or note to recipient" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create draft"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ArticleDialog({
  open,
  onOpenChange,
  companies,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companies: Array<{ id?: string; name: string }>;
  onCreate: ReturnType<typeof useBusinessHub>["createWebsiteArticle"];
}) {
  const [companyId, setCompanyId] = useState("");
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setCompanyId("");
    setTitle("");
    setExcerpt("");
    setBody("");
    setTags("");
  };

  const save = async () => {
    if (!companyId || !title.trim() || !body.trim()) {
      toast.error("Choose a business and add an article title and body.");
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        companyId,
        title,
        body,
        excerpt,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      });
      toast.success("Article created and sent for approval");
      reset();
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the article.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { onOpenChange(value); if (!value) reset(); }}>
      <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto rounded-2xl">
        <DialogHeader><DialogTitle>New website article</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Website / business</Label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Choose business…" /></SelectTrigger>
              <SelectContent>
                {companies.filter((company) => company.id).map((company) => (
                  <SelectItem key={company.id} value={company.id!}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Article headline" />
          </div>
          <div className="space-y-1.5">
            <Label>Short introduction / excerpt</Label>
            <Textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} rows={2} placeholder="Optional summary shown on article lists" />
          </div>
          <div className="space-y-1.5">
            <Label>Article</Label>
            <Textarea value={body} onChange={(event) => setBody(event.target.value)} rows={14} placeholder="Write or paste the full article here…" />
          </div>
          <div className="space-y-1.5">
            <Label>Tags</Label>
            <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="ADHD, autism, work — comma separated" />
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs leading-relaxed text-foreground/75">
            The article enters Hardy's existing approval/versioning workflow. Once approved, publishing uses the site's signed server endpoint rather than direct database credentials.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? "Creating…" : "Create article"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BusinessHub() {
  const hub = useBusinessHub();
  const [tab, setTab] = useState<Tab>("overview");
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [articleOpen, setArticleOpen] = useState(false);
  const [integrationCompanyId, setIntegrationCompanyId] = useState<string | null>(null);
  const [companyFilter, setCompanyFilter] = useState("all");

  const visibleRows = useMemo(
    () => companyFilter === "all" ? hub.rows : hub.rows.filter((row) => row.company.id === companyFilter),
    [companyFilter, hub.rows],
  );
  const totals = useMemo(() => totalBusiness(visibleRows), [visibleRows]);
  const invoices = useMemo(
    () => visibleRows.flatMap((row) => row.invoices).sort((a, b) => (b.issueDate || "").localeCompare(a.issueDate || "")),
    [visibleRows],
  );
  const leads = useMemo(
    () => visibleRows.flatMap((row) => row.leads).sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || "")),
    [visibleRows],
  );
  const content = useMemo(
    () => visibleRows.flatMap((row) => row.content).sort((a, b) => (b.scheduledFor || "").localeCompare(a.scheduledFor || "")),
    [visibleRows],
  );
  const bankAccounts = useMemo(
    () => visibleRows.flatMap((row) => row.bankAccounts),
    [visibleRows],
  );
  const bankTransactions = useMemo(
    () => visibleRows
      .flatMap((row) => row.bankTransactions)
      .sort((a, b) => (b.timestamp || "").localeCompare(a.timestamp || "")),
    [visibleRows],
  );
  const bankBalance = bankAccounts.reduce((sum, account) => sum + (Number(account.current) || 0), 0);
  const integrationRow = hub.rows.find((row) => row.company.id === integrationCompanyId) || null;

  const publishArticle = async (item: (typeof content)[number]) => {
    if (!item.id) return;
    try {
      if (item.status === "awaiting_approval") {
        await approveMarketingContent(item.companyId, item.id, item.approvalVersion);
      } else if (item.status !== "approved" && item.status !== "scheduled") {
        toast.error("This article must be awaiting approval or already approved before publishing.");
        return;
      }
      const published = await hub.publishWebsiteArticle(item.companyId, item.id);
      toast.success("Article published");
      if (published.externalPostUrl) {
        window.open(published.externalPostUrl, "_blank", "noopener,noreferrer");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not publish the article.");
    }
  };

  const downloadDocument = (invoice: BusinessInvoice, kind: "invoice" | "receipt") => {
    const brand = hub.companies.find((company) => company.id === invoice.companyId);
    if (!brand) {
      toast.error("Business details are missing for this invoice.");
      return;
    }
    const legal = invoice.legalEntityCompanyId
      ? hub.companies.find((company) => company.id === invoice.legalEntityCompanyId) || legalEntityForCompany(brand, hub.companies)
      : legalEntityForCompany(brand, hub.companies);
    downloadBusinessInvoicePdf(invoice, brand, legal, kind);
  };

  return (
    <FeaturePageShell
      title="Business Hub"
      subtitle="Finance, invoicing, leads, content and cross-company oversight"
      icon={<Landmark className="h-5 w-5" />}
      sharePage="companies"
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-xl" onClick={() => void hub.reload()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Refresh
          </Button>
          <Button size="sm" className="rounded-xl" onClick={() => setInvoiceOpen(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Invoice
          </Button>
        </div>
      }
    >
      <InvoiceDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} companies={hub.companies} onCreate={hub.createInvoice} />
      <ArticleDialog open={articleOpen} onOpenChange={setArticleOpen} companies={hub.companies} onCreate={hub.createWebsiteArticle} />
      <BusinessIntegrationDialog
        company={integrationRow?.company || null}
        existing={integrationRow?.integrations[0]}
        open={!!integrationRow}
        onOpenChange={(value) => { if (!value) setIntegrationCompanyId(null); }}
        onSave={hub.saveIntegration}
      />

      <div className="space-y-4 px-1 pb-8">
        <div className="rounded-2xl border border-border/50 bg-card p-2 shadow-card">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-1 overflow-x-auto">
              {TABS.map((item) => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTab(item.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {item.label}
                  </button>
                );
              })}
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="h-9 w-full rounded-xl md:w-56"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All businesses</SelectItem>
                {hub.companies.filter((company) => company.id).map((company) => (
                  <SelectItem key={company.id} value={company.id!}>{company.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {hub.error && (
          <div className="flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div><p className="font-semibold">Some business data could not be loaded.</p><p className="mt-1 text-xs">{hub.error}</p></div>
          </div>
        )}

        {hub.loading ? (
          <div className="rounded-2xl border border-border/50 bg-card p-12 text-center text-sm text-muted-foreground">Loading the business picture…</div>
        ) : tab === "overview" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric label="Recorded income" value={money(totals.income)} helper="Cash/income ledger" icon={TrendingUp} tone="good" />
              <Metric label="Expenditure" value={money(totals.expenses)} helper="Recorded business expenses" icon={TrendingDown} />
              <Metric label="Net position" value={money(totals.profit)} helper="Income less expenditure" icon={Banknote} tone={totals.profit >= 0 ? "good" : "bad"} />
              <Metric label="Outstanding invoices" value={money(totals.outstanding)} helper={totals.overdue ? `${money(totals.overdue)} overdue` : "Nothing overdue"} icon={WalletCards} tone={totals.overdue > 0 ? "bad" : "neutral"} />
            </div>

            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
              <section className="rounded-2xl border border-border/50 bg-card shadow-card">
                <div className="border-b border-border/40 px-4 py-3">
                  <h2 className="font-display font-bold">Business performance</h2>
                  <p className="text-xs text-muted-foreground">Legal entities and trading brands stay separate but roll up here for management oversight.</p>
                </div>
                <div className="divide-y divide-border/40">
                  {visibleRows.map((row) => {
                    const stats = companyTotals(row);
                    const parent = row.company.parentCompanyId ? hub.companies.find((company) => company.id === row.company.parentCompanyId) : null;
                    return (
                      <div key={row.company.id} className="grid gap-3 px-4 py-4 md:grid-cols-[1.25fr_repeat(4,0.7fr)] md:items-center">
                        <div>
                          <Link to={`/companies/${row.company.id}`} className="font-semibold hover:text-primary">{row.company.name}</Link>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {row.company.companyType === "trading_name" && parent ? `Trading name of ${parent.name}` : row.company.companyType?.replace("_", " ") || "Business"}
                          </p>
                        </div>
                        <div><p className="text-[10px] uppercase text-muted-foreground">Income</p><p className="text-sm font-semibold">{money(stats.income)}</p></div>
                        <div><p className="text-[10px] uppercase text-muted-foreground">Expenses</p><p className="text-sm font-semibold">{money(stats.expenses)}</p></div>
                        <div><p className="text-[10px] uppercase text-muted-foreground">Net</p><p className={`text-sm font-semibold ${stats.profit >= 0 ? "text-emerald-600" : "text-destructive"}`}>{money(stats.profit)}</p></div>
                        <div><p className="text-[10px] uppercase text-muted-foreground">Due</p><p className="text-sm font-semibold">{money(stats.outstanding)}</p></div>
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-3">
                <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
                  <div className="flex items-center justify-between">
                    <div><h2 className="font-display font-bold">Action centre</h2><p className="text-xs text-muted-foreground">Items needing attention</p></div>
                    <CircleAlert className="h-4 w-4 text-amber-500" />
                  </div>
                  <div className="mt-3 space-y-2 text-sm">
                    <button onClick={() => setTab("invoices")} className="flex w-full items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 text-left">
                      <span>Overdue invoices</span><strong>{money(totals.overdue)}</strong>
                    </button>
                    <button onClick={() => setTab("leads")} className="flex w-full items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 text-left">
                      <span>Open leads / enquiries</span><strong>{totals.openLeads}</strong>
                    </button>
                    <button onClick={() => setTab("content")} className="flex w-full items-center justify-between rounded-xl bg-muted/40 px-3 py-2.5 text-left">
                      <span>Scheduled content</span><strong>{content.filter((item) => item.status === "scheduled").length}</strong>
                    </button>
                  </div>
                </div>
                <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Accounting principle</p>
                  <p className="mt-2 text-xs leading-relaxed text-foreground/75">
                    Invoices track what is owed; the existing income ledger remains the cash/recognised-income view. This avoids double counting the same sale. The all-business total is a management view only: BGM Health Ltd and the sole-trader businesses remain separate for tax and filing.
                  </p>
                </div>
              </section>
            </div>
          </>
        ) : tab === "invoices" ? (
          <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
            <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
              <div><h2 className="font-display font-bold">Invoice register</h2><p className="text-xs text-muted-foreground">{invoices.length} invoices across the selected businesses</p></div>
              <Button size="sm" onClick={() => setInvoiceOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" /> New invoice</Button>
            </div>
            {!invoices.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No invoices yet.</div>
            ) : (
              <div className="divide-y divide-border/40">
                {invoices.map((invoice) => {
                  const status = invoiceStatus(invoice);
                  const company = hub.companies.find((item) => item.id === invoice.companyId);
                  return (
                    <div key={invoice.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_1.1fr_0.7fr_0.7fr_auto] md:items-center">
                      <div><p className="font-mono text-xs font-semibold">{invoice.invoiceNumber}</p><p className="text-[11px] text-muted-foreground">{company?.name || "Business"} · {invoice.source}</p></div>
                      <div><p className="text-sm font-semibold">{invoice.recipient.name}</p><p className="text-[11px] text-muted-foreground">{invoice.recipient.email || "No email"}</p></div>
                      <div><p className="text-xs text-muted-foreground">Due {invoice.dueDate}</p><p className="text-sm font-semibold">{money(invoice.total)}</p></div>
                      <div><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${statusClass(status)}`}>{status.replace("_", " ")}</span></div>
                      <div className="flex flex-wrap justify-end gap-1">
                        {status === "draft" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void hub.updateInvoice(invoice, { status: "issued" }).then(() => toast.success("Invoice issued")).catch((error) => toast.error(error.message))}
                          >
                            Issue
                          </Button>
                        )}
                        {status !== "paid" && status !== "void" && status !== "written_off" && (
                          <Button size="sm" variant="outline" onClick={() => void hub.markInvoicePaid(invoice).then(() => toast.success("Invoice marked paid")).catch((error) => toast.error(error.message))}>Mark paid</Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => downloadDocument(invoice, "invoice")}>PDF</Button>
                        {status === "paid" && <Button size="sm" variant="ghost" onClick={() => downloadDocument(invoice, "receipt")}>Receipt</Button>}
                        {status !== "paid" && status !== "void" && status !== "written_off" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive"
                            onClick={() => void hub.updateInvoice(invoice, { status: "void" }).then(() => toast.success("Invoice voided")).catch((error) => toast.error(error.message))}
                          >
                            Void
                          </Button>
                        )}
                        {invoice.externalUrl && <Button size="icon" variant="ghost" asChild><a href={invoice.externalUrl} target="_blank" rel="noreferrer"><ArrowUpRight className="h-4 w-4" /></a></Button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : tab === "banking" ? (
          <section className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Bank balance" value={money(bankBalance)} helper="Across connected business accounts" icon={Landmark} />
              <Metric label="Connected accounts" value={String(bankAccounts.length)} helper="Milion feeds appear after sync" icon={WalletCards} />
              <Metric
                label="Recent transactions"
                value={String(bankTransactions.length)}
                helper="Current downloaded feed"
                icon={RefreshCw}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-[0.8fr_1.4fr]">
              <div className="rounded-2xl border border-border/50 bg-card shadow-card">
                <div className="border-b border-border/40 px-4 py-3">
                  <h2 className="font-display font-bold">Accounts</h2>
                  <p className="text-xs text-muted-foreground">Balances are feed snapshots, not a substitute for reconciliation.</p>
                </div>
                {!bankAccounts.length ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No business bank feed is connected for this selection.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {bankAccounts.map((account) => {
                      const company = hub.companies.find((item) => item.id === account.companyId);
                      return (
                        <div key={account.id} className="flex items-center justify-between gap-3 px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{account.name}</p>
                            <p className="text-[10px] text-muted-foreground">{company?.name || "Business"} · {account.provider}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold">{money(account.current)}</p>
                            {account.available != null && account.available !== account.current && (
                              <p className="text-[10px] text-muted-foreground">{money(account.available)} available</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
                <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
                  <div>
                    <h2 className="font-display font-bold">Bank activity</h2>
                    <p className="text-xs text-muted-foreground">Latest transactions from connected feeds.</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => setTab("integrations")}>Manage feeds</Button>
                </div>
                {!bankTransactions.length ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">No bank transactions have been synced yet.</div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {bankTransactions.slice(0, 80).map((tx) => {
                      const company = hub.companies.find((item) => item.id === tx.companyId);
                      return (
                        <div key={tx.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{tx.description}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {company?.name || "Business"} · {tx.accountName || tx.accountId} · {tx.timestamp ? new Date(tx.timestamp).toLocaleDateString("en-GB") : ""}
                            </p>
                          </div>
                          <p className={`text-sm font-bold ${tx.amount >= 0 ? "text-emerald-600" : "text-foreground"}`}>
                            {tx.amount >= 0 ? "+" : ""}{money(tx.amount)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs leading-relaxed text-foreground/75">
              <strong className="text-foreground">Reconciliation model:</strong> bank transactions are evidence of cash movement; they are kept separate from invoices and expenses until matched. Milion-linked bank feeds are read from Milion so BGM Medical/Gwynology do not develop a second bank ledger in Hardy.
            </div>
          </section>
        ) : tab === "leads" ? (
          <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
            <div className="border-b border-border/40 px-4 py-3"><h2 className="font-display font-bold">Leads, sign-ups & contact forms</h2><p className="text-xs text-muted-foreground">One inbox for enquiries captured by connected websites and forms.</p></div>
            {!leads.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No lead records have been ingested yet.</div>
            ) : (
              <div className="divide-y divide-border/40">
                {leads.map((lead) => {
                  const company = hub.companies.find((item) => item.id === lead.companyId);
                  return (
                    <div key={lead.id} className="grid gap-3 px-4 py-3 md:grid-cols-[1fr_1.2fr_0.6fr_0.7fr] md:items-center">
                      <div><p className="text-sm font-semibold">{lead.name}</p><p className="text-[11px] text-muted-foreground">{lead.email || lead.phone || "No contact detail"}</p></div>
                      <div><p className="text-xs font-medium">{lead.subject || "General enquiry"}</p><p className="line-clamp-1 text-[11px] text-muted-foreground">{lead.message || lead.source}</p></div>
                      <div><p className="text-xs">{company?.name || "Business"}</p><p className="text-[10px] text-muted-foreground">{lead.source}</p></div>
                      <Select value={lead.status} onValueChange={(value) => void hub.updateLead(lead, { status: value as BusinessLeadStatus })}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{["new","contacted","qualified","converted","closed","spam"].map((value) => <SelectItem key={value} value={value}>{value.replace("_"," ")}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        ) : tab === "content" ? (
          <section className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/40 px-4 py-3">
              <div><h2 className="font-display font-bold">Content & publishing</h2><p className="text-xs text-muted-foreground">Social posts, articles and website content from the existing marketing system.</p></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => setArticleOpen(true)}><Plus className="mr-1 h-3.5 w-3.5" /> New article</Button>
                <Button size="sm" variant="outline" asChild><Link to="/companies/social">Open content studio <ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button>
              </div>
            </div>
            {!content.length ? (
              <div className="p-10 text-center text-sm text-muted-foreground">No content records yet.</div>
            ) : (
              <div className="divide-y divide-border/40">
                {content.slice(0, 100).map((item) => (
                  <div key={`${item.companyId}:${item.id}`} className="grid gap-3 px-4 py-3 md:grid-cols-[0.7fr_1.6fr_0.7fr_0.7fr_auto] md:items-center">
                    <div><p className="text-xs font-semibold">{item.companyName}</p><p className="text-[10px] text-muted-foreground capitalize">{item.platform} · {item.type.replace("_"," ")}</p></div>
                    <div><p className="text-sm font-medium">{item.topic || item.draft?.slice(0, 80) || "Untitled content"}</p><p className="line-clamp-1 text-[11px] text-muted-foreground">{item.refinedDraft || item.draft}</p></div>
                    <div><p className="text-xs">{item.scheduledFor ? new Date(item.scheduledFor).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Not scheduled"}</p></div>
                    <div><span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${statusClass(item.status)}`}>{item.status.replace("_"," ")}</span></div>
                    <div className="flex justify-end gap-1">
                      {item.platform === "website" && item.type === "article" && ["awaiting_approval", "approved", "scheduled"].includes(item.status) && (
                        <Button size="sm" variant="outline" onClick={() => void publishArticle(item)}>
                          {item.status === "awaiting_approval" ? <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Approve & publish</> : "Publish"}
                        </Button>
                      )}
                      {item.platform === "website" && item.type === "article" && item.status === "published" && item.externalPostUrl && (
                        <Button size="icon" variant="ghost" asChild>
                          <a href={item.externalPostUrl} target="_blank" rel="noreferrer"><ArrowUpRight className="h-4 w-4" /></a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : tab === "compliance" ? (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
              <h2 className="font-display font-bold">Tax & filing overview</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Filing records are shown per legal taxpayer. Trading names inherit the filing identity of their parent legal entity.
              </p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {visibleRows.map((row) => {
                const parent = row.company.parentCompanyId
                  ? hub.companies.find((company) => company.id === row.company.parentCompanyId)
                  : null;
                const legal = row.company.companyType === "trading_name" && parent ? parent : row.company;
                const legalRow = visibleRows.find((candidate) => candidate.company.id === legal.id) || hub.rows.find((candidate) => candidate.company.id === legal.id);
                const returns = legalRow?.taxReturns || [];
                const latest = returns[0];
                const duplicateTradingName = legal.id !== row.company.id;
                return (
                  <div key={row.company.id} className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold">{row.company.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {duplicateTradingName ? `Files under ${legal.name}` : row.company.companyType === "sole_trader" ? "Sole trader" : row.company.companyType === "registered" ? "Registered company" : "Business"}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <Link to={`/companies/${legal.id}`}>Open record</Link>
                      </Button>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-muted/40 p-3">
                        <p className="text-[10px] uppercase text-muted-foreground">Tax year starts</p>
                        <p className="mt-1 font-semibold">{legal.taxYearStart || "Not set"}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3">
                        <p className="text-[10px] uppercase text-muted-foreground">Returns held</p>
                        <p className="mt-1 font-semibold">{returns.length}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3">
                        <p className="text-[10px] uppercase text-muted-foreground">Latest return</p>
                        <p className="mt-1 font-semibold">{latest?.taxYear || "None recorded"}</p>
                      </div>
                      <div className="rounded-xl bg-muted/40 p-3">
                        <p className="text-[10px] uppercase text-muted-foreground">Tax paid</p>
                        <p className="mt-1 font-semibold">{latest?.taxPaid == null ? "—" : money(Number(latest.taxPaid))}</p>
                      </div>
                    </div>
                    {latest?.filingDate && <p className="mt-3 text-[11px] text-muted-foreground">Latest filing date recorded: {latest.filingDate}</p>}
                  </div>
                );
              })}
            </div>
            <div className="rounded-2xl border border-amber-300/50 bg-amber-50/60 p-4 text-xs leading-relaxed text-amber-950 dark:bg-amber-950/20 dark:text-amber-100">
              This screen deliberately does not auto-submit HMRC or Companies House returns. It is a management/completeness view; filing data should be reconciled to the relevant legal entity and reviewed before submission.
            </div>
          </section>
        ) : (
          <section className="space-y-4">
            <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-4">
                <div><h2 className="font-display font-bold">Connected systems</h2><p className="text-xs text-muted-foreground">Each business can keep its own providers while Hardy provides the oversight layer.</p></div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={hub.syncingMilion}
                  onClick={() => void hub.syncMilion().then(() => toast.success("Milion sync finished")).catch((error) => toast.error(error.message))}
                >
                  <RefreshCw className={`mr-1 h-3.5 w-3.5 ${hub.syncingMilion ? "animate-spin" : ""}`} /> Sync Milion
                </Button>
              </div>
              <div className="mt-4 space-y-2">
                {visibleRows.map((row) => (
                  <div key={row.company.id} className="rounded-xl border border-border/40 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{row.company.name}</p>
                        <p className="text-[11px] text-muted-foreground">{row.integrations.length ? `${row.integrations.length} configured connector(s)` : "No connectors configured"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button size="sm" variant="outline" className="h-7 rounded-lg px-2 text-[10px]" onClick={() => setIntegrationCompanyId(row.company.id || null)}>Configure</Button>
                        {(["milion","stripe","xero","tide","website"] as BusinessIntegrationProvider[]).map((provider) => {
                          const configured = row.integrations.find((item) => item.provider === provider && item.enabled);
                          return <span key={provider} className={`rounded-full px-2 py-1 text-[10px] font-semibold capitalize ${configured ? "bg-emerald-500/10 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{provider}{configured ? " · on" : ""}</span>;
                        })}
                      </div>
                    </div>
                    {row.integrations.map((integration) => (
                      <div key={integration.id || integration.provider} className="mt-2 flex items-center justify-between rounded-lg bg-muted/35 px-3 py-2 text-xs">
                        <span className="capitalize">{integration.provider}{integration.label ? ` · ${integration.label}` : ""}</span>
                        <span className={integration.lastError ? "text-destructive" : "text-muted-foreground"}>{integration.lastError || (integration.lastSyncAt ? `Synced ${new Date(integration.lastSyncAt).toLocaleString("en-GB")}` : integration.externalId || "Configured")}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-border/50 bg-card p-4"><WalletCards className="h-4 w-4" /><p className="mt-3 text-sm font-semibold">Payments</p><p className="mt-1 text-xs text-muted-foreground">Stripe events should update the matching invoice, then feed the ledger once reconciled.</p></div>
              <div className="rounded-2xl border border-border/50 bg-card p-4"><Landmark className="h-4 w-4" /><p className="mt-3 text-sm font-semibold">Banking</p><p className="mt-1 text-xs text-muted-foreground">Tide / open-banking feeds belong in a reconciliation queue, not directly in profit until categorised.</p></div>
              <div className="rounded-2xl border border-border/50 bg-card p-4"><Users className="h-4 w-4" /><p className="mt-3 text-sm font-semibold">Websites & forms</p><p className="mt-1 text-xs text-muted-foreground">Website connectors can push sign-ups, contact forms and published-content events into this hub.</p></div>
            </div>
          </section>
        )}
      </div>
    </FeaturePageShell>
  );
}

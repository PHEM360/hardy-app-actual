import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCompanyLeads } from "@/hooks/useCompanyHub";
import { companyIngestUrl } from "@/lib/companyHubApi";
import type { Company } from "@/types/app";
import type { CompanyLeadStatus } from "@/types/companyHub";

const STATUS: CompanyLeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

export function CompanyLeadsPanel({ company, canEdit }: { company: Company; canEdit: boolean }) {
  const { leads, addLead, updateLead } = useCompanyLeads(company.id);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-4">
      <div
        className="rounded-2xl border border-border/50 p-4 shadow-card"
        style={{ background: `color-mix(in srgb, ${company.color} 12%, hsl(var(--card)))`, borderLeft: `4px solid ${company.color}` }}
      >
        <p className="font-display font-bold">Leads inbox</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Contact forms, account requests and sign ups from the company website arrive here. POST JSON to {companyIngestUrl("lead")} with header X-Company-Key.
        </p>
      </div>

      {canEdit && (
        <div className="grid gap-2 rounded-2xl border border-border/50 bg-card p-4 shadow-card sm:grid-cols-2">
          <Input placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
          <Input placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
          <Textarea className="sm:col-span-2" placeholder="Message" value={message} onChange={(event) => setMessage(event.target.value)} />
          <Button
            className="rounded-xl bg-gradient-primary sm:col-span-2"
            onClick={async () => {
              if (!name.trim()) return;
              await addLead({ source: "manual", status: "new", name: name.trim(), email, message });
              setName(""); setEmail(""); setMessage("");
              toast.success("Lead added");
            }}
          >
            <Plus className="mr-1 h-4 w-4" /> Add lead
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {leads.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No leads yet.</p>}
        {leads.map((lead) => (
          <div key={lead.id} className="rounded-2xl border border-border/50 bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{lead.name}</p>
                <p className="text-xs text-muted-foreground">{lead.email || "No email"} · {lead.source.replace("_", " ")}</p>
              </div>
              <select
                className="h-9 rounded-xl border border-border bg-background px-2 text-xs font-semibold"
                value={lead.status}
                disabled={!canEdit}
                onChange={(event) => lead.id && void updateLead(lead.id, { status: event.target.value as CompanyLeadStatus })}
              >
                {STATUS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            {lead.message && <p className="mt-2 whitespace-pre-wrap text-sm">{lead.message}</p>}
            {lead.pageUrl && <a href={lead.pageUrl} className="mt-2 inline-block text-xs font-semibold text-primary" target="_blank" rel="noreferrer">{lead.pageUrl}</a>}
          </div>
        ))}
      </div>
    </div>
  );
}

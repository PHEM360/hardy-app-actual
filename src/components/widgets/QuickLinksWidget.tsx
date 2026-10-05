import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare2, Receipt, KeyRound, CalendarPlus, ListPlus, Wallet, FileUp, Zap, Pencil, Home, StickyNote, Mail } from "lucide-react";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { AddExpenseDocumentDialog } from "@/components/capture/AddExpenseDocumentDialog";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { hasFeatureAccess, QUICK_LINK_FEATURE_KEY } from "@/lib/features";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const ALL_LINKS = [
  { id: "today",       icon: CheckSquare2, label: "Today",      sub: "Focus list", accent: "#d39a34", href: "/today" },
  { id: "expense",     icon: Receipt,      label: "Add expense or document", sub: "Capture it now and sort it later", accent: "#31506f", featured: true, action: "expense" as const },
  { id: "logins",      icon: KeyRound,     label: "Log Ins",    sub: "Credentials", accent: "#73638f", href: "/login-details" },
  { id: "event",       icon: CalendarPlus, label: "New Event",  sub: "Calendar", accent: "#4d6f9c", href: "/calendar" },
  { id: "task",        icon: ListPlus,     label: "Add Task",   sub: "Tasks", accent: "#477b6a", href: "/tasks" },
  { id: "note",        icon: StickyNote,   label: "Add Note",   sub: "New note", accent: "#b18338", href: "/notes?new=1" },
  { id: "email",       icon: Mail,         label: "Email",      sub: "Inbox", accent: "#58698d", href: "/email" },
  { id: "finance",     icon: Wallet,       label: "Finance",    sub: "Personal", accent: "#315f63", href: "/finance" },
  { id: "hh-finance",  icon: Home,         label: "HH Finance", sub: "Household", accent: "#4d765d", href: "/household-finance" },
  { id: "upload",      icon: FileUp,       label: "Upload",     sub: "Documents", accent: "#47738a", action: "upload" as const },
];

const DEFAULT_LINK_IDS = ALL_LINKS.map((l) => l.id);

export function QuickLinksWidget() {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useEffectiveRole();
  const { profile, saveProfile, loading: profileLoading } = useUserProfile();
  const [editOpen, setEditOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const enabledIds = profile?.quickLinks?.length ? profile.quickLinks : DEFAULT_LINK_IDS;
  const accessibleLinks = ALL_LINKS.filter((l) => {
    const key = QUICK_LINK_FEATURE_KEY[l.id];
    if (!key) return true;
    if (roleLoading || profileLoading) return false;
    return hasFeatureAccess(role, profile?.enabledFeatures ?? [], key);
  });
  const visibleLinks = accessibleLinks.filter((l) => enabledIds.includes(l.id));

  const toggleLink = (id: string) => {
    const next = enabledIds.includes(id)
      ? enabledIds.filter((x) => x !== id)
      : [...enabledIds, id];
    saveProfile({ quickLinks: next.length ? next : DEFAULT_LINK_IDS });
  };

  const runLink = (link: (typeof ALL_LINKS)[number]) => {
    if ("action" in link && link.action === "expense") setExpenseOpen(true);
    else if ("action" in link && link.action === "upload") setUploadOpen(true);
    else if ("href" in link && link.href) navigate(link.href);
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-card p-3 pb-3.5">
      <div
        className="-mx-3 -mt-3 flex flex-shrink-0 items-center gap-2 px-3 py-3"
        style={{ background: "var(--gradient-primary)" }}
      >
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-sm">
          <Zap className="h-4 w-4" />
        </span>
        <span>
          <span className="block font-display text-sm font-bold text-white">Quick links</span>
          <span className="block text-[10px] font-medium text-white/60">The things you reach for most</span>
        </span>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 text-white/75 transition hover:bg-white/10 hover:text-white"
          title="Edit quick links"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="mt-2.5 grid flex-shrink-0 grid-cols-3 gap-2">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          const featured = "featured" in link && link.featured;
          return (
          <button
            key={link.id}
            onClick={() => runLink(link)}
            className={`group relative overflow-hidden rounded-xl border text-left shadow-2xs transition-all hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98] ${
              featured
                ? "col-span-3 flex min-h-[64px] items-center gap-3 border-white/10 px-3 text-white"
                : "flex min-h-[58px] flex-col items-center justify-center gap-1 px-1.5 text-center"
            }`}
            style={{
              background: featured
                ? "linear-gradient(120deg, hsl(216 48% 19%), hsl(208 35% 38%))"
                : `color-mix(in srgb, ${link.accent} 11%, hsl(var(--card)))`,
              borderColor: featured ? undefined : `color-mix(in srgb, ${link.accent} 28%, hsl(var(--border)))`,
              borderLeftWidth: featured ? 1 : 3,
              borderLeftColor: featured ? undefined : link.accent,
            }}
          >
            <div
              className={`flex flex-shrink-0 items-center justify-center rounded-lg ${
                featured ? "h-10 w-10 bg-white/12 text-white" : "h-7 w-7"
              }`}
              style={featured ? undefined : { background: `color-mix(in srgb, ${link.accent} 18%, hsl(var(--card)))`, color: link.accent }}
            >
              <Icon className="w-3.5 h-3.5" />
            </div>
            <span className="min-w-0">
              <span className={`block font-semibold leading-tight ${featured ? "font-display text-sm" : "text-[10px] text-card-foreground"}`}>{link.label}</span>
              {featured && <span className="mt-0.5 block text-[10px] text-white/60">{link.sub}</span>}
            </span>
          </button>
          );
        })}
      </div>

      <UploadDocumentDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <AddExpenseDocumentDialog open={expenseOpen} onOpenChange={setExpenseOpen} />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent aria-describedby={undefined} className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-display">Edit Quick Links</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">Choose which shortcuts appear.</p>
          <div className="space-y-1.5 pt-1">
            {accessibleLinks.map((link) => {
              const on = enabledIds.includes(link.id);
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => toggleLink(link.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                    on ? "border-primary/30 bg-primary/5" : "border-border/50 bg-muted/30 opacity-60"
                  }`}
                >
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-lg"
                    style={{ background: `color-mix(in srgb, ${link.accent} 18%, hsl(var(--card)))`, color: link.accent }}
                  >
                    <link.icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{link.label}</p>
                    <p className="text-[10px] text-muted-foreground">{link.sub}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wide ${on ? "text-primary" : "text-muted-foreground"}`}>
                    {on ? "On" : "Off"}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

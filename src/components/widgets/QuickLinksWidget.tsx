import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckSquare2, Receipt, KeyRound, CalendarPlus, ListPlus, Wallet, FileUp, Zap, Pencil, Home, StickyNote, Mail } from "lucide-react";
import { accentGradient, WIDGET_ACCENT } from "@/lib/widgetAccents";
import { UploadDocumentDialog } from "@/components/documents/UploadDocumentDialog";
import { AddExpenseDocumentDialog } from "@/components/capture/AddExpenseDocumentDialog";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { hasFeatureAccess, QUICK_LINK_FEATURE_KEY } from "@/lib/features";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const ALL_LINKS = [
  { id: "today",       icon: CheckSquare2, label: "Today",      sub: "Focus list",  bg: "bg-amber-500",   tint: "bg-amber-50 dark:bg-amber-500/15 border-amber-200/70 dark:border-amber-500/25",     href: "/today" },
  { id: "expense",     icon: Receipt,      label: "Add expense or document", sub: "Snap now, file later", bg: "bg-rose-500", tint: "bg-rose-50 dark:bg-rose-500/15 border-rose-200/70 dark:border-rose-500/25", action: "expense" as const },
  { id: "logins",      icon: KeyRound,     label: "Log Ins",    sub: "Credentials", bg: "bg-violet-500",   tint: "bg-violet-50 dark:bg-violet-500/15 border-violet-200/70 dark:border-violet-500/25", href: "/login-details" },
  { id: "event",       icon: CalendarPlus, label: "New Event",  sub: "Calendar",    bg: "bg-blue-500",     tint: "bg-blue-50 dark:bg-blue-500/15 border-blue-200/70 dark:border-blue-500/25",         href: "/calendar" },
  { id: "task",        icon: ListPlus,     label: "Add Task",   sub: "Tasks",       bg: "bg-emerald-500",  tint: "bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200/70 dark:border-emerald-500/25", href: "/tasks" },
  { id: "note",        icon: StickyNote,   label: "Add Note",   sub: "New note",    bg: "bg-amber-500",    tint: "bg-amber-50 dark:bg-amber-500/15 border-amber-200/70 dark:border-amber-500/25",         href: "/notes?new=1" },
  { id: "email",       icon: Mail,         label: "Email",      sub: "Inbox",       bg: "bg-indigo-500",   tint: "bg-indigo-50 dark:bg-indigo-500/15 border-indigo-200/70 dark:border-indigo-500/25", href: "/email" },
  { id: "finance",     icon: Wallet,       label: "Finance",    sub: "Personal",    bg: "bg-teal-500",     tint: "bg-teal-50 dark:bg-teal-500/15 border-teal-200/70 dark:border-teal-500/25",         href: "/finance" },
  { id: "hh-finance",  icon: Home,         label: "HH Finance", sub: "Household",   bg: "bg-green-600",    tint: "bg-green-50 dark:bg-green-500/15 border-green-200/70 dark:border-green-500/25",     href: "/household-finance" },
  { id: "upload",      icon: FileUp,       label: "Upload",     sub: "Documents",   bg: "bg-sky-500",      tint: "bg-sky-50 dark:bg-sky-500/15 border-sky-200/70 dark:border-sky-500/25",             action: "upload" as const },
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
    <div className="w-full h-full p-3 pb-3.5 flex flex-col overflow-y-auto">
      <div
        className="flex items-center gap-2 -mx-3 -mt-3 px-3 py-2.5 flex-shrink-0"
        style={{ background: accentGradient(WIDGET_ACCENT.quick_links) }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/20 flex-shrink-0 text-white">
          <Zap className="w-3.5 h-3.5" />
        </span>
        <span className="text-[11px] font-bold text-white uppercase tracking-wider">Quick Links</span>
        <button
          type="button"
          onClick={() => setEditOpen(true)}
          className="ml-auto p-1 rounded-md text-white/80 hover:text-white hover:bg-white/15"
          title="Edit quick links"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 mt-2.5 flex-shrink-0">
        {visibleLinks.map((link) => {
          const Icon = link.icon;
          return (
          <button
            key={link.id}
            onClick={() => runLink(link)}
            className={`group flex flex-col items-center justify-center gap-1 min-h-16 rounded-xl border shadow-2xs hover:shadow-sm hover:-translate-y-0.5 transition-all active:scale-[0.96] text-center px-1 ${link.tint}`}
          >
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm text-white ${link.bg}`}>
              <Icon className="w-3.5 h-3.5" />
            </div>
            <p className="text-[10px] font-semibold text-card-foreground leading-tight">{link.label}</p>
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
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-white ${link.bg}`}>
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

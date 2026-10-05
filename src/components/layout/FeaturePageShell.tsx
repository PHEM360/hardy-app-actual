import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import PageShareBar from "@/components/sharing/PageShareBar";

interface FeaturePageShellProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  /** Enables page sharing + "view as" for this page key. Omit on household pages. */
  sharePage?: string;
  /** Replaces the default whole-page share button when this page needs a custom share flow. */
  shareAccess?: React.ReactNode;
}

const FeaturePageShell = ({ title, subtitle, children, icon, action, sharePage, shareAccess }: FeaturePageShellProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const comparePage = sharePage === "calendar" || sharePage === "notes" ? sharePage : null;
  const focusPath = comparePage ? `/${comparePage}-focus` : "";
  const currentPath = comparePage ? `/${comparePage}` : "";
  const focusSelected = !!comparePage && location.pathname === focusPath;

  const switchDesign = (focus: boolean) => {
    if (!comparePage) return;
    navigate({ pathname: focus ? focusPath : currentPath, search: location.search });
  };

  return (
    <div
      className="mx-auto w-full min-w-0 overflow-x-hidden py-4 sm:py-5"
      style={{
        paddingLeft: "max(1rem, env(safe-area-inset-left, 0px))",
        paddingRight: "max(1rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5"
      >
        <div className="sticky top-0 z-30 -mx-1 mb-3 bg-background/95 px-1 pb-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="page-back group text-muted-foreground transition-colors hover:bg-card hover:text-primary"
          >
            <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
            Back
          </button>
        </div>
        <div className="relative flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl border border-border/70 bg-card p-4 shadow-card sm:p-5">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "linear-gradient(115deg, color-mix(in srgb, hsl(var(--primary)) 10%, transparent), transparent 48%), radial-gradient(circle at 92% 12%, color-mix(in srgb, hsl(var(--primary)) 10%, transparent), transparent 32%)",
            }}
          />
          {icon && (
            <div className="relative flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-glow">
              {icon}
            </div>
          )}
          <div className="relative min-w-0 flex-1">
            <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
            )}
          </div>
          {comparePage && (
            <div className="relative flex shrink-0 items-center rounded-xl border border-border/70 bg-card p-1 shadow-sm" aria-label={`${comparePage} design`}>
              <button
                type="button"
                onClick={() => switchDesign(false)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition sm:text-xs ${!focusSelected ? "bg-gradient-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => switchDesign(true)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition sm:text-xs ${focusSelected ? "bg-gradient-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"}`}
              >
                Focus
              </button>
            </div>
          )}
          {(sharePage || action) && (
            <div className="relative flex-shrink-0">
              {sharePage ? <PageShareBar page={sharePage} extra={action} access={shareAccess} /> : action}
            </div>
          )}
        </div>
      </motion.div>
      {children || (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border-2 border-dashed border-border bg-gradient-card p-10 text-center shadow-soft"
        >
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">
            This feature is coming soon. The module structure is ready for development.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default FeaturePageShell;
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles } from "lucide-react";
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
  /** Hide the back row (standalone calendar webapp). */
  hideBack?: boolean;
  /** Trim phone side gutters by about 1mm so a month grid can use more width. */
  tightGutter?: boolean;
}

const FeaturePageShell = ({ title, subtitle, children, icon, action, sharePage, shareAccess, hideBack, tightGutter }: FeaturePageShellProps) => {
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
        paddingLeft: `max(${tightGutter ? "0.75rem" : "1rem"}, env(safe-area-inset-left, 0px))`,
        paddingRight: `max(${tightGutter ? "0.75rem" : "1rem"}, env(safe-area-inset-right, 0px))`,
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5"
      >
        {!hideBack && (
        <div className="sticky top-0 z-30 -mx-1 mb-3 bg-background/95 px-1 pb-1 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="page-back group text-primary transition-colors hover:bg-card"
          >
            <ChevronLeft className="h-5 w-5 transition-transform group-hover:-translate-x-0.5" strokeWidth={2.5} />
            Back
          </button>
        </div>
        )}
        <div className="relative flex flex-wrap items-center gap-3 border-b border-foreground/20 pb-4 after:absolute after:-bottom-px after:left-0 after:h-[3px] after:w-14 after:bg-gold">
          {icon && (
            <div className="btn-edge flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              {icon}
            </div>
          )}
          <div className="min-w-[60%] flex-1 sm:min-w-0">
            <h1 className="font-display text-[1.75rem] font-semibold leading-[1.1] text-foreground">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-foreground/70">{subtitle}</p>
            )}
          </div>
          {comparePage && (
            <div className="flex shrink-0 items-center rounded-xl border border-border/60 bg-muted/55 p-1" aria-label={`${comparePage} design`}>
              <button
                type="button"
                onClick={() => switchDesign(false)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition sm:text-xs ${!focusSelected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => switchDesign(true)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition sm:text-xs ${focusSelected ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                Focus
              </button>
            </div>
          )}
          {(sharePage || action) && (
            <div className="flex-shrink-0">
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
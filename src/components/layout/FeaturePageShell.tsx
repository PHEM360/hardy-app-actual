import { motion } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import PageShareBar from "@/components/sharing/PageShareBar";
import { Button } from "@/components/ui/button";
import { JEWEL } from "@/lib/brandPalette";

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
  const comparePage = sharePage === "calendar" ? sharePage : null;
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
          <div className="sticky top-0 z-30 -mx-1 mb-3 border-b border-foreground/10 bg-background px-1 pb-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate(-1)}>
              <ChevronLeft />
              Back
            </Button>
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
            <div className="flex shrink-0 items-center gap-1 rounded-lg border border-foreground/20 bg-card p-1" aria-label={`${comparePage} design`}>
              <button
                type="button"
                onClick={() => switchDesign(false)}
                className={`btn-edge rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition sm:text-xs ${!focusSelected ? "bg-primary text-primary-foreground" : "text-foreground/70"}`}
              >
                Current
              </button>
              <button
                type="button"
                onClick={() => switchDesign(true)}
                className={`btn-edge rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition sm:text-xs ${focusSelected ? "bg-primary text-primary-foreground" : "text-foreground/70"}`}
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
        <div className="overflow-hidden rounded-xl border border-foreground/20 bg-card shadow-card">
          <div className="band px-4 py-3 text-white" style={{ background: JEWEL.petrol }}>
            <p className="font-display text-lg font-semibold">Nothing here yet</p>
          </div>
          <div className="space-y-3 p-5">
            <p className="text-sm text-foreground/80">
              This screen is ready when you add content. Use the controls above or open More to find related tools.
            </p>
            <Button type="button" onClick={() => navigate("/more")}>
              Open More
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeaturePageShell;

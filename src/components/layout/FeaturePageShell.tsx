import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
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
        <button
          onClick={() => navigate(-1)}
          className="group flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          Back
        </button>
        <div className="flex items-center gap-3 flex-wrap">
          {icon && (
            <div className="w-10 h-10 rounded-xl bg-gradient-primary shadow-glow flex items-center justify-center text-primary-foreground flex-shrink-0">
              {icon}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold font-display text-foreground">{title}</h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
            )}
          </div>
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
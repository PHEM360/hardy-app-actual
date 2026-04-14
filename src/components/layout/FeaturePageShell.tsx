import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FeaturePageShellProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

const FeaturePageShell = ({ title, subtitle, children, icon, action }: FeaturePageShellProps) => {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-4 sm:px-5 sm:py-5">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5"
      >
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
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
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      </motion.div>
      {children || (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-card p-8 text-center"
        >
          <p className="text-sm text-muted-foreground">
            This feature is coming soon. The module structure is ready for development.
          </p>
        </motion.div>
      )}
    </div>
  );
};

export default FeaturePageShell;
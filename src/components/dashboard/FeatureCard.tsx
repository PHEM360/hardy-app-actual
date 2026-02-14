import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Wallet, Home, Calculator, Users, Heart, Activity, Building, Shield,
} from "lucide-react";
import type { FeatureModule } from "@/types/app";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  wallet: Wallet, home: Home, calculator: Calculator, users: Users,
  heart: Heart, activity: Activity, building: Building, shield: Shield,
};

const COLOR_MAP: Record<string, string> = {
  primary: "bg-primary/15 text-primary",
  secondary: "bg-secondary/15 text-secondary",
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  info: "bg-info/15 text-info",
  destructive: "bg-destructive/15 text-destructive",
};

const BG_MAP: Record<string, string> = {
  primary: "bg-primary/[0.04]",
  secondary: "bg-secondary/[0.04]",
  success: "bg-success/[0.04]",
  warning: "bg-warning/[0.04]",
  info: "bg-info/[0.04]",
  destructive: "bg-destructive/[0.04]",
};

interface FeatureCardProps {
  module: FeatureModule;
  index: number;
}

const FeatureCard = ({ module, index }: FeatureCardProps) => {
  const navigate = useNavigate();
  const Icon = ICON_MAP[module.icon] || Wallet;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.35 }}
      onClick={() => navigate(module.route)}
      className={`group flex items-center gap-3.5 p-4 rounded-xl ${BG_MAP[module.color]} shadow-soft border border-border/40 hover:shadow-card hover:border-primary/20 transition-all duration-200 text-left w-full active:scale-[0.98] relative overflow-hidden`}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: `var(--${module.color})`,
      }}
    >
      <div className={`flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center transition-colors ${COLOR_MAP[module.color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold font-display text-card-foreground truncate">
          {module.label}
        </p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {module.description}
        </p>
      </div>
    </motion.button>
  );
};

export default FeatureCard;

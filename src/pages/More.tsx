import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  Calculator,
  Users,
  Activity,
  Building,
  Palette,
  Bell,
  Settings,
} from "lucide-react";

const MORE_ITEMS = [
  { label: "Household Finance", icon: Home, route: "/household-finance" },
  { label: "IHT Planner", icon: Calculator, route: "/inheritance" },
  { label: "Households", icon: Users, route: "/households" },
  { label: "Weight Tracker", icon: Activity, route: "/weight" },
  { label: "Tattersalls", icon: Building, route: "/tattersalls" },
  { label: "Themes", icon: Palette, route: "/themes" },
  { label: "Notifications", icon: Bell, route: "/notifications" },
  { label: "Settings", icon: Settings, route: "/settings" },
];

const More = () => {
  const navigate = useNavigate();

  return (
    <div className="px-4 py-5">
      <h1 className="text-xl font-bold font-display text-foreground mb-5">More</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {MORE_ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.button
              key={item.route}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(item.route)}
              className="w-full flex items-center gap-3 p-3.5 rounded-xl hover:bg-muted/70 transition-colors text-left active:scale-[0.98]"
            >
              <Icon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{item.label}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default More;
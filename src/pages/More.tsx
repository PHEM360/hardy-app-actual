import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  CheckSquare,
  Sun,
  CalendarDays,
  Building2,
  Home,
  Calculator,
  Users,
  Activity,
  Building,
  Palette,
  Bell,
  Settings,
  Snowflake,
} from "lucide-react";
import { useUserRole } from "@/auth/useUserRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { hasFeatureAccess, ROUTE_FEATURE_KEY } from "@/lib/features";

type MoreItem = {
  label: string;
  icon: React.ElementType;
  route: string;
  gradient: string;
  iconColor: string;
};

type Section = { title: string; items: MoreItem[] };

const SECTIONS: Section[] = [
  {
    title: "Daily",
    items: [
      {
        label: "Tasks",
        icon: CheckSquare,
        route: "/tasks",
        gradient: "linear-gradient(135deg, hsl(258,60%,58%), hsl(270,55%,52%))",
        iconColor: "#fff",
      },
      {
        label: "Today",
        icon: Sun,
        route: "/today",
        gradient: "linear-gradient(135deg, hsl(38,95%,52%), hsl(25,85%,48%))",
        iconColor: "#fff",
      },
      {
        label: "Calendar",
        icon: CalendarDays,
        route: "/calendar",
        gradient: "linear-gradient(135deg, hsl(218,60%,55%), hsl(230,55%,48%))",
        iconColor: "#fff",
      },
    ],
  },
  {
    title: "Finance & Property",
    items: [
      {
        label: "Companies",
        icon: Building2,
        route: "/companies",
        gradient: "linear-gradient(135deg, hsl(206,60%,52%), hsl(216,55%,45%))",
        iconColor: "#fff",
      },
      {
        label: "HH Finance",
        icon: Home,
        route: "/household-finance",
        gradient: "linear-gradient(135deg, hsl(152,55%,40%), hsl(160,50%,34%))",
        iconColor: "#fff",
      },
      {
        label: "IHT Planner",
        icon: Calculator,
        route: "/inheritance",
        gradient: "linear-gradient(135deg, hsl(0,60%,52%), hsl(340,55%,46%))",
        iconColor: "#fff",
      },
    ],
  },
  {
    title: "Home & Wellbeing",
    items: [
      {
        label: "Households",
        icon: Users,
        route: "/households",
        gradient: "linear-gradient(135deg, hsl(28,65%,52%), hsl(18,60%,46%))",
        iconColor: "#fff",
      },
      {
        label: "Health",
        icon: Activity,
        route: "/weight",
        gradient: "linear-gradient(135deg, hsl(148,55%,42%), hsl(158,50%,36%))",
        iconColor: "#fff",
      },
      {
        label: "Tattersalls",
        icon: Building,
        route: "/tattersalls",
        gradient: "linear-gradient(135deg, hsl(192,52%,46%), hsl(202,48%,40%))",
        iconColor: "#fff",
      },
      {
        label: "Freezer",
        icon: Snowflake,
        route: "/freezer",
        gradient: "linear-gradient(135deg, hsl(198,75%,55%), hsl(215,70%,48%))",
        iconColor: "#fff",
      },
    ],
  },
  {
    title: "Settings",
    items: [
      {
        label: "Themes",
        icon: Palette,
        route: "/themes",
        gradient: "linear-gradient(135deg, hsl(314,55%,52%), hsl(280,50%,48%))",
        iconColor: "#fff",
      },
      {
        label: "Notifications",
        icon: Bell,
        route: "/notifications",
        gradient: "linear-gradient(135deg, hsl(44,90%,52%), hsl(32,80%,46%))",
        iconColor: "#fff",
      },
      {
        label: "Settings",
        icon: Settings,
        route: "/settings",
        gradient: "linear-gradient(135deg, hsl(215,20%,52%), hsl(220,16%,44%))",
        iconColor: "#fff",
      },
    ],
  },
];

const More = () => {
  const navigate = useNavigate();
  const { role, loading } = useUserRole();
  const { profile } = useUserProfile();

  let delay = 0;

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      const key = ROUTE_FEATURE_KEY[item.route];
      if (!key) return true;
      if (loading) return false;
      return hasFeatureAccess(role, profile?.enabledFeatures ?? [], key);
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="px-4 py-5 pb-24">
      <h1 className="text-xl font-bold font-display text-foreground mb-5">More</h1>

      <div className="space-y-6">
        {visibleSections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 px-1">
              {section.title}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {section.items.map((item) => {
                const Icon = item.icon;
                const d = delay;
                delay += 0.05;
                return (
                  <motion.button
                    key={item.route}
                    initial={{ opacity: 0, scale: 0.88 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: d, type: "spring", stiffness: 320, damping: 26 }}
                    onClick={() => navigate(item.route)}
                    className="flex flex-col items-center gap-2.5 p-3 rounded-2xl border border-border/40 bg-card shadow-soft active:scale-95 transition-transform hover:shadow-md hover:border-border/60"
                  >
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-md"
                      style={{ background: item.gradient }}
                    >
                      <Icon className="w-7 h-7" style={{ color: item.iconColor }} />
                    </div>
                    <span className="text-[13px] font-semibold text-foreground text-center leading-tight">
                      {item.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default More;

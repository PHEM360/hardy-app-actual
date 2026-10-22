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
  Cable,
  Palette,
  Bell,
  Settings,
  Snowflake,
  Plane,
  PiggyBank,
  Heart,
  Sparkles,
  KeyRound,
  StickyNote,
  MonitorSmartphone,
  AlarmClock,
  Palmtree,
  Images,
  Mail,
  Phone,
  Inbox,
  LogOut,
} from "lucide-react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { cleanupFcmTokenOnSignOut } from "@/lib/fcmDeviceSettings";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { canAccessRoute } from "@/lib/features";
import { useIncomingPageShares } from "@/hooks/usePageShares";
import { Button } from "@/components/ui/button";
import { JEWEL } from "@/lib/brandPalette";

type MoreItem = {
  label: string;
  icon: React.ElementType;
  route: string;
  color: string;
};

type Section = { title: string; items: MoreItem[] };

const SECTIONS: Section[] = [
  {
    title: "Daily",
    items: [
      { label: "Tasks", icon: CheckSquare, route: "/tasks", color: JEWEL.indigo },
      { label: "Notes", icon: StickyNote, route: "/notes", color: JEWEL.bronze },
      { label: "Photos", icon: Images, route: "/photos", color: JEWEL.plum },
      { label: "Email", icon: Mail, route: "/email", color: JEWEL.cobalt },
      { label: "Unallocated", icon: Inbox, route: "/unallocated", color: JEWEL.oxblood },
      { label: "Today", icon: Sun, route: "/today", color: JEWEL.bronze },
      { label: "Calendar", icon: CalendarDays, route: "/calendar", color: JEWEL.marine },
      { label: "Phone", icon: Phone, route: "/softphone", color: JEWEL.forest },
      { label: "Log Ins", icon: KeyRound, route: "/login-details", color: JEWEL.aubergine },
    ],
  },
  {
    title: "Finance & Property",
    items: [
      { label: "My Finance", icon: PiggyBank, route: "/finance", color: JEWEL.bronze },
      { label: "Companies", icon: Building2, route: "/companies", color: JEWEL.petrol },
      { label: "HH Finance", icon: Home, route: "/household-finance", color: JEWEL.moss },
      { label: "IHT Planner", icon: Calculator, route: "/inheritance", color: JEWEL.burgundy },
    ],
  },
  {
    title: "Work",
    items: [
      { label: "Annual Leave", icon: Plane, route: "/annual-leave", color: JEWEL.cobalt },
    ],
  },
  {
    title: "Travel",
    items: [
      { label: "Holidays", icon: Palmtree, route: "/holidays", color: JEWEL.teal },
    ],
  },
  {
    title: "Home & Wellbeing",
    items: [
      { label: "Households", icon: Users, route: "/households", color: JEWEL.bronze },
      { label: "Pets", icon: Heart, route: "/pets", color: JEWEL.burgundy },
      { label: "Health", icon: Activity, route: "/weight", color: JEWEL.forest },
      { label: "Flats", icon: Building, route: "/tattersalls", color: JEWEL.petrol },
      { label: "Freezer", icon: Snowflake, route: "/freezer", color: JEWEL.marine },
      { label: "AI Analysis", icon: Sparkles, route: "/ai-analysis", color: JEWEL.aubergine },
    ],
  },
  {
    title: "Settings",
    items: [
      { label: "Display / Themes", icon: Palette, route: "/themes", color: JEWEL.plum },
      { label: "Notifications", icon: Bell, route: "/notifications", color: JEWEL.bronze },
      { label: "Alarms", icon: AlarmClock, route: "/alarms", color: JEWEL.bronze },
      { label: "Remote Displays", icon: MonitorSmartphone, route: "/remote-displays", color: JEWEL.petrol },
      { label: "Connected Devices", icon: Cable, route: "/connected-devices", color: JEWEL.teal },
      { label: "Settings", icon: Settings, route: "/settings", color: JEWEL.slate },
    ],
  },
];

const More = () => {
  const navigate = useNavigate();
  const { role, loading: roleLoading } = useEffectiveRole();
  const { profile, loading: profileLoading } = useUserProfile();
  const { pages: sharedPages, loading: sharesLoading } = useIncomingPageShares();
  const loading = roleLoading || profileLoading || sharesLoading;

  let delay = 0;

  const visibleSections = SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => {
      if (loading) return false;
      return canAccessRoute(role, profile?.enabledFeatures ?? [], item.route, sharedPages);
    }),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="page-gutter-x py-5 pb-8">
      <h1 className="font-display text-2xl font-semibold text-foreground mb-5">More</h1>

      <div className="space-y-6">
        {visibleSections.map((section) => (
          <div key={section.title}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-foreground/60 mb-3 px-1">
              {section.title}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {section.items.map((item) => {
                const Icon = item.icon;
                const d = delay;
                delay += 0.04;
                return (
                  <motion.button
                    key={item.route}
                    type="button"
                    initial={{ opacity: 0, scale: 0.94 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: d, duration: 0.16 }}
                    onClick={() => navigate(item.route)}
                    className="flex flex-col items-center gap-2.5 p-3 rounded-xl border border-foreground/20 bg-card shadow-card active:scale-[0.97] transition-transform"
                  >
                    <div
                      className="btn-edge flex h-12 w-12 items-center justify-center rounded-lg text-white"
                      style={{ background: item.color }}
                    >
                      <Icon className="w-6 h-6" />
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

      <div className="mt-8">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={async () => {
            await cleanupFcmTokenOnSignOut(auth.currentUser?.uid);
            await signOut(auth);
            navigate("/", { replace: true });
          }}
        >
          <LogOut />
          Sign out
        </Button>
      </div>
    </div>
  );
};

export default More;

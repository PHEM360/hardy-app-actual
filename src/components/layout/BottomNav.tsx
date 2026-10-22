import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, PiggyBank, Heart, Shield, MoreHorizontal,
  CheckSquare, Briefcase, Key, Activity, Users, Wallet, Building2, CalendarDays, Sun, StickyNote, Images,
  MonitorSmartphone, Palmtree, Phone,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { canAccessRoute, DEFAULT_BOTTOM_NAV, MAX_BOTTOM_NAV_ITEMS } from "@/lib/features";
import { useIncomingPageShares } from "@/hooks/usePageShares";
import { JEWEL } from "@/lib/brandPalette";

type NavItemDef = { icon: React.ElementType; label: string; color: string };

const ALL_NAV_ITEMS: Record<string, NavItemDef> = {
  "/dashboard":         { icon: Home,          label: "Home",       color: JEWEL.teal },
  "/finance":           { icon: PiggyBank,     label: "Finance",    color: JEWEL.bronze },
  "/pets":              { icon: Heart,         label: "Pets",       color: JEWEL.burgundy },
  "/admin":             { icon: Shield,        label: "Admin",      color: JEWEL.cobalt },
  "/more":              { icon: MoreHorizontal,label: "More",       color: JEWEL.slate },
  "/tasks":             { icon: CheckSquare,   label: "Tasks",      color: JEWEL.indigo },
  "/companies":         { icon: Briefcase,     label: "Companies",  color: JEWEL.marine },
  "/login-details":     { icon: Key,           label: "Log Ins",    color: JEWEL.aubergine },
  "/weight":            { icon: Activity,      label: "Health",     color: JEWEL.forest },
  "/health":            { icon: Activity,      label: "Health",     color: JEWEL.forest },
  "/households":        { icon: Users,         label: "Households", color: JEWEL.bronze },
  "/household-finance": { icon: Wallet,        label: "HH Finance", color: JEWEL.moss },
  "/tattersalls":       { icon: Building2,     label: "Flats",      color: JEWEL.petrol },
  "/calendar":          { icon: CalendarDays,  label: "Calendar",   color: JEWEL.cobalt },
  "/notes":             { icon: StickyNote,    label: "Notes",      color: JEWEL.bronze },
  "/photos":            { icon: Images,        label: "Photos",     color: JEWEL.plum },
  "/today":             { icon: Sun,           label: "Today",      color: JEWEL.bronze },
  "/remote-displays":   { icon: MonitorSmartphone, label: "Displays", color: JEWEL.petrol },
  "/holidays":          { icon: Palmtree,      label: "Holidays",   color: JEWEL.teal },
  "/softphone":         { icon: Phone,         label: "Phone",      color: JEWEL.forest },
};

function NavButton({
  path,
  item,
  isActive,
  onClick,
}: {
  path: string;
  item: NavItemDef;
  isActive: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors min-w-0 min-h-[44px]"
    >
      <div className="relative flex items-center justify-center w-11 h-8">
        <AnimatePresence>
          {isActive && (
            <motion.div
              key={`chip-${path}`}
              layoutId="nav-chip"
              className="btn-edge absolute inset-0 rounded-md"
              style={{ background: item.color }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.16 }}
            />
          )}
        </AnimatePresence>
        <Icon
          className="relative w-4 h-4 transition-colors z-10"
          style={isActive ? { color: "#fff" } : { color: "rgba(255,255,255,0.72)" }}
        />
      </div>
      <span
        className="text-[10px] transition-colors truncate max-w-full px-0.5 tracking-wide"
        style={isActive ? { color: "#fff", fontWeight: 700 } : { color: "rgba(255,255,255,0.72)", fontWeight: 500 }}
      >
        {item.label}
      </span>
    </button>
  );
}

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, loading: roleLoading, isViewAs } = useEffectiveRole();
  const { profile, loading: profileLoading } = useUserProfile();
  const { pages: sharedPages, loading: sharesLoading } = useIncomingPageShares();
  const loading = roleLoading || profileLoading || sharesLoading;

  const features = profile?.enabledFeatures ?? [];
  const usingCustomNav = Boolean(profile?.navItems && profile.navItems.length > 0);
  const rawPaths = usingCustomNav ? profile!.navItems! : DEFAULT_BOTTOM_NAV;

  const navItems = rawPaths
    .filter((path) => path !== "/more")
    .filter((path) => {
      if (path === "/admin") return !isViewAs && !loading && (role === "admin" || role === "superadmin");
      if (loading) return path === "/dashboard" || path === "/today";
      return canAccessRoute(role, features, path, sharedPages);
    })
    .slice(0, usingCustomNav ? undefined : MAX_BOTTOM_NAV_ITEMS)
    .map((path) => ({ path, ...ALL_NAV_ITEMS[path] }))
    .filter((item) => Boolean(item.icon));

  const isMoreActive = location.pathname === "/more" || location.pathname.startsWith("/more");
  const moreItem = ALL_NAV_ITEMS["/more"];

  return createPortal(
    <nav
      className="z-50 w-full border-t border-white/10"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "calc(var(--app-nav-h, 4rem) + env(safe-area-inset-bottom, 0px))",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        background: JEWEL.ink,
        boxSizing: "border-box",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-full"
        style={{ height: "100vh", background: JEWEL.ink }}
      />
      <div className="mx-auto flex h-16 w-full max-w-screen-xl items-center justify-around px-1">
        {navItems.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path)) ||
            (item.path === "/health" && location.pathname === "/weight");
          return (
            <NavButton
              key={item.path}
              path={item.path}
              item={item}
              isActive={isActive}
              onClick={() => navigate(item.path)}
            />
          );
        })}

        <NavButton
          path="/more"
          item={moreItem}
          isActive={isMoreActive}
          onClick={() => navigate("/more")}
        />
      </div>
    </nav>,
    document.body,
  );
};

export default BottomNav;

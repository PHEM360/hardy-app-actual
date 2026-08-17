import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, PiggyBank, Heart, Shield, MoreHorizontal, LogOut,
  CheckSquare, Briefcase, Key, Activity, Users, Wallet, Building2, CalendarDays, Sun,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { useUserProfile } from "@/hooks/useUserProfile";
import { hasFeatureAccess, ROUTE_FEATURE_KEY } from "@/lib/features";

type NavItemDef = { icon: React.ElementType; label: string; color: string; gradient: string };

const ALL_NAV_ITEMS: Record<string, NavItemDef> = {
  "/dashboard":         { icon: Home,          label: "Home",       color: "hsl(178,55%,36%)",  gradient: "linear-gradient(135deg,hsl(178,58%,42%),hsl(182,55%,46%))" },
  "/finance":           { icon: PiggyBank,     label: "Finance",    color: "hsl(25,62%,55%)",   gradient: "linear-gradient(135deg,hsl(25,65%,58%),hsl(15,58%,52%))" },
  "/pets":              { icon: Heart,         label: "Pets",       color: "hsl(0,65%,50%)",    gradient: "linear-gradient(135deg,hsl(0,68%,55%),hsl(340,60%,48%))" },
  "/admin":             { icon: Shield,        label: "Admin",      color: "hsl(205,55%,48%)",  gradient: "linear-gradient(135deg,hsl(205,58%,52%),hsl(215,53%,45%))" },
  "/more":              { icon: MoreHorizontal,label: "More",       color: "hsl(191,33%,43%)",  gradient: "linear-gradient(135deg,hsl(200,45%,48%),hsl(210,42%,42%))" },
  "/tasks":             { icon: CheckSquare,   label: "Tasks",      color: "hsl(260,55%,55%)",  gradient: "linear-gradient(135deg,hsl(258,62%,60%),hsl(270,55%,52%))" },
  "/companies":         { icon: Briefcase,     label: "Companies",  color: "hsl(210,50%,50%)",  gradient: "linear-gradient(135deg,hsl(210,53%,54%),hsl(220,48%,47%))" },
  "/login-details":     { icon: Key,           label: "Log Ins",    color: "hsl(265,55%,55%)",  gradient: "linear-gradient(135deg,hsl(265,58%,58%),hsl(275,53%,50%))" },
  "/weight":            { icon: Activity,      label: "Health",     color: "hsl(152,55%,40%)",  gradient: "linear-gradient(135deg,hsl(152,58%,44%),hsl(160,53%,37%))" },
  "/health":            { icon: Activity,      label: "Health",     color: "hsl(152,55%,40%)",  gradient: "linear-gradient(135deg,hsl(152,58%,44%),hsl(160,53%,37%))" },
  "/households":        { icon: Users,         label: "Households", color: "hsl(30,60%,50%)",   gradient: "linear-gradient(135deg,hsl(30,65%,54%),hsl(20,58%,47%))" },
  "/household-finance": { icon: Wallet,        label: "HH Finance", color: "hsl(140,55%,40%)",  gradient: "linear-gradient(135deg,hsl(140,58%,44%),hsl(150,53%,37%))" },
  "/tattersalls":       { icon: Building2,     label: "Tattersalls",color: "hsl(195,50%,45%)",  gradient: "linear-gradient(135deg,hsl(195,53%,48%),hsl(205,48%,42%))" },
  "/calendar":          { icon: CalendarDays,  label: "Calendar",   color: "hsl(220,60%,55%)",  gradient: "linear-gradient(135deg,hsl(218,63%,58%),hsl(230,58%,50%))" },
  "/today":             { icon: Sun,           label: "Today",      color: "hsl(38,92%,50%)",   gradient: "linear-gradient(135deg,hsl(38,95%,54%),hsl(25,88%,47%))" },
};

const DEFAULT_NAV = ["/dashboard", "/tasks", "/today", "/health", "/more"];

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
      onClick={onClick}
      className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors min-w-0"
    >
      <div className="relative flex items-center justify-center w-10 h-7">
        <AnimatePresence>
          {isActive && (
            <motion.div
              key={`pill-${path}`}
              layoutId="nav-pill"
              className="absolute inset-0 rounded-full"
              style={{ background: item.gradient }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
            />
          )}
        </AnimatePresence>
        <Icon
          className="relative w-4 h-4 transition-colors z-10"
          style={isActive ? { color: "#fff" } : { color: "rgba(255,255,255,0.72)" }}
        />
      </div>
      <span
        className="text-[10px] transition-colors truncate max-w-full px-0.5"
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
  const { role, loading, isViewAs } = useEffectiveRole();
  const { profile } = useUserProfile();

  const rawPaths = profile?.navItems && profile.navItems.length > 0 ? profile.navItems : DEFAULT_NAV;

  const navItems = rawPaths
    .filter((path) => path !== "/more")
    .filter((path) => {
      // Admin nav access is role-based only — the per-member "Admin" feature
      // toggle doesn't actually grant the admin role, so it can't gate this.
      if (path === "/admin") return !isViewAs && !loading && (role === "admin" || role === "superadmin");
      const key = ROUTE_FEATURE_KEY[path];
      if (!key) return true;
      if (loading) return false;
      return hasFeatureAccess(role, profile?.enabledFeatures ?? [], key);
    })
    .map((path) => ({ path, ...ALL_NAV_ITEMS[path] }))
    .filter((item) => Boolean(item.icon));

  const isMoreActive = location.pathname === "/more" || location.pathname.startsWith("/more");
  const moreItem = ALL_NAV_ITEMS["/more"];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5"
      style={{
        paddingBottom: "env(safe-area-inset-bottom)",
        background: "var(--chrome-nav, var(--gradient-hero))",
        backdropFilter: "blur(16px)",
      }}
    >
      <div className="flex items-center justify-around h-16 px-1 max-w-screen-xl mx-auto w-full">
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

        <button
          onClick={async () => {
            await signOut(auth);
            navigate("/", { replace: true });
          }}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full min-w-0"
          aria-label="Sign out"
          title="Sign out"
        >
          <div className="flex items-center justify-center w-10 h-7">
            <LogOut className="w-4 h-4" style={{ color: "rgba(255,255,255,0.72)" }} />
          </div>
          <span className="text-[10px] font-medium" style={{ color: "rgba(255,255,255,0.72)" }}>Sign out</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;

import { useLocation, useNavigate } from "react-router-dom";
import {
  Home, PiggyBank, Heart, Shield, MoreHorizontal, LogOut,
  CheckSquare, Briefcase, Key, Activity, Users, Wallet, Building2, CalendarDays, Sun,
} from "lucide-react";
import { motion } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUserRole } from "@/auth/useUserRole";
import { useUserProfile } from "@/hooks/useUserProfile";

type NavItemDef = { icon: React.ElementType; label: string; color: string; gradient: string };

const ALL_NAV_ITEMS: Record<string, NavItemDef> = {
  "/dashboard":         { icon: Home,          label: "Home",       color: "hsl(188,33%,38%)",  gradient: "linear-gradient(135deg,hsl(188,33%,38%),hsl(191,33%,43%))" },
  "/finance":           { icon: PiggyBank,     label: "Finance",    color: "hsl(25,62%,67%)",   gradient: "linear-gradient(135deg,hsl(25,62%,67%),hsl(15,55%,58%))" },
  "/pets":              { icon: Heart,         label: "Pets",       color: "hsl(0,65%,50%)",    gradient: "linear-gradient(135deg,hsl(0,65%,50%),hsl(340,55%,45%))" },
  "/admin":             { icon: Shield,        label: "Admin",      color: "hsl(205,55%,48%)",  gradient: "linear-gradient(135deg,hsl(205,55%,48%),hsl(215,50%,42%))" },
  "/more":              { icon: MoreHorizontal,label: "More",       color: "hsl(191,33%,43%)",  gradient: "linear-gradient(135deg,hsl(191,33%,43%),hsl(200,40%,38%))" },
  "/tasks":             { icon: CheckSquare,   label: "Tasks",      color: "hsl(260,55%,55%)",  gradient: "linear-gradient(135deg,hsl(260,55%,55%),hsl(270,50%,50%))" },
  "/companies":         { icon: Briefcase,     label: "Companies",  color: "hsl(210,50%,50%)",  gradient: "linear-gradient(135deg,hsl(210,50%,50%),hsl(220,45%,44%))" },
  "/login-details":     { icon: Key,           label: "Log Ins",    color: "hsl(265,55%,55%)",  gradient: "linear-gradient(135deg,hsl(265,55%,55%),hsl(275,50%,48%))" },
  "/weight":            { icon: Activity,      label: "Health",     color: "hsl(152,55%,40%)",  gradient: "linear-gradient(135deg,hsl(152,55%,40%),hsl(160,50%,35%))" },
  "/health":            { icon: Activity,      label: "Health",     color: "hsl(152,55%,40%)",  gradient: "linear-gradient(135deg,hsl(152,55%,40%),hsl(160,50%,35%))" },
  "/households":        { icon: Users,         label: "Households", color: "hsl(30,60%,50%)",   gradient: "linear-gradient(135deg,hsl(30,60%,50%),hsl(20,55%,44%))" },
  "/household-finance": { icon: Wallet,        label: "HH Finance", color: "hsl(140,55%,40%)",  gradient: "linear-gradient(135deg,hsl(140,55%,40%),hsl(150,50%,35%))" },
  "/tattersalls":       { icon: Building2,     label: "Tattersalls",color: "hsl(195,50%,45%)",  gradient: "linear-gradient(135deg,hsl(195,50%,45%),hsl(205,45%,40%))" },
  "/calendar":          { icon: CalendarDays,  label: "Calendar",   color: "hsl(220,60%,55%)",  gradient: "linear-gradient(135deg,hsl(220,60%,55%),hsl(230,55%,48%))" },
  "/today":             { icon: Sun,           label: "Today",      color: "hsl(38,92%,50%)",   gradient: "linear-gradient(135deg,hsl(38,92%,50%),hsl(25,85%,45%))" },
};

const DEFAULT_NAV = ["/dashboard", "/tasks", "/today", "/health", "/more"];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, loading } = useUserRole();
  const { profile } = useUserProfile();

  const isAdmin = role === "admin" || role === "superadmin";
  // Members without an explicit enabledFeatures list default to seeing everything.
  const memberHasFeature = (key: string) => {
    if (isAdmin) return true;
    if (!profile || profile.enabledFeatures.length === 0) return true;
    return profile.enabledFeatures.includes(key as any);
  };

  // Use user's saved nav paths (excluding pinned items), or fall back to defaults
  const rawPaths = profile?.navItems && profile.navItems.length > 0 ? profile.navItems : DEFAULT_NAV;

  const navItems = rawPaths
    .filter((path) => path !== "/more") // More is pinned, remove from orderable list
    .filter((path) => {
      if (path === "/admin") return !loading && isAdmin;
      if (path === "/pets") return !loading && memberHasFeature("pets");
      if (path === "/finance") return !loading && memberHasFeature("finance");
      if (path === "/today") return true;
      return true;
    })
    .map((path) => ({ path, ...ALL_NAV_ITEMS[path] }))
    .filter((item) => Boolean(item.icon)); // guard unknown paths

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-center justify-around h-16 px-2 max-w-screen-xl mx-auto w-full">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path)) ||
            (item.path === "/health" && location.pathname === "/weight");
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-px left-3 right-3 h-[2.5px] rounded-b-full"
                  style={{ background: item.gradient }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`w-5 h-5 transition-colors ${isActive ? "" : "text-muted-foreground"}`}
                style={isActive ? { color: item.color } : {}}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${isActive ? "font-bold" : "text-muted-foreground"}`}
                style={isActive ? { color: item.color } : {}}
              >
                {item.label}
              </span>
            </button>
          );
        })}

        {/* Pinned: More */}
        {(() => {
          const morePath = "/more";
          const moreItem = ALL_NAV_ITEMS[morePath];
          const isActive = location.pathname === morePath || location.pathname.startsWith(morePath);
          const Icon = moreItem.icon;
          return (
            <button
              key={morePath}
              onClick={() => navigate(morePath)}
              className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -top-px left-3 right-3 h-[2.5px] rounded-b-full"
                  style={{ background: moreItem.gradient }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`w-5 h-5 transition-colors ${isActive ? "" : "text-muted-foreground"}`}
                style={isActive ? { color: moreItem.color } : {}}
              />
              <span
                className={`text-[10px] font-medium transition-colors ${isActive ? "font-bold" : "text-muted-foreground"}`}
                style={isActive ? { color: moreItem.color } : {}}
              >
                {moreItem.label}
              </span>
            </button>
          );
        })()}

        {/* Sign out (icon-only-ish) */}
        <button
          onClick={async () => {
            await signOut(auth);
            navigate("/", { replace: true });
          }}
          className="relative flex flex-col items-center justify-center gap-0.5 w-16 h-full transition-colors"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="w-5 h-5 text-muted-foreground" />
          <span className="text-[10px] font-medium text-muted-foreground">Sign out</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;

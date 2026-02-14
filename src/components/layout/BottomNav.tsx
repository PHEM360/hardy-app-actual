import { useLocation, useNavigate } from "react-router-dom";
import { Home, PiggyBank, Heart, Shield, MoreHorizontal, LogOut } from "lucide-react";
import { motion } from "framer-motion";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useUserRole } from "@/auth/useUserRole";

const NAV_ITEMS = [
  { icon: Home, label: "Home", path: "/dashboard", color: "hsl(188, 33%, 38%)", gradient: "linear-gradient(135deg, hsl(188, 33%, 38%), hsl(191, 33%, 43%))" },
  { icon: PiggyBank, label: "Finance", path: "/finance", color: "hsl(25, 62%, 67%)", gradient: "linear-gradient(135deg, hsl(25, 62%, 67%), hsl(15, 55%, 58%))" },
  { icon: Heart, label: "Pets", path: "/pets", color: "hsl(0, 65%, 50%)", gradient: "linear-gradient(135deg, hsl(0, 65%, 50%), hsl(340, 55%, 45%))" },
  { icon: Shield, label: "Admin", path: "/admin", color: "hsl(205, 55%, 48%)", gradient: "linear-gradient(135deg, hsl(205, 55%, 48%), hsl(215, 50%, 42%))" },
  { icon: MoreHorizontal, label: "More", path: "/more", color: "hsl(191, 33%, 43%)", gradient: "linear-gradient(135deg, hsl(191, 33%, 43%), hsl(200, 40%, 38%))" },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { role, loading } = useUserRole();

  const navItems = NAV_ITEMS.filter((i) => {
    if (i.path !== "/admin") return true;
    // Hide Admin tab for non-admin users.
    // While loading, keep it hidden to avoid a brief flash.
    if (loading) return false;
    return role === "admin" || role === "superadmin";
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card safe-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== "/" && location.pathname.startsWith(item.path));
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

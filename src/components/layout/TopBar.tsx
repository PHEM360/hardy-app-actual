import { useState, useEffect, useMemo } from "react";
import { Bell, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { useAuth } from "@/auth/AuthContext";

const Star = ({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) => (
  <motion.div
    className="absolute rounded-full"
    style={{
      left: `${x}%`,
      top: `${y}%`,
      width: size,
      height: size,
      background: "hsl(0, 0%, 100%)",
    }}
    animate={{ opacity: [0.2, 0.9, 0.2], scale: [0.8, 1.2, 0.8] }}
    transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, delay }}
  />
);

const TopBar = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const displayName = user?.displayName || user?.email?.split("@")[0] || "";
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const hour = now.getHours();
  const isNight = hour >= 20 || hour < 6;

  const dateStr = format(now, "EEEE do MMM");
  const timeStr = format(now, "HH:mm");

  const stars = useMemo(() =>
    Array.from({ length: 18 }, (_, i) => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2.5,
      delay: Math.random() * 3,
    })), []
  );

  const renderAvatar = () => {
    const initial = (displayName || "?").charAt(0).toUpperCase();
    return <span className="text-xs font-bold" style={{ color: "#fff" }}>{initial}</span>;
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/5 overflow-hidden"
      style={{
        background: isNight
          ? "linear-gradient(135deg, hsl(210, 32%, 18%) 0%, hsl(200, 30%, 24%) 35%, hsl(192, 30%, 30%) 65%, hsl(188, 28%, 38%) 100%)"
          : "linear-gradient(135deg, hsl(210, 28%, 25%) 0%, hsl(200, 28%, 30%) 35%, hsl(192, 30%, 36%) 65%, hsl(188, 28%, 44%) 100%)",
      }}
    >
      {isNight && (
        <div className="absolute inset-0 pointer-events-none">
          {stars.map((s, i) => <Star key={i} {...s} />)}
        </div>
      )}
      <div className="relative flex items-center justify-between h-16 px-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center shadow-md ring-1 ring-white/15"
            style={{ background: "hsl(188, 33%, 38%)" }}
          >
            {renderAvatar()}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold font-display text-white/95 tracking-wide">{displayName}</p>
            <p className="text-[10px] text-white/55 font-medium tracking-wide">{dateStr} · {timeStr}</p>
          </div>
        </div>

        <div className="flex items-center gap-0.5">
          <button
            onClick={() => navigate("/notifications")}
            className="relative p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Bell className="w-5 h-5 text-white/60" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-destructive ring-2 ring-white/10" />
          </button>
          <button
            onClick={() => navigate("/settings")}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
          >
            <Settings className="w-5 h-5 text-white/60" />
          </button>
        </div>
      </div>
    </header>
  );
};

export default TopBar;

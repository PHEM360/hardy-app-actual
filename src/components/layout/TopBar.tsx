import { useState, useEffect } from "react";
import { Bell, Settings, ChevronDown, Home, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useAuth } from "@/auth/AuthContext";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useActiveHousehold } from "@/hooks/useActiveHousehold";
import { useAppearance } from "@/hooks/useAppearance";
import { useDisplayWeather } from "@/hooks/useDisplayWeather";
import { ChromeSceneLayer } from "@/components/chrome/ChromeSceneLayer";
import { resolveChromeScene } from "@/lib/chromeScenes";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { looksLikeGeneratedId } from "@/lib/householdIds";

const TopBar = () => {
  const navigate = useNavigate();
  const { user, viewAs, stopViewAs } = useAuth();
  const { profile } = useUserProfile();
  const { activeHouseholdId, availableHouseholds, setActiveHouseholdId } = useActiveHousehold();
  const {
    theme, headerScene, headerColor, headerPhotoUrl,
    headerShowWeather, headerShowDate, headerShowTime,
  } = useAppearance();
  const { weather } = useDisplayWeather();
  const namedHouseholds = availableHouseholds.filter((h) => !looksLikeGeneratedId(h.name) && h.name !== h.id);
  const displayName = profile?.displayName || profile?.firstName || user?.displayName || user?.email?.split("@")[0] || "";
  const firstName = displayName.split(" ")[0];
  const [now, setNow] = useState(new Date());
  const [householdMenuOpen, setHouseholdMenuOpen] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const hour = now.getHours();
  const isNight = hour >= 20 || hour < 6;
  const scene = resolveChromeScene(headerScene, { atmosphere: theme.atmosphere, isNight, fallback: "none" });
  const decorations = headerScene === "auto" ? (theme.decorations ?? []) : [];

  const dateStr = format(now, "EEEE do MMM");
  const timeStr = format(now, "HH:mm");
  const meta = [
    headerShowDate ? dateStr : null,
    headerShowTime ? timeStr : null,
    headerShowWeather && weather ? `${weather.temperature}° ${weather.description}` : null,
  ].filter(Boolean).join(" · ");

  const renderAvatar = () => {
    const avatarType = profile?.avatarType ?? "initials";
    const bgColor = profile?.avatarBgColor ?? "hsl(178, 55%, 36%)";
    const textColor = profile?.avatarTextColor ?? "#fff";

    if (avatarType === "emoji") {
      return (
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shadow-md ring-1 ring-white/15 text-xl"
          style={{ background: bgColor }}
        >
          {profile?.avatarEmoji ?? "😊"}
        </div>
      );
    }

    const initials = profile?.avatarInitials || (firstName || "?").charAt(0).toUpperCase();
    return (
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shadow-md ring-1 ring-white/15"
        style={{ background: bgColor }}
      >
        <span className="text-xs font-bold" style={{ color: textColor }}>{initials}</span>
      </div>
    );
  };

  return (
    <header
      className="sticky top-0 z-40 border-b border-white/5 overflow-hidden"
      style={{
        background: headerColor || "var(--chrome-header, var(--gradient-hero))",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {headerPhotoUrl && (
        <img src={headerPhotoUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 pointer-events-none" />
      )}
      {headerPhotoUrl && <div className="absolute inset-0 bg-black/35 pointer-events-none" />}
      <ChromeSceneLayer scene={scene} density="compact" />
      {decorations.length > 0 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-40">
          {decorations.map((emoji, i) => (
            <span
              key={`${emoji}-${i}`}
              className="absolute text-lg"
              style={{ left: `${18 + i * 28}%`, top: `${20 + (i % 2) * 28}%` }}
            >
              {emoji}
            </span>
          ))}
        </div>
      )}
      <div className="relative flex items-center justify-between h-16 px-4 max-w-screen-xl mx-auto w-full">
        <div className="flex items-center gap-3 min-w-0">
          {renderAvatar()}
          <div className="leading-tight min-w-0">
            <p className="text-sm font-semibold font-display text-white/95 tracking-wide truncate">{firstName}</p>
            {meta && <p className="text-[10px] text-white/55 font-medium tracking-wide truncate">{meta}</p>}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {namedHouseholds.length > 1 && (
            <Popover open={householdMenuOpen} onOpenChange={setHouseholdMenuOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl hover:bg-white/10 transition-colors max-w-[9rem]">
                  <Home className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                  <span className="text-xs font-semibold text-white/90 truncate">
                    {namedHouseholds.find((h) => h.id === activeHouseholdId)?.name || "Household"}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-56 p-1.5">
                {namedHouseholds.map((h) => (
                  <button
                    key={h.id}
                    onClick={() => { setActiveHouseholdId(h.id); setHouseholdMenuOpen(false); }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      h.id === activeHouseholdId ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted"
                    }`}
                  >
                    {h.name}
                  </button>
                ))}
              </PopoverContent>
            </Popover>
          )}
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
      {viewAs && (
        <div className="relative flex items-center justify-between gap-3 px-4 py-2 bg-amber-500">
          <p className="text-xs font-semibold text-white truncate">
            Viewing as {viewAs.name}{viewAs.email ? ` · ${viewAs.email}` : ""}
          </p>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={() => navigate("/admin")}
              className="px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 text-[11px] font-bold text-white"
            >
              Admin
            </button>
            <button
              type="button"
              onClick={stopViewAs}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 text-[11px] font-bold text-white"
            >
              <EyeOff className="w-3.5 h-3.5" />
              Exit
            </button>
          </div>
        </div>
      )}
    </header>
  );
};

export default TopBar;

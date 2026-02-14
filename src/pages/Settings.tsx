import { useState, useEffect } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Settings as SettingsIcon, Bell, Lock, Moon, Sun, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type AvatarType } from "@/types/app";
import { useAuth } from "@/auth/AuthContext";

// ── Avatar constants ──
const EMOJI_OPTIONS = ["😊", "🐶", "🐱", "🐴", "⛵", "🌸", "🔥", "💎", "🎯", "🦊", "🐾", "🌈"];
const BG_COLOR_OPTIONS = [
  "hsl(215, 60%, 28%)", "hsl(168, 55%, 36%)", "hsl(280, 45%, 55%)",
  "hsl(36, 85%, 54%)", "hsl(0, 72%, 51%)", "hsl(152, 60%, 38%)",
  "hsl(340, 65%, 47%)", "hsl(30, 80%, 50%)",
];
const TEXT_COLOR_OPTIONS = [
  "#ffffff", "#000000", "#f0f0f0", "#1a1a2e",
  "hsl(36, 85%, 54%)", "hsl(168, 55%, 60%)", "hsl(280, 45%, 75%)", "hsl(0, 72%, 70%)",
];

// ── Notification types ──
interface ReminderSetting { id: string; value: number; unit: "mins" | "hrs" | "days" | "weeks" }
interface NotificationType {
  key: string;
  label: string;
  group: string;
  enabled: boolean;
  reminders: ReminderSetting[];
}

const INITIAL_NOTIFICATION_TYPES: NotificationType[] = [
  { key: "billy_flea", label: "Billy Flea Treatment Due", group: "Flea & Worming", enabled: true, reminders: [{ id: "r1", value: 3, unit: "days" }] },
  { key: "milo_flea", label: "Milo Flea Treatment Due", group: "Flea & Worming", enabled: true, reminders: [{ id: "r2", value: 3, unit: "days" }] },
  { key: "billy_worm", label: "Billy Worming Treatment Due", group: "Flea & Worming", enabled: true, reminders: [{ id: "r3", value: 7, unit: "days" }] },
  { key: "milo_worm", label: "Milo Worming Treatment Due", group: "Flea & Worming", enabled: true, reminders: [{ id: "r4", value: 7, unit: "days" }] },
  { key: "household_item", label: "Household Item Due", group: "Household", enabled: true, reminders: [{ id: "r5", value: 14, unit: "days" }] },
];

// ── Avatar preview component ──
const AvatarPreview = ({ type, emoji, initials, bgColor, textColor, firstName }: {
  type: AvatarType; emoji: string; initials: string; bgColor: string; textColor: string; firstName: string;
}) => {
  const size = "w-20 h-20";
  if (type === "emoji") {
    return <div className={`${size} rounded-full flex items-center justify-center text-3xl`} style={{ background: bgColor }}>{emoji}</div>;
  }
  if (type === "image") {
    return <div className={`${size} rounded-full bg-muted flex items-center justify-center`}><span className="text-xs text-muted-foreground">Upload coming</span></div>;
  }
  return (
    <div className={`${size} rounded-full flex items-center justify-center text-2xl font-bold font-display`} style={{ background: bgColor, color: textColor }}>
      {initials || firstName.charAt(0).toUpperCase()}
    </div>
  );
};

const Settings = () => {
  const { user } = useAuth();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [pushNotifications, setPushNotifications] = useState(true);

  const [firstName, setFirstName] = useState(user?.displayName || "");
  const [surname, setSurname] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [email, setEmail] = useState(user?.email || "");

  const [avatarType, setAvatarType] = useState<AvatarType>("initials");
  const [avatarEmoji, setAvatarEmoji] = useState("😊");
  const [avatarInitials, setAvatarInitials] = useState(firstName ? firstName.charAt(0).toUpperCase() : "?");
  const [avatarBgColor, setAvatarBgColor] = useState(BG_COLOR_OPTIONS[0]);
  const [avatarTextColor, setAvatarTextColor] = useState("#ffffff");

  const [notifTypes, setNotifTypes] = useState(INITIAL_NOTIFICATION_TYPES);

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  const toggleNotifType = (key: string) => {
    setNotifTypes(prev => prev.map(n => n.key === key ? { ...n, enabled: !n.enabled } : n));
  };

  const addReminder = (key: string) => {
    setNotifTypes(prev => prev.map(n => {
      if (n.key !== key || n.reminders.length >= 3) return n;
      return { ...n, reminders: [...n.reminders, { id: `r${Date.now()}`, value: 1, unit: "days" }] };
    }));
  };

  const removeReminder = (key: string, remId: string) => {
    setNotifTypes(prev => prev.map(n => n.key === key ? { ...n, reminders: n.reminders.filter(r => r.id !== remId) } : n));
  };

  const updateReminder = (key: string, remId: string, field: "value" | "unit", val: string) => {
    setNotifTypes(prev => prev.map(n => n.key === key ? {
      ...n,
      reminders: n.reminders.map(r => r.id === remId ? { ...r, [field]: field === "value" ? parseInt(val) || 0 : val } : r),
    } : n));
  };

  // Group notifications
  const groups = [...new Set(notifTypes.map(n => n.group))];

  return (
    <FeaturePageShell title="Settings" subtitle="Account & app preferences" icon={<SettingsIcon className="w-5 h-5" />}>
      {/* Profile */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Profile</h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-4">
          {/* Avatar section - tightly grouped */}
          <div className="flex gap-4 items-start">
            <div className="flex flex-col items-center gap-2">
              <AvatarPreview type={avatarType} emoji={avatarEmoji} initials={avatarInitials} bgColor={avatarBgColor} textColor={avatarTextColor} firstName={firstName} />
              <div className="flex gap-1.5">
                {(["initials", "emoji", "image"] as AvatarType[]).map((type) => (
                  <button key={type} onClick={() => setAvatarType(type)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${avatarType === type ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                    {type === "initials" ? "Text" : type === "emoji" ? "Emoji" : "Photo"}
                  </button>
                ))}
              </div>
            </div>

            {/* Contextual editors right beside avatar */}
            <div className="flex-1 space-y-3 pt-1">
              {avatarType === "emoji" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Choose Emoji</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {EMOJI_OPTIONS.map((e) => (
                      <button key={e} onClick={() => setAvatarEmoji(e)}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${avatarEmoji === e ? "bg-primary/15 ring-2 ring-primary scale-110" : "bg-muted hover:bg-muted/80"}`}>
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {avatarType === "initials" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Display Text</Label>
                  <Input value={avatarInitials} onChange={(e) => setAvatarInitials(e.target.value.slice(0, 3).toUpperCase())} maxLength={3} className="h-9 rounded-xl text-sm w-20" />
                  <Label className="text-[10px]">Text Color</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {TEXT_COLOR_OPTIONS.map((c) => (
                      <button key={c} onClick={() => setAvatarTextColor(c)}
                        className={`w-6 h-6 rounded-full transition-all border border-border/50 ${avatarTextColor === c ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105"}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
              )}

              {avatarType !== "image" && (
                <div className="space-y-1.5">
                  <Label className="text-[10px]">Background</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {BG_COLOR_OPTIONS.map((c) => (
                      <button key={c} onClick={() => setAvatarBgColor(c)}
                        className={`w-6 h-6 rounded-full transition-all ${avatarBgColor === c ? "ring-2 ring-primary ring-offset-1 scale-110" : "hover:scale-105"}`}
                        style={{ background: c }} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">First Name</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-10 rounded-xl text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Surname</Label>
              <Input value={surname} onChange={(e) => setSurname(e.target.value)} className="h-10 rounded-xl text-sm" placeholder="e.g. Hardy" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Display Name <span className="text-muted-foreground">(optional)</span></Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-10 rounded-xl text-sm" placeholder="Leave blank to use first name" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} className="h-10 rounded-xl text-sm" />
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Notifications</h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-4">
          {/* Global toggle */}
          <div className="flex items-center justify-between pb-3 border-b border-border/30">
            <div>
              <p className="text-sm font-medium text-card-foreground">Push Notifications</p>
              <p className="text-[10px] text-muted-foreground">Receive alerts on your device</p>
            </div>
            <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
          </div>

          {/* Grouped notification types in 2 columns */}
          {groups.map((group) => (
            <div key={group}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {notifTypes.filter(n => n.group === group).map((nt) => (
                  <div key={nt.key} className="space-y-2 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium text-card-foreground leading-tight">{nt.label}</p>
                      <Switch checked={nt.enabled} onCheckedChange={() => toggleNotifType(nt.key)} className="scale-90" />
                    </div>

                    {nt.enabled && (
                      <div className="space-y-1.5">
                        {nt.reminders.map((rem) => (
                          <div key={rem.id} className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              value={rem.value}
                              onChange={(e) => updateReminder(nt.key, rem.id, "value", e.target.value)}
                              className="h-6 w-12 rounded-md text-[10px] text-center"
                              min={1}
                            />
                            <Select value={rem.unit} onValueChange={(v) => updateReminder(nt.key, rem.id, "unit", v)}>
                              <SelectTrigger className="h-6 w-16 rounded-md text-[10px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="mins">mins</SelectItem>
                                <SelectItem value="hrs">hrs</SelectItem>
                                <SelectItem value="days">days</SelectItem>
                                <SelectItem value="weeks">weeks</SelectItem>
                              </SelectContent>
                            </Select>
                            <span className="text-[9px] text-muted-foreground">before</span>
                            <button onClick={() => removeReminder(nt.key, rem.id)} className="p-0.5 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ))}
                        {nt.reminders.length < 3 && (
                          <button onClick={() => addReminder(nt.key)} className="flex items-center gap-1 text-[9px] text-primary font-medium">
                            <Plus className="w-2.5 h-2.5" /> Add another reminder
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Appearance */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Appearance</h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {darkMode ? <Moon className="w-4 h-4 text-muted-foreground" /> : <Sun className="w-4 h-4 text-muted-foreground" />}
              <div>
                <p className="text-sm font-medium text-card-foreground">Dark Mode</p>
                <p className="text-[10px] text-muted-foreground">Switch between light and dark themes</p>
              </div>
            </div>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Security</h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-3">
          <Button variant="outline" className="w-full h-10 rounded-xl text-sm justify-start gap-2">
            <Lock className="w-4 h-4" /> Change Password
          </Button>
          <Button variant="outline" className="w-full h-10 rounded-xl text-sm justify-start gap-2 text-destructive hover:text-destructive">
            Sign Out
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-4">Hardy Hub v1.0 · Made with ❤️</p>
    </FeaturePageShell>
  );
};

export default Settings;

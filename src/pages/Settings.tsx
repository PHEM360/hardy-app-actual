import { useState, useEffect } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Settings as SettingsIcon, Bell, Lock, Moon, Sun, Plus, Trash2, LogOut, GripVertical, X, Brain, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type AvatarType } from "@/types/app";
import { useAuth } from "@/auth/AuthContext";
import { signOut, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useHouseholdNames } from "@/hooks/useHouseholdNames";
import { CreatableMultiSelect } from "@/components/ui/creatable-multi-select";
import { useAiConfig } from "@/hooks/useAiConfig";

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

// All available nav destinations (More and Sign Out are pinned — not user-orderable)
const ALL_NAV_OPTIONS = [
  { path: "/dashboard",         label: "Home" },
  { path: "/tasks",             label: "Tasks" },
  { path: "/finance",           label: "Finance" },
  { path: "/pets",              label: "Pets" },
  { path: "/admin",             label: "Admin" },
  { path: "/companies",         label: "Companies" },
  { path: "/login-details",     label: "Log In Details" },
  { path: "/weight",            label: "Health" },
  { path: "/households",        label: "Households" },
  { path: "/household-finance", label: "Household Finance" },
  { path: "/tattersalls",       label: "Tattersalls" },
];
const DEFAULT_NAV = ["/dashboard", "/finance", "/pets", "/admin", "/more"];

// ── Notification types ──
interface ReminderSetting { id: string; value: number; unit: "mins" | "hrs" | "days" | "weeks" }
interface NotificationType {
  key: string; label: string; group: string; enabled: boolean; reminders: ReminderSetting[];
}
const INITIAL_NOTIFICATION_TYPES: NotificationType[] = [
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
  const navigate = useNavigate();
  const { profile, saveProfile } = useUserProfile();
  const existingHouseholdNames = useHouseholdNames();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [pushNotifications, setPushNotifications] = useState(true);

  const [firstName, setFirstName] = useState(user?.displayName || "");
  const [surname, setSurname] = useState("");
  const [displayName, setDisplayName] = useState(user?.displayName || "");
  const [householdNames, setHouseholdNames] = useState<string[]>([]);

  const [avatarType, setAvatarType] = useState<AvatarType>("initials");
  const [avatarEmoji, setAvatarEmoji] = useState("😊");
  const [avatarInitials, setAvatarInitials] = useState(firstName ? firstName.charAt(0).toUpperCase() : "?");
  const [avatarBgColor, setAvatarBgColor] = useState(BG_COLOR_OPTIONS[0]);
  const [avatarTextColor, setAvatarTextColor] = useState("#ffffff");

  // Bottom nav customisation
  const [navItems, setNavItems] = useState<string[]>(DEFAULT_NAV);
  const [navSaveSuccess, setNavSaveSuccess] = useState(false);

  const [notifTypes, setNotifTypes] = useState(INITIAL_NOTIFICATION_TYPES);
  const [saveProfileLoading, setSaveProfileLoading] = useState(false);
  const [saveProfileError, setSaveProfileError] = useState<string | null>(null);
  const [saveProfileSuccess, setSaveProfileSuccess] = useState(false);

  // Change password
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changePasswordLoading, setChangePasswordLoading] = useState(false);
  const [changePasswordError, setChangePasswordError] = useState<string | null>(null);
  const [changePasswordSuccess, setChangePasswordSuccess] = useState(false);

  // AI Configuration
  const { apiKey: savedApiKey, saveApiKey } = useAiConfig();
  const [geminiKeyInput, setGeminiKeyInput] = useState("");
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiSaving, setGeminiSaving] = useState(false);
  const [geminiSaved, setGeminiSaved] = useState(false);
  useEffect(() => { if (savedApiKey) setGeminiKeyInput(savedApiKey); }, [savedApiKey]);

  // Populate from Firestore profile once loaded
  useEffect(() => {
    if (!profile) return;
    if (profile.firstName) setFirstName(profile.firstName);
    if (profile.surname) setSurname(profile.surname);
    if (profile.displayName) setDisplayName(profile.displayName);
    if (profile.householdId) setHouseholdNames(profile.householdIds?.length ? profile.householdIds : [profile.householdId]);
    if (profile.avatarType) setAvatarType(profile.avatarType as AvatarType);
    if (profile.avatarEmoji) setAvatarEmoji(profile.avatarEmoji);
    if (profile.avatarInitials) setAvatarInitials(profile.avatarInitials);
    if (profile.avatarBgColor) setAvatarBgColor(profile.avatarBgColor);
    if (profile.avatarTextColor) setAvatarTextColor(profile.avatarTextColor);
    if (profile.navItems && profile.navItems.length > 0) setNavItems(profile.navItems);
  }, [profile?.uid]); // only run once when profile first loads

  const saveProfileHandler = async () => {
    if (!user) return;
    setSaveProfileError(null);
    setSaveProfileSuccess(false);
    setSaveProfileLoading(true);
    try {
      const name = displayName.trim() || [firstName.trim(), surname.trim()].filter(Boolean).join(" ") || firstName.trim();
      // Update Firebase Auth display name
      await updateProfile(user, { displayName: name });
      // Persist everything to Firestore
      await saveProfile({
        firstName: firstName.trim(),
        surname: surname.trim(),
        displayName: name,
        householdId: householdNames[0] || undefined,
        householdIds: householdNames.length ? householdNames : undefined,
        avatarType,
        avatarEmoji,
        avatarInitials,
        avatarBgColor,
        avatarTextColor,
      });
      setSaveProfileSuccess(true);
      setTimeout(() => setSaveProfileSuccess(false), 3000);
    } catch (err: any) {
      setSaveProfileError(err?.message ?? "Failed to save. Please try again.");
    } finally {
      setSaveProfileLoading(false);
    }
  };

  const saveNavItems = async () => {
    await saveProfile({ navItems });
    setNavSaveSuccess(true);
    setTimeout(() => setNavSaveSuccess(false), 2000);
  };

  const changePasswordHandler = async () => {
    if (!user || !user.email) return;
    setChangePasswordError(null);
    setChangePasswordSuccess(false);
    if (!currentPassword) { setChangePasswordError("Please enter your current password."); return; }
    if (newPassword.length < 6) { setChangePasswordError("New password must be at least 6 characters."); return; }
    if (newPassword !== confirmPassword) { setChangePasswordError("New passwords do not match."); return; }
    setChangePasswordLoading(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);
      setChangePasswordSuccess(true);
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      setTimeout(() => { setChangePasswordSuccess(false); setShowChangePassword(false); }, 3000);
    } catch (err: any) {
      const code = err?.code ?? "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        setChangePasswordError("Current password is incorrect.");
      } else if (code === "auth/too-many-requests") {
        setChangePasswordError("Too many attempts. Please try again later.");
      } else {
        setChangePasswordError(err?.message ?? "Failed to change password.");
      }
    } finally {
      setChangePasswordLoading(false);
    }
  };

  const toggleNavItem = (path: string) => {
    setNavItems((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

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

  const groups = [...new Set(notifTypes.map(n => n.group))];

  return (
    <FeaturePageShell title="Settings" subtitle="Account & app preferences" icon={<SettingsIcon className="w-5 h-5" />}>
      {/* Profile */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Profile</h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-4">
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
            <Label className="text-xs">Household Name(s) <span className="text-muted-foreground">(optional)</span></Label>
            <CreatableMultiSelect
              value={householdNames}
              onChange={setHouseholdNames}
              options={existingHouseholdNames}
              placeholder="Select or type a household name…"
            />
            <p className="text-[10px] text-muted-foreground">The first name appears as the title on your Household page. You can belong to more than one.</p>
          </div>
          {saveProfileError && (
            <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{saveProfileError}</p>
          )}
          {saveProfileSuccess && (
            <p className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">✓ Profile saved successfully</p>
          )}
          <Button onClick={saveProfileHandler} disabled={saveProfileLoading} className="w-full h-10 rounded-xl bg-gradient-primary text-sm">
            {saveProfileLoading ? "Saving…" : "Save Profile"}
          </Button>
        </div>
      </div>

      {/* Bottom Nav customisation */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Bottom Navigation</h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-3">
          <p className="text-xs text-muted-foreground">Drag to reorder. Tap to toggle on/off. <strong>More</strong> and <strong>Sign Out</strong> are always shown on the right.</p>
          <div className="space-y-1.5">
            {ALL_NAV_OPTIONS.map((item, index) => {
              const active = navItems.includes(item.path);
              return (
                <div
                  key={item.path}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("navPath", item.path); }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const from = e.dataTransfer.getData("navPath");
                    if (from === item.path) return;
                    setNavItems((prev) => {
                      // Work from all orderable paths, inserting missing ones at end
                      const allPaths = ALL_NAV_OPTIONS.map(o => o.path);
                      const ordered = allPaths.filter(p => prev.includes(p) || p === from);
                      const fromIdx = ordered.indexOf(from);
                      const toIdx = ordered.indexOf(item.path);
                      if (fromIdx === -1 || toIdx === -1) return prev;
                      const next = [...ordered];
                      next.splice(fromIdx, 1);
                      next.splice(toIdx, 0, from);
                      // Preserve only what was previously active, but in new order
                      return next.filter(p => prev.includes(p));
                    });
                  }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-grab active:cursor-grabbing ${
                    active ? "bg-primary/10 border-primary/30" : "bg-muted/40 border-transparent opacity-50"
                  }`}
                >
                  <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <span className={`flex-1 text-xs font-medium ${active ? "text-primary" : "text-muted-foreground"}`}>{item.label}</span>
                  <button
                    onClick={() => toggleNavItem(item.path)}
                    className={`w-5 h-5 rounded-full border-2 flex-shrink-0 transition-all ${
                      active ? "bg-primary border-primary" : "bg-transparent border-muted-foreground/40"
                    }`}
                    aria-label={active ? "Remove from nav" : "Add to nav"}
                  >
                    {active && <X className="w-3 h-3 text-primary-foreground m-auto" />}
                  </button>
                </div>
              );
            })}
          </div>
          {/* Pinned items preview */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-[10px] text-muted-foreground">Always shown:</span>
            <span className="text-[10px] bg-muted/60 px-2 py-0.5 rounded-full text-muted-foreground">More</span>
            <span className="text-[10px] bg-muted/60 px-2 py-0.5 rounded-full text-muted-foreground">Sign Out</span>
          </div>
          {navSaveSuccess && <p className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">✓ Navigation saved</p>}
          <Button onClick={saveNavItems} className="w-full h-10 rounded-xl text-sm">Save Navigation</Button>
        </div>
      </div>

      {/* Notifications */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Notifications</h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-border/30">
            <div>
              <p className="text-sm font-medium text-card-foreground">Push Notifications</p>
              <p className="text-[10px] text-muted-foreground">Receive alerts on your device</p>
            </div>
            <Switch checked={pushNotifications} onCheckedChange={setPushNotifications} />
          </div>
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
                            <Input type="number" value={rem.value} onChange={(e) => updateReminder(nt.key, rem.id, "value", e.target.value)} className="h-6 w-16 rounded-md text-[10px] text-center" min={1} />
                            <Select value={rem.unit} onValueChange={(v) => updateReminder(nt.key, rem.id, "unit", v)}>
                              <SelectTrigger className="h-6 w-20 rounded-md text-[10px]"><SelectValue /></SelectTrigger>
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

      {/* AI Configuration */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">AI Configuration</h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-violet-500/15 flex-shrink-0">
              <Brain className="w-4 h-4 text-violet-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-card-foreground">OpenAI API Key</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Powers AI Health Assessment using GPT-4o Mini. Get a key at{" "}
                <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-violet-600 underline">platform.openai.com</a>
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Input
                type={showGeminiKey ? "text" : "password"}
                value={geminiKeyInput}
                onChange={(e) => { setGeminiKeyInput(e.target.value); setGeminiSaved(false); }}
                placeholder="sk-…"
                className="h-11 rounded-xl pr-10 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowGeminiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <Button
              onClick={async () => {
                setGeminiSaving(true);
                await saveApiKey(geminiKeyInput.trim());
                setGeminiSaving(false);
                setGeminiSaved(true);
                setTimeout(() => setGeminiSaved(false), 3000);
              }}
              disabled={geminiSaving || !geminiKeyInput.trim()}
              className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm gap-2"
            >
              {geminiSaved
                ? <><CheckCircle2 className="w-4 h-4" />Key saved</>
                : geminiSaving ? "Saving…" : "Save API Key"}
            </Button>
          </div>
          {savedApiKey && (
            <p className="text-[11px] text-green-600 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" /> API key is configured · AI Health Assessment is enabled
            </p>
          )}
        </div>
      </div>

      {/* Security */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3">Security</h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-3">
          {!showChangePassword ? (
            <Button variant="outline" className="w-full h-10 rounded-xl text-sm justify-start gap-2" onClick={() => { setShowChangePassword(true); setChangePasswordError(null); setChangePasswordSuccess(false); }}>
              <Lock className="w-4 h-4" /> Change Password
            </Button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-card-foreground">Change Password</p>
              <div className="space-y-1.5">
                <Label className="text-xs">Current Password</Label>
                <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="h-10 rounded-xl text-sm" placeholder="Enter current password" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">New Password</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-10 rounded-xl text-sm" placeholder="At least 6 characters" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Confirm New Password</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && changePasswordHandler()} className="h-10 rounded-xl text-sm" placeholder="Repeat new password" />
              </div>
              {changePasswordError && <p className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{changePasswordError}</p>}
              {changePasswordSuccess && <p className="text-xs text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">✓ Password changed successfully</p>}
              <div className="flex gap-2">
                <Button onClick={changePasswordHandler} disabled={changePasswordLoading} className="flex-1 h-10 rounded-xl bg-gradient-primary text-sm">
                  {changePasswordLoading ? "Saving…" : "Update Password"}
                </Button>
                <Button variant="outline" onClick={() => { setShowChangePassword(false); setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setChangePasswordError(null); }} className="h-10 rounded-xl px-4 text-sm">
                  Cancel
                </Button>
              </div>
            </div>
          )}
          <Button variant="outline" className="w-full h-10 rounded-xl text-sm justify-start gap-2 text-destructive hover:text-destructive"
            onClick={async () => { await signOut(auth); navigate("/", { replace: true }); }}>
            <LogOut className="w-4 h-4" /> Sign Out
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center mt-4">Hardy Hub v1.0 · Made with ❤️</p>
    </FeaturePageShell>
  );
};

export default Settings;

import { useState, useEffect } from "react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import { Settings as SettingsIcon, Bell, Lock, Moon, Sun, LogOut, GripVertical, X, Brain, Eye, EyeOff, CheckCircle2, MonitorSmartphone, Pencil, Check, Fingerprint, ShieldCheck, LayoutGrid } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { type AvatarType } from "@/types/app";
import { useAuth } from "@/auth/AuthContext";
import { signOut, updateProfile, updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useNavigate } from "react-router-dom";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useEffectiveRole } from "@/auth/useEffectiveRole";
import { canAccessRoute, DEFAULT_BOTTOM_NAV } from "@/lib/features";
import { useIncomingPageShares } from "@/hooks/usePageShares";
import { useHouseholdNames } from "@/hooks/useHouseholdNames";
import { CreatableMultiSelect } from "@/components/ui/creatable-multi-select";
import { useAiConfig } from "@/hooks/useAiConfig";
import { useMyDevices } from "@/hooks/useMyDevices";
import { useSecuritySettings } from "@/hooks/useSecuritySettings";
import { authenticateWithPasskey, passkeyErrorMessage, registerPasskey } from "@/lib/passkeys";
import { SECURITY_MODULES, type AppSecuritySettings, type SecurityRequirement } from "@/types/security";
import { ChangeVaultPinCard } from "@/components/passwords/ChangeVaultPinCard";
import { OnePasswordConnectCard } from "@/components/passwords/OnePasswordConnectCard";
import { toast } from "sonner";
import { HomeLayoutChooser } from "@/components/home/HomeLayoutChooser";
import type { HomeLayoutMode } from "@/lib/homeLayout";

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
  { path: "/notes",             label: "Notes" },
  { path: "/photos",            label: "Photos" },
  { path: "/finance",           label: "Finance" },
  { path: "/pets",              label: "Pets" },
  { path: "/admin",             label: "Admin" },
  { path: "/companies",         label: "Companies" },
  { path: "/login-details",     label: "Log In Details" },
  { path: "/weight",            label: "Health" },
  { path: "/households",        label: "Households" },
  { path: "/household-finance", label: "Household Finance" },
  { path: "/tattersalls",       label: "Flats" },
  { path: "/ai-analysis",       label: "AI Analysis" },
  { path: "/holidays",          label: "Holidays" },
  { path: "/remote-displays",   label: "Remote Displays" },
];
const DEFAULT_NAV = [...DEFAULT_BOTTOM_NAV, "/more"];

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
  const { profile, saveProfile, loading: profileLoading } = useUserProfile();
  const { role, loading: roleLoading } = useEffectiveRole();
  const { pages: sharedPages, loading: sharesLoading } = useIncomingPageShares();
  const existingHouseholdNames = useHouseholdNames();
  const [darkMode, setDarkMode] = useState(() => document.documentElement.classList.contains("dark"));
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

  // Linked Displays
  const { devices, loading: devicesLoading, renameDevice, forgetDevice } = useMyDevices();
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deviceLabelDraft, setDeviceLabelDraft] = useState("");
  const [forgetConfirmId, setForgetConfirmId] = useState<string | null>(null);

  // Passkeys and per-module security
  const {
    settings: securitySettings,
    passkeyEnrolled,
    saveSettings: saveSecuritySettings,
  } = useSecuritySettings();
  const [securityDraft, setSecurityDraft] = useState<AppSecuritySettings>(securitySettings);
  const [securitySaving, setSecuritySaving] = useState(false);
  const [addingPasskey, setAddingPasskey] = useState(false);
  useEffect(() => setSecurityDraft(securitySettings), [securitySettings]);

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
    if (newPassword.length < 8) { setChangePasswordError("New password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword)) { setChangePasswordError("Include at least one upper-case and one lower-case letter."); return; }
    if (!/[0-9]/.test(newPassword) || !/[^a-zA-Z0-9]/.test(newPassword)) { setChangePasswordError("Include at least one number and one special character."); return; }
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

  const saveSecurity = async () => {
    setSecuritySaving(true);
    try {
      await authenticateWithPasskey(true);
      await saveSecuritySettings(securityDraft);
      toast.success("Security settings saved");
    } catch {
      toast.error("Could not save security settings");
    } finally {
      setSecuritySaving(false);
    }
  };

  const addAnotherPasskey = async () => {
    setAddingPasskey(true);
    try {
      try {
        await registerPasskey("This device");
      } catch (error) {
        const code = String((error as { code?: string } | undefined)?.code || "");
        if (!passkeyEnrolled || !code.includes("failed-precondition")) throw error;
        await authenticateWithPasskey(true);
        await registerPasskey("This device");
      }
      toast.success("Passkey added to this device");
    } catch (error) {
      toast.error(passkeyErrorMessage(error));
    } finally {
      setAddingPasskey(false);
    }
  };

  const toggleNavItem = (path: string) => {
    setNavItems((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  };

  const navOptions = ALL_NAV_OPTIONS.filter((item) => {
    if (roleLoading || profileLoading || sharesLoading) return item.path === "/dashboard";
    return canAccessRoute(role, profile?.enabledFeatures ?? [], item.path, sharedPages);
  });

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  return (
    <FeaturePageShell title="Settings" subtitle="Account & app preferences" icon={<SettingsIcon className="w-5 h-5" />}>
      {/* Profile */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-gradient-primary flex items-center justify-center text-white text-[10px]">P</span>
          Profile
        </h3>
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
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center text-white text-[10px]">N</span>
          Bottom Navigation
        </h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-3">
          <p className="text-xs text-muted-foreground">Drag to reorder. Tap to toggle on/off. <strong>More</strong> and <strong>Sign Out</strong> are always shown on the right.</p>
          <div className="space-y-1.5">
            {navOptions.map((item) => {
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
                      const allPaths = navOptions.map(o => o.path);
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
          <Button onClick={saveNavItems} className="w-full h-10 rounded-xl text-sm bg-gradient-primary">Save Navigation</Button>
        </div>
      </div>

      {/* Notifications */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-amber-500 flex items-center justify-center text-white text-[10px]">N</span>
          Notifications
        </h3>
        <button
          onClick={() => navigate("/notifications")}
          className="w-full flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 shadow-soft hover:bg-muted/40 transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium text-card-foreground">Notification Settings</p>
              <p className="text-[10px] text-muted-foreground">Email, SMS, and push — configure channels and reminders</p>
            </div>
          </div>
          <span className="text-muted-foreground text-lg leading-none">›</span>
        </button>
      </div>

      {/* Home layout */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-teal-600 flex items-center justify-center text-white">
            <LayoutGrid className="w-3 h-3" />
          </span>
          Home
        </h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft">
          <p className="text-sm font-medium text-card-foreground">Home screen</p>
          <p className="mb-3 text-[10px] text-muted-foreground">Today’s planner, or a welcome plus page tiles you can rearrange.</p>
          <HomeLayoutChooser
            title=""
            description=""
            value={profile?.homeLayout}
            onChoose={(mode: HomeLayoutMode) => {
              void saveProfile({ homeLayout: mode });
              toast.success(mode === "today" ? "Home is now Today" : "Home is now Tiles");
            }}
          />
        </div>
      </div>

      {/* Appearance */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-purple-500 flex items-center justify-center text-white text-[10px]">A</span>
          Appearance
        </h3>
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

      {/* Linked Displays */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-sky-600 flex items-center justify-center text-white text-[10px]">
            <MonitorSmartphone className="w-3 h-3" />
          </span>
          Linked Displays
        </h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-3">
          <p className="text-xs text-muted-foreground">
            Always-on screens (hardyapp.co.uk/display) signed into your account. Removing one signs it out —
            QR-paired displays disconnect within moments, direct sign-ins next time they check in.
          </p>

          {devicesLoading && <p className="text-xs text-muted-foreground">Loading…</p>}
          {!devicesLoading && devices.length === 0 && (
            <p className="text-xs text-muted-foreground">No displays linked yet.</p>
          )}

          {devices.map((d) => {
            const lastSeen = d.lastSeenAt && typeof (d.lastSeenAt as { toDate?: () => Date }).toDate === "function"
              ? (d.lastSeenAt as { toDate: () => Date }).toDate()
              : null;
            const isEditing = editingDeviceId === d.id;
            const isConfirmingForget = forgetConfirmId === d.id;

            return (
              <div key={d.id} className="p-3 rounded-xl bg-muted/40 border border-border/40 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        value={deviceLabelDraft}
                        onChange={(e) => setDeviceLabelDraft(e.target.value)}
                        className="h-8 rounded-lg text-sm"
                        autoFocus
                      />
                      <button
                        onClick={async () => { await renameDevice(d.id, deviceLabelDraft); setEditingDeviceId(null); }}
                        className="p-1.5 text-primary"
                        aria-label="Save name"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => { setEditingDeviceId(d.id); setDeviceLabelDraft(d.label); }}
                      className="flex items-center gap-1.5 text-sm font-medium text-card-foreground"
                    >
                      {d.label}
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </button>
                  )}
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground px-1.5 py-0.5 rounded-md bg-background border border-border/50 flex-shrink-0">
                    {d.pairedVia === "qr" ? "QR paired" : "Direct sign-in"}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-[11px] text-muted-foreground">
                    {lastSeen ? `Active ${formatDistanceToNow(lastSeen, { addSuffix: true })}` : "Never checked in"}
                  </p>

                  {isConfirmingForget ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={async () => { await forgetDevice(d.id); setForgetConfirmId(null); }}
                        className="text-[11px] font-semibold text-destructive"
                      >
                        Confirm forget
                      </button>
                      <button onClick={() => setForgetConfirmId(null)} className="text-[11px] text-muted-foreground">
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setForgetConfirmId(d.id)}
                      className="text-[11px] font-medium text-destructive"
                    >
                      Forget device
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Configuration */}
      <div className="mb-5">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-violet-600 flex items-center justify-center text-white text-[10px]">AI</span>
          AI Configuration
        </h3>
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
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1 mb-3 flex items-center gap-2">
          <span className="w-5 h-5 rounded-md bg-red-500 flex items-center justify-center text-white text-[10px]">S</span>
          Security
        </h3>
        <div className="p-4 rounded-xl bg-card border border-border/50 shadow-soft space-y-3">
          <div className="rounded-2xl border border-primary/20 border-l-4 border-l-primary bg-[color-mix(in_srgb,hsl(var(--primary))_10%,hsl(var(--card)))] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground">
                <Fingerprint className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Passkey protected</span>
                <span className="block text-[11px] text-muted-foreground">
                  {passkeyEnrolled ? "Your account has a passkey. Add this device for local Face ID or fingerprint prompts." : "Passkey setup is required"}
                </span>
              </span>
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <Button variant="outline" size="sm" className="w-full rounded-xl" disabled={addingPasskey} onClick={() => void addAnotherPasskey()}>
              <Fingerprint className="mr-2 h-4 w-4" />
              {addingPasskey ? "Creating passkey…" : "Add Face ID / fingerprint on this device"}
            </Button>
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Passwordless sign-in</p>
              <p className="text-[11px] text-muted-foreground">A successful passkey unlocks the app and protected pages for this period. The default is 7 days.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Ask me</Label>
                <select
                  value={securityDraft.appUnlockMode}
                  onChange={(event) => setSecurityDraft((current) => ({ ...current, appUnlockMode: event.target.value as AppSecuritySettings["appUnlockMode"] }))}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs"
                >
                  <option value="passkey_freshness">When my passkey is no longer recent</option>
                  <option value="interval">After a set period</option>
                  <option value="every_open">Every time I open the app</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Verification method</Label>
                <select
                  value={securityDraft.appUnlockMethod}
                  onChange={(event) => setSecurityDraft((current) => ({ ...current, appUnlockMethod: event.target.value as AppSecuritySettings["appUnlockMethod"] }))}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs"
                >
                  <option value="passkey">Passkey</option>
                  <option value="password">Email password</option>
                  <option value="either">Passkey or password</option>
                </select>
              </div>
            </div>
            {securityDraft.appUnlockMode !== "every_open" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Period</Label>
                <select
                  value={securityDraft.appUnlockIntervalDays}
                  onChange={(event) => setSecurityDraft((current) => ({ ...current, appUnlockIntervalDays: Number(event.target.value) }))}
                  className="h-10 w-full rounded-xl border border-border bg-background px-3 text-xs"
                >
                  <option value={1}>Every day</option>
                  <option value={7}>Every 7 days</option>
                  <option value={14}>Every 14 days</option>
                  <option value={30}>Every month</option>
                  <option value={90}>Every 3 months</option>
                </select>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold">Page security</p>
              <p className="text-[11px] text-muted-foreground">
                Protected pages reuse a passkey presented within your chosen period. Log Ins uses its own vault passcode / device biometrics instead of a second page passkey.
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {SECURITY_MODULES.map((module) => {
                const requirement = securityDraft.moduleRequirements[module.id] || "none";
                const isLogins = module.id === "passwords";
                return (
                  <label key={module.id} className="flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5">
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{module.label}</span>
                    {isLogins ? (
                      <span className="rounded-lg border border-border bg-card px-2 py-1 text-[10px] text-muted-foreground">
                        Vault unlock
                      </span>
                    ) : (
                      <select
                        value={requirement}
                        onChange={(event) => {
                          const value = event.target.value as SecurityRequirement;
                          setSecurityDraft((current) => ({
                            ...current,
                            moduleRequirements: { ...current.moduleRequirements, [module.id]: value },
                          }));
                        }}
                        className="rounded-lg border border-border bg-card px-2 py-1 text-[10px]"
                      >
                        <option value="none">No extra check</option>
                        <option value="passkey">Passkey</option>
                        <option value="password">Password</option>
                      </select>
                    )}
                  </label>
                );
              })}
            </div>
            <Button className="w-full rounded-xl bg-gradient-primary" disabled={securitySaving} onClick={() => void saveSecurity()}>
              {securitySaving ? "Saving…" : "Save security settings"}
            </Button>
          </div>

          <ChangeVaultPinCard />

          <OnePasswordConnectCard />

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
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-10 rounded-xl text-sm" placeholder="8+ characters, mixed case, number & symbol" />
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

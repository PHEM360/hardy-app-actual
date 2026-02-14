import { ReactNode } from "react";

export type UserRole = "super_admin" | "admin" | "member";

export type FeatureKey =
  | "finance_personal"
  | "finance_household"
  | "inheritance_tax"
  | "households"
  | "pets"
  | "weight_tracking"
  | "tattersalls"
  | "admin";

export type AvatarType = "initials" | "emoji" | "image";

export interface AvatarConfig {
  type: AvatarType;
  emoji?: string;
  imageUrl?: string;
  initials?: string;
  bgColor?: string;
  textColor?: string;
}

export type LanguageStyle = "default" | "sassy" | "loving" | "funny" | "formal";

export interface UserStylePreferences {
  languageStyle: LanguageStyle;
  themeEmojis?: string[]; // e.g. ["🐴", "🌾", "🚜"] for Sarah
  themeKeywords?: string[]; // e.g. ["horses", "farming"]
}

export interface User {
  id: string;
  firstName: string;
  surname: string;
  displayName?: string;
  email: string;
  role: UserRole;
  avatar: AvatarConfig;
  householdId?: string;
  enabledFeatures: FeatureKey[];
  suspended: boolean;
  lastLogin?: Date;
  stylePreferences?: UserStylePreferences;
}

export interface FeatureModule {
  key: FeatureKey;
  label: string;
  description: string;
  icon: string;
  route: string;
  color: "primary" | "secondary" | "success" | "warning" | "info" | "destructive";
}

export const FEATURE_MODULES: FeatureModule[] = [
  {
    key: "finance_personal",
    label: "My Finances",
    description: "Track accounts, balances & spending",
    icon: "wallet",
    route: "/finance",
    color: "primary",
  },
  {
    key: "finance_household",
    label: "Household Finance",
    description: "Shared expenses & budgets",
    icon: "home",
    route: "/household-finance",
    color: "success",
  },
  {
    key: "inheritance_tax",
    label: "IHT Planner",
    description: "Inheritance tax scenario modelling",
    icon: "calculator",
    route: "/inheritance",
    color: "info",
  },
  {
    key: "households",
    label: "Households",
    description: "Documents, insurance & shared records",
    icon: "users",
    route: "/households",
    color: "secondary",
  },
  {
    key: "pets",
    label: "Pets",
    description: "Billy & Milo — health, weight & care",
    icon: "heart",
    route: "/pets",
    color: "warning",
  },
  {
    key: "weight_tracking",
    label: "Weight Tracker",
    description: "Personal weight logging & trends",
    icon: "activity",
    route: "/weight",
    color: "primary",
  },
  {
    key: "tattersalls",
    label: "Tattersalls",
    description: "Flat management & expenses",
    icon: "building",
    route: "/tattersalls",
    color: "info",
  },
  {
    key: "admin",
    label: "Admin",
    description: "Users, security & system settings",
    icon: "shield",
    route: "/admin",
    color: "destructive",
  },
];

// Helper to get the name to display
export function getDisplayName(user: User): string {
  return user.displayName || user.firstName;
}

// Note: previous demo/mock user has been removed. The app now relies on
// Firebase Auth for the signed-in user.

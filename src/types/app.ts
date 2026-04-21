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
  | "tasks"
  | "companies"
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
    key: "tasks",
    label: "Tasks",
    description: "Track and manage everything",
    icon: "check-square",
    route: "/tasks",
    color: "primary",
  },
  {
    key: "companies",
    label: "Companies",
    description: "Business logins, services & expenses",
    icon: "briefcase",
    route: "/companies",
    color: "secondary",
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

// ─── Tasks ────────────────────────────────────────────────────────────────────

export type TaskPriority = "critical" | "high" | "medium" | "low";
export type TaskStatus = "todo" | "in_progress" | "done";
export type TaskUrgency = "none" | "amber" | "red";

export interface TaskSubtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id?: string;
  title: string;
  description?: string;
  notes?: string;          // free-form notes, separate from description
  priority: TaskPriority;
  status: TaskStatus;
  urgency?: TaskUrgency;   // red/amber dot — separate from priority
  category: string;       // e.g. "Admin", "Development", "Personal"
  company?: string;       // company ID or name
  dueDate?: string;       // ISO date string
  isToday: boolean;
  tags: string[];
  subtasks?: TaskSubtask[];
  customFields?: Record<string, string>; // keyed by TaskCustomField.id
  createdAt?: any;
  updatedAt?: any;
}

export interface TaskCustomField {
  id: string;       // slug key, e.g. "client_name"
  label: string;    // display name, e.g. "Client"
  options: string[]; // always has "Other" appended at end
  color?: string;   // hex colour for this field group
}

export interface TaskSettings {
  categories: string[];
  companies: string[];
  customFields: TaskCustomField[];
  categoryColors?: Record<string, string>;  // category → hex
  companyColors?: Record<string, string>;   // company → hex
  tileOrder?: string[];                     // task ids in user-defined order (tile view)
  showCompleted?: boolean;                  // default false — hide completed tasks
}

// ─── Marketing ────────────────────────────────────────────────────────────────

export type SocialPlatform = "instagram" | "linkedin" | "facebook";
export type ContentStatus = "suggestion" | "draft" | "approved" | "posted";
export type ContentType = "social_post" | "article" | "campaign_idea";

export interface MarketingProfile {
  brandVoice: string;          // e.g. "Direct, no-nonsense, expert tone"
  targetAudience: string;      // e.g. "Neurodivergent professionals aged 25-45"
  keyMessages: string[];       // Core things to always communicate
  competitors: string[];       // Competitor names/URLs for context
  platforms: SocialPlatform[]; // Active platforms
  tradingNames: string[];      // Trading names for this company
  relatedCompanyIds: string[]; // Other companies with overlapping audience
  industry: string;            // e.g. "Executive coaching / neurodiversity"
  updatedAt?: any;
}

export interface ContentPiece {
  id?: string;
  type: ContentType;
  platform: SocialPlatform | "website";
  topic: string;
  trendReason?: string;         // Why AI suggested this now
  draft: string;                // AI-generated draft
  refinedDraft?: string;        // After user edits
  hashtags?: string[];
  status: ContentStatus;
  postedAt?: string;
  createdAt?: any;
  updatedAt?: any;
}

// ─── Companies ────────────────────────────────────────────────────────────────

export interface CompanyLogin {
  id?: string;
  service: string;        // e.g. "Xero", "Companies House"
  username: string;
  password?: string;
  url?: string;
  notes?: string;
}

export interface CompanyService {
  id?: string;
  name: string;
  description?: string;
  price: number;           // per unit
  unit: string;            // e.g. "per month", "per project", "per hour"
  category?: string;
}

export interface CompanyExpense {
  id?: string;
  date: string;
  description: string;
  amount: number;
  category: string;        // e.g. "Software", "Marketing", "Payroll"
  receipts?: string[];     // Storage download URLs
  createdAt?: any;
}

export interface CompanyContactDetails {
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  vatNumber?: string;
  companyNumber?: string;
}

export interface CompanySettings {
  incomeCategories: string[];
  expenseCategories: string[];
  corporateTaxRate: number;       // default 19
}

export const DEFAULT_COMPANY_SETTINGS: CompanySettings = {
  incomeCategories: ["Consulting", "Software", "Services", "Products", "Licences", "Other"],
  expenseCategories: ["Software", "Marketing", "Payroll", "Equipment", "Travel", "Legal", "Accountancy", "Office", "Other"],
  corporateTaxRate: 19,
};

export interface Company {
  id?: string;
  name: string;
  description?: string;
  color: string;           // e.g. "#6366f1"
  emoji?: string;          // e.g. "🏢"
  taxYearStart: string;    // ISO date, e.g. "2025-04-06"
  contact: CompanyContactDetails;
  createdAt?: any;
  updatedAt?: any;
}

// ─── Household ────────────────────────────────────────────────────────────────

export interface HouseholdMember {
  id: string;
  name: string;
  role: "admin" | "member";
  emoji?: string;
}

export interface HouseholdReminder {
  amount: number;              // e.g. 7
  unit: "hours" | "days" | "weeks" | "months";
  via: "push";
}

export type CostPeriod = "days" | "weeks" | "months" | "years" | "one-off" | "other";

export interface HouseholdHistoryEntry {
  archivedAt: string;          // ISO date string
  costAmount?: number;
  costPeriod?: CostPeriod;
  costPeriodCustom?: string;
  startDate?: string;
  endDate?: string;
  provider?: string;
  policyNumber?: string;
  notes?: string;
}

export interface HouseholdItem {
  id?: string;
  type: string;                // category key or custom label
  provider: string;
  policyNumber?: string;
  /** @deprecated use costAmount + costPeriod */
  monthlyPremium?: number;
  costAmount?: number;
  costPeriod?: CostPeriod;
  costPeriodCustom?: string;   // shown when costPeriod === "other"
  startDate?: string;
  endDate?: string;            // renewal / expiry date
  assignedTo?: string;         // HouseholdMember.id or ""
  notes?: string;
  documents?: string[];        // storage URLs
  reminders?: HouseholdReminder[];
  pushEnabled?: boolean;
  history?: HouseholdHistoryEntry[];
  createdAt?: any;
}

export interface HouseholdSettings {
  members: HouseholdMember[];
  categories: string[];        // customisable list of item types
}

export const DEFAULT_HOUSEHOLD_SETTINGS: HouseholdSettings = {
  members: [],
  categories: [
    "Home Insurance", "Car Insurance", "Life Insurance",
    "Utilities", "Council Tax", "Mortgage",
    "Phone Contract", "TV / Broadband", "Pet Insurance", "Other"
  ],
};

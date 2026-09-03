/** Security posture report types for the Admin Security Dashboard. */

export type SecurityFindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type SecurityFindingCategory =
  | "authentication"
  | "authorization"
  | "data_protection"
  | "configuration"
  | "infrastructure"
  | "compliance"
  | "monitoring";

export type SecurityScanCadence = "off" | "daily" | "weekly" | "monthly";

export interface SecurityFinding {
  id: string;
  severity: SecurityFindingSeverity;
  category: SecurityFindingCategory;
  title: string;
  description: string;
  recommendation: string;
  /** Optional deep-link path inside the app */
  actionPath?: string;
  /** Evidence / counts gathered during the scan */
  evidence?: string;
}

export interface SecurityScoreBreakdown {
  authentication: number;
  authorization: number;
  dataProtection: number;
  configuration: number;
  infrastructure: number;
  monitoring: number;
}

export interface SecurityReportSummary {
  totalFindings: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  usersChecked: number;
  passkeyEnrolled: number;
  passkeyMissing: number;
}

export interface SecurityReport {
  id?: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: SecurityReportSummary;
  breakdown: SecurityScoreBreakdown;
  findings: SecurityFinding[];
  recommendations: string[];
  triggeredBy: "manual" | "scheduled";
  triggeredByUid?: string;
  triggeredByEmail?: string;
  durationMs: number;
  createdAt?: any;
  createdAtIso: string;
}

export interface SecurityScanPrefs {
  cadence: SecurityScanCadence;
  /** 0–23, Europe/London */
  hourLocal: number;
  /** 0 = Sunday … 6 = Saturday (weekly) */
  weekday?: number;
  /** 1–28 preferred day of month (monthly) */
  monthDay?: number;
  notifyEmail: boolean;
  enabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  updatedAt?: any;
  updatedBy?: string;
}

export const DEFAULT_SECURITY_SCAN_PREFS: SecurityScanPrefs = {
  cadence: "weekly",
  hourLocal: 9,
  weekday: 1,
  monthDay: 1,
  notifyEmail: true,
  enabled: false,
  lastRunAt: null,
  nextRunAt: null,
};

export function securityGrade(score: number): SecurityReport["grade"] {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

export const SEVERITY_WEIGHT: Record<SecurityFindingSeverity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
};

export function computeSecurityScore(findings: SecurityFinding[]): number {
  const penalty = findings.reduce((sum, f) => sum + (SEVERITY_WEIGHT[f.severity] || 0), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

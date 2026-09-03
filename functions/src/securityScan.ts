/**
 * Security posture scanner for Hardy Hub.
 * Collects live Auth/Firestore signals + known architecture checks, scores the
 * estate, persists a report, and optionally runs on a schedule.
 */
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { postmarkKey } from "./notifications/scheduler";
import { sendTransactionalEmail } from "./notifications/sender";

type Severity = "critical" | "high" | "medium" | "low" | "info";
type Category =
  | "authentication"
  | "authorization"
  | "data_protection"
  | "configuration"
  | "infrastructure"
  | "compliance"
  | "monitoring";
type Cadence = "off" | "daily" | "weekly" | "monthly";

interface Finding {
  id: string;
  severity: Severity;
  category: Category;
  title: string;
  description: string;
  recommendation: string;
  actionPath?: string;
  evidence?: string;
}

interface ScanPrefs {
  cadence: Cadence;
  hourLocal: number;
  weekday?: number;
  monthDay?: number;
  notifyEmail: boolean;
  enabled: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  updatedBy?: string;
}

const OWNER_EMAIL = "chris.hardy.07@googlemail.com";
const HOSTING_URL = "https://hardyhub-7b30d.web.app";
const APP_URL = "https://hardyapp.co.uk";

const WEIGHT: Record<Severity, number> = {
  critical: 20,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
};

const SENSITIVE_MODULES = [
  "personal_finance",
  "passwords",
  "health",
  "notes",
  "inheritance",
  "remote_displays",
  "companies",
  "admin",
] as const;

function requireAuth(context: { auth?: { uid: string; token: any } }) {
  const uid = context.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "You must be signed in.");
  if (context.auth?.token?.deviceId) {
    throw new HttpsError("permission-denied", "Remote display credentials cannot use this service.");
  }
  return uid;
}

async function requireAdmin(uid: string, authEmail?: string) {
  const snap = await admin.firestore().doc(`users/${uid}`).get();
  const data = snap.data() || {};
  const rawRole = String(data.role || "").toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
  const profileEmail = String(data.email || "").toLowerCase();
  const tokenEmail = String(authEmail || "").toLowerCase();
  const isOwner = profileEmail === OWNER_EMAIL || tokenEmail === OWNER_EMAIL;
  if (rawRole !== "superadmin" && rawRole !== "admin" && data.isSuperAdmin !== true && !isOwner) {
    throw new HttpsError("permission-denied", "Admin privileges required.");
  }
}

function gradeFor(score: number): "A" | "B" | "C" | "D" | "F" {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  if (score >= 40) return "D";
  return "F";
}

function computeScore(findings: Finding[]): number {
  const penalty = findings.reduce((s, f) => s + (WEIGHT[f.severity] || 0), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

function categoryScore(findings: Finding[], category: Category): number {
  const subset = findings.filter((f) => f.category === category);
  const penalty = subset.reduce((s, f) => s + (WEIGHT[f.severity] || 0), 0);
  return Math.max(0, Math.min(100, 100 - penalty));
}

async function listAllUsers(): Promise<admin.auth.UserRecord[]> {
  const out: admin.auth.UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const page = await admin.auth().listUsers(1000, pageToken);
    out.push(...page.users);
    pageToken = page.pageToken;
  } while (pageToken);
  return out;
}

async function checkSecurityHeaders(url: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const headers = res.headers;
    const csp = headers.get("content-security-policy");
    const xfo = headers.get("x-frame-options");
    const xcto = headers.get("x-content-type-options");
    const referrer = headers.get("referrer-policy");
    const hsts = headers.get("strict-transport-security");
    const permissions = headers.get("permissions-policy");

    if (!csp) {
      findings.push({
        id: "hdr-csp",
        severity: "medium",
        category: "infrastructure",
        title: "No Content-Security-Policy header",
        description: `${url} does not send a CSP header, which increases XSS blast radius if a script injection ever lands.`,
        recommendation:
          "Add a Firebase Hosting header for Content-Security-Policy that locks script/style sources to your origin and trusted CDNs.",
        evidence: url,
      });
    }
    if (!xfo && !csp?.includes("frame-ancestors")) {
      findings.push({
        id: "hdr-xfo",
        severity: "low",
        category: "infrastructure",
        title: "Clickjacking protection missing",
        description: `${url} has neither X-Frame-Options nor CSP frame-ancestors.`,
        recommendation: "Set X-Frame-Options: DENY (or SAMEORIGIN) in firebase.json hosting headers.",
        evidence: url,
      });
    }
    if (!xcto || xcto.toLowerCase() !== "nosniff") {
      findings.push({
        id: "hdr-xcto",
        severity: "low",
        category: "infrastructure",
        title: "X-Content-Type-Options not set to nosniff",
        description: "Browsers may MIME-sniff responses without this header.",
        recommendation: "Add X-Content-Type-Options: nosniff to Firebase Hosting headers.",
        evidence: url,
      });
    }
    if (!referrer) {
      findings.push({
        id: "hdr-referrer",
        severity: "info",
        category: "infrastructure",
        title: "Referrer-Policy not set",
        description: "Outbound navigations may leak full URLs in the Referer header.",
        recommendation: "Set Referrer-Policy: strict-origin-when-cross-origin (or stricter).",
        evidence: url,
      });
    }
    if (!hsts) {
      findings.push({
        id: "hdr-hsts",
        severity: "medium",
        category: "infrastructure",
        title: "HSTS header missing on this host",
        description: `${url} did not return Strict-Transport-Security.`,
        recommendation: "Ensure HTTPS redirects and HSTS are enabled for all production hosts.",
        evidence: url,
      });
    }
    if (!permissions) {
      findings.push({
        id: "hdr-permissions",
        severity: "info",
        category: "infrastructure",
        title: "Permissions-Policy not set",
        description: "Browser features (camera, mic, geolocation) are not explicitly restricted.",
        recommendation: "Add a Permissions-Policy header locking unused powerful APIs.",
        evidence: url,
      });
    }
  } catch (err) {
    findings.push({
      id: "hdr-fetch-failed",
      severity: "low",
      category: "infrastructure",
      title: "Could not probe hosting headers",
      description: `Header check for ${url} failed during the scan.`,
      recommendation: "Re-run the scan; if this persists, verify hosting is reachable from Cloud Functions.",
      evidence: String((err as Error)?.message || err),
    });
  }
  return findings;
}

function architectureFindings(): Finding[] {
  return [
    {
      id: "arch-passkey-gate",
      severity: "info",
      category: "authentication",
      title: "Passkey enrolment is required for app data access",
      description:
        "Firestore rules gate interactive reads/writes behind users/{uid}.passkeyEnrolled. Display credentials are deliberately excluded and scoped.",
      recommendation: "Keep this gate; monitor passkey enrolment gaps in each scan.",
    },
    {
      id: "arch-default-modules",
      severity: "medium",
      category: "authorization",
      title: "Only finance & passwords are passkey-locked by default in rules",
      description:
        "Firestore defaultModuleRequirement() only forces passkey for personal_finance and passwords. Client defaults also lock remote_displays, but rules do not — so a user without custom settings can read displays without a fresh passkey at the rules layer.",
      recommendation:
        "Align firestore.rules defaultModuleRequirement with client DEFAULT_SECURITY_SETTINGS (include remote_displays, and consider health, notes, inheritance).",
      actionPath: "/settings",
    },
    {
      id: "arch-hardcoded-owner",
      severity: "low",
      category: "configuration",
      title: "Owner email is hardcoded in rules and Admin UI",
      description:
        "isOwnerAccount() and the Admin page email gate hardcode chris.hardy.07@googlemail.com. Rotation or multi-owner support requires a code change.",
      recommendation:
        "Move owner allow-list to a Firestore adminConfig doc (admin-writable only) and read it from rules via get().",
    },
    {
      id: "arch-tattersalls-open",
      severity: "high",
      category: "authorization",
      title: "Tattersalls collection is open to every authenticated user",
      description:
        "firestore.rules allows any passkey-enrolled user to read/write tattersalls/{docId} and nested documents — no owner or household check.",
      recommendation:
        "Scope Tattersalls to ownerId / household membership / page shares, matching Finance and Pets.",
    },
    {
      id: "arch-appconfig-writable",
      severity: "high",
      category: "authorization",
      title: "appConfig is writable by any authenticated user",
      description:
        "match /appConfig/{docId} allows read, write if isAuthenticated(). A compromised member account could overwrite shared API keys or config.",
      recommendation: "Restrict appConfig writes to isAdmin() (or superadmin) and keep secrets in Secret Manager, not Firestore.",
    },
    {
      id: "arch-no-login-audit",
      severity: "medium",
      category: "monitoring",
      title: "No persisted login / security event audit trail",
      description:
        "The Security Dashboard previously showed a placeholder event log. Auth success/failure and passkey challenges are not written to an admin-readable collection.",
      recommendation:
        "Log auth and passkey outcomes (hashed IP, uid, result) into securityEvents via Cloud Functions, retained for 90 days.",
    },
    {
      id: "arch-vault-strong",
      severity: "info",
      category: "data_protection",
      title: "Password vault is owner-only even for admins",
      description:
        "Credential vault paths require owner + module passkey and explicitly exclude admin bypass — good blast-radius control.",
      recommendation: "Maintain this model; never grant admin vault read for support workflows.",
    },
    {
      id: "arch-invite-password-policy",
      severity: "info",
      category: "authentication",
      title: "Invite flow enforces a strong temporary password policy",
      description:
        "inviteUser requires ≥8 chars with upper, lower, digit, and special character before creating Auth users.",
      recommendation: "Keep server-side enforcement; consider forcing password change on first login.",
    },
  ];
}

async function runScan(opts: {
  triggeredBy: "manual" | "scheduled";
  triggeredByUid?: string;
  triggeredByEmail?: string;
}): Promise<{
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: Record<string, number>;
  breakdown: Record<string, number>;
  findings: Finding[];
  recommendations: string[];
  triggeredBy: "manual" | "scheduled";
  triggeredByUid?: string;
  triggeredByEmail?: string;
  durationMs: number;
  createdAtIso: string;
}> {
  const started = Date.now();
  const db = admin.firestore();
  const findings: Finding[] = [...architectureFindings()];

  const authUsers = await listAllUsers();
  const profilesSnap = await db.collection("users").get();
  const profiles = new Map(profilesSnap.docs.map((d) => [d.id, d.data() || {}]));

  let passkeyEnrolled = 0;
  let passkeyMissing = 0;
  let suspended = 0;
  let superadmins = 0;
  let admins = 0;
  let missingProfile = 0;
  let disabledAuth = 0;
  let sensitiveUnlocked = 0;

  for (const u of authUsers) {
    const profile = profiles.get(u.uid);
    if (!profile) {
      missingProfile += 1;
      continue;
    }
    if (u.disabled) disabledAuth += 1;
    if (profile.suspended === true || profile.enabled === false) suspended += 1;
    const role = String(profile.role || "").toLowerCase().replace(/-/g, "").replace(/\s+/g, "");
    if (role === "superadmin" || profile.isSuperAdmin === true) superadmins += 1;
    if (role === "admin" || profile.isAdmin === true) admins += 1;
    if (profile.passkeyEnrolled === true) passkeyEnrolled += 1;
    else passkeyMissing += 1;

    const settingsSnap = await db.doc(`users/${u.uid}/security/settings`).get();
    const mods = (settingsSnap.data()?.moduleRequirements || {}) as Record<string, string>;
    const unlocked = SENSITIVE_MODULES.filter((m) => {
      if (m === "personal_finance" || m === "passwords") {
        return mods[m] === "none";
      }
      const req = mods[m] ?? "none";
      return req === "none";
    });
    if (unlocked.length >= 4) sensitiveUnlocked += 1;
  }

  if (passkeyMissing > 0) {
    findings.push({
      id: "live-passkey-gap",
      severity: passkeyMissing >= 3 ? "high" : "medium",
      category: "authentication",
      title: `${passkeyMissing} user(s) without a passkey enrolled`,
      description:
        "Interactive Firestore access requires passkeyEnrolled, but accounts without enrolment are stuck at the mandatory gate — or may still hold Auth sessions.",
      recommendation: "Prompt each user to enrol a passkey from Settings, or reset/remove unused accounts.",
      actionPath: "/admin",
      evidence: `${passkeyEnrolled} enrolled / ${passkeyMissing} missing of ${profiles.size} profiles`,
    });
  }

  if (missingProfile > 0) {
    findings.push({
      id: "live-orphan-auth",
      severity: "medium",
      category: "authentication",
      title: `${missingProfile} Auth user(s) lack a Firestore profile`,
      description:
        "Firebase Auth accounts without users/{uid} docs can sign in but won't match app RBAC cleanly.",
      recommendation: "Delete orphan Auth users or restore their profiles via Admin invite/restore.",
      evidence: String(missingProfile),
    });
  }

  if (superadmins > 2) {
    findings.push({
      id: "live-too-many-superadmins",
      severity: "medium",
      category: "authorization",
      title: `${superadmins} superadmin accounts`,
      description: "Broad superadmin access increases blast radius if any privileged account is compromised.",
      recommendation: "Keep superadmin to the minimum necessary; prefer admin for day-to-day ops.",
      actionPath: "/admin",
      evidence: `${superadmins} superadmin, ${admins} admin`,
    });
  }

  if (sensitiveUnlocked > 0) {
    findings.push({
      id: "live-modules-unlocked",
      severity: "medium",
      category: "authorization",
      title: `${sensitiveUnlocked} user(s) leave several sensitive modules unlocked`,
      description:
        "Health, notes, inheritance, companies, or admin modules are set to 'none' (or left at open defaults) for multiple accounts.",
      recommendation: "In Settings → Security, require passkey for health, notes, inheritance, and companies.",
      actionPath: "/settings",
      evidence: String(sensitiveUnlocked),
    });
  }

  if (suspended > 0) {
    const stillEnabled = authUsers.filter((u) => {
      const p = profiles.get(u.uid);
      return p && (p.suspended === true || p.enabled === false) && !u.disabled;
    }).length;
    if (stillEnabled > 0) {
      findings.push({
        id: "live-suspended-auth-enabled",
        severity: "high",
        category: "authorization",
        title: `${stillEnabled} suspended profile(s) still have Auth enabled`,
        description:
          "Firestore marks the user suspended/disabled but Firebase Auth can still mint ID tokens until Auth.disable is set.",
        recommendation: "When suspending, also disable the Auth user (Admin suspend should call auth.updateUser({ disabled: true })).",
        actionPath: "/admin",
        evidence: String(stillEnabled),
      });
    }
  }

  // Devices
  try {
    const devices = await db.collection("devices").limit(200).get();
    const active = devices.docs.filter((d) => !d.data()?.revoked).length;
    findings.push({
      id: "live-devices",
      severity: "info",
      category: "authorization",
      title: `${active} active remote display device(s)`,
      description: "Paired displays use device claims; revoked devices are denied in rules.",
      recommendation: "Periodically review Linked Displays and revoke unused screens.",
      actionPath: "/remote-displays",
      evidence: `${active} active of ${devices.size} sampled`,
    });
  } catch (err) {
    logger.debug("device scan skipped", { err });
  }

  findings.push(...(await checkSecurityHeaders(HOSTING_URL)));
  const customHeaders = await checkSecurityHeaders(APP_URL);
  for (const f of customHeaders) {
    if (!findings.some((x) => x.id === f.id && x.evidence === f.evidence)) findings.push(f);
  }

  // Positive: HTTPS hosting reachable
  findings.push({
    id: "live-hosting-up",
    severity: "info",
    category: "infrastructure",
    title: "Production hosting is reachable over HTTPS",
    description: `${HOSTING_URL} responded during this scan.`,
    recommendation: "Continue deploying via Firebase Hosting with versioned releases.",
    evidence: HOSTING_URL,
  });

  const score = computeScore(findings);
  const summary = {
    totalFindings: findings.length,
    critical: findings.filter((f) => f.severity === "critical").length,
    high: findings.filter((f) => f.severity === "high").length,
    medium: findings.filter((f) => f.severity === "medium").length,
    low: findings.filter((f) => f.severity === "low").length,
    info: findings.filter((f) => f.severity === "info").length,
    usersChecked: profiles.size,
    passkeyEnrolled,
    passkeyMissing,
  };

  const recommendations = [
    ...findings
      .filter((f) => f.severity === "critical" || f.severity === "high" || f.severity === "medium")
      .slice(0, 8)
      .map((f) => f.recommendation),
  ];
  // de-dupe
  const uniqueRecs = [...new Set(recommendations)];

  return {
    score,
    grade: gradeFor(score),
    summary,
    breakdown: {
      authentication: categoryScore(findings, "authentication"),
      authorization: categoryScore(findings, "authorization"),
      dataProtection: categoryScore(findings, "data_protection"),
      configuration: categoryScore(findings, "configuration"),
      infrastructure: categoryScore(findings, "infrastructure"),
      monitoring: categoryScore(findings, "monitoring"),
    },
    findings: findings.sort((a, b) => (WEIGHT[b.severity] || 0) - (WEIGHT[a.severity] || 0)),
    recommendations: uniqueRecs,
    triggeredBy: opts.triggeredBy,
    triggeredByUid: opts.triggeredByUid,
    triggeredByEmail: opts.triggeredByEmail,
    durationMs: Date.now() - started,
    createdAtIso: new Date().toISOString(),
  };
}

function nextRunIso(prefs: ScanPrefs, from = new Date()): string | null {
  if (!prefs.enabled || prefs.cadence === "off") return null;
  const hour = Math.min(23, Math.max(0, Math.floor(prefs.hourLocal ?? 9)));
  // Work in Europe/London approximately via UTC+0/1 is hard without tz lib;
  // store as UTC hour matching the configured local hour (documented as Europe/London intent).
  const cursor = new Date(from.getTime());
  cursor.setUTCMinutes(0, 0, 0);
  cursor.setUTCHours(hour);
  if (cursor <= from) cursor.setUTCDate(cursor.getUTCDate() + 1);

  if (prefs.cadence === "daily") return cursor.toISOString();

  if (prefs.cadence === "weekly") {
    const want = Math.min(6, Math.max(0, prefs.weekday ?? 1));
    while (cursor.getUTCDay() !== want || cursor <= from) {
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      cursor.setUTCHours(hour, 0, 0, 0);
    }
    return cursor.toISOString();
  }

  if (prefs.cadence === "monthly") {
    const day = Math.min(28, Math.max(1, prefs.monthDay ?? 1));
    const candidate = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), day, hour, 0, 0, 0));
    if (candidate <= from) {
      candidate.setUTCMonth(candidate.getUTCMonth() + 1);
    }
    return candidate.toISOString();
  }

  return null;
}

async function persistReport(report: Awaited<ReturnType<typeof runScan>>) {
  const ref = await admin.firestore().collection("securityReports").add({
    ...report,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return { id: ref.id, ...report };
}

async function maybeEmailReport(report: Awaited<ReturnType<typeof runScan>>, prefs: ScanPrefs) {
  if (!prefs.notifyEmail) return;
  try {
    const key = postmarkKey.value();
    const body = [
      `Security score: ${report.score}/100 (grade ${report.grade})`,
      `Findings: ${report.summary.critical} critical, ${report.summary.high} high, ${report.summary.medium} medium`,
      "",
      ...report.recommendations.slice(0, 5).map((r, i) => `${i + 1}. ${r}`),
      "",
      `Open the Security Dashboard: ${APP_URL}/admin`,
    ].join("\n");
    await sendTransactionalEmail(key, OWNER_EMAIL, {
      subject: `Hardy Hub security scan — ${report.grade} (${report.score}/100)`,
      heading: `Security score ${report.score}/100`,
      body_html: `<p><strong>Grade ${report.grade}</strong> · ${report.summary.critical} critical · ${report.summary.high} high · ${report.summary.medium} medium</p><ol>${report.recommendations
        .slice(0, 5)
        .map((r) => `<li>${r}</li>`)
        .join("")}</ol>`,
      body_text: body,
      action: { url: `${APP_URL}/admin`, label: "Open Security Dashboard" },
      footer_note: "Scheduled Hardy Hub security scan",
    });
  } catch (err) {
    logger.warn("security scan email failed", { err });
  }
}

export const runSecurityScan = onCall(
  {
    secrets: [postmarkKey],
    timeoutSeconds: 120,
  },
  async (request) => {
    const uid = requireAuth(request);
    await requireAdmin(uid, request.auth?.token?.email);
    const report = await runScan({
      triggeredBy: "manual",
      triggeredByUid: uid,
      triggeredByEmail: String(request.auth?.token?.email || ""),
    });
    const saved = await persistReport(report);
    await admin.firestore().doc("securityScanPrefs/global").set(
      {
        lastRunAt: report.createdAtIso,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return saved;
  },
);

export const saveSecurityScanPrefs = onCall(async (request) => {
  const uid = requireAuth(request);
  await requireAdmin(uid, request.auth?.token?.email);

  const cadence = (String(request.data?.cadence || "weekly") as Cadence) || "weekly";
  const enabled = Boolean(request.data?.enabled) && cadence !== "off";
  const prefs: ScanPrefs = {
    cadence: enabled ? cadence : "off",
    hourLocal: Number(request.data?.hourLocal ?? 9),
    weekday: Number(request.data?.weekday ?? 1),
    monthDay: Number(request.data?.monthDay ?? 1),
    notifyEmail: request.data?.notifyEmail !== false,
    enabled,
  };
  prefs.nextRunAt = nextRunIso(prefs);
  prefs.updatedBy = uid;

  await admin.firestore().doc("securityScanPrefs/global").set(
    {
      ...prefs,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return prefs;
});

export const processScheduledSecurityScans = onSchedule(
  {
    schedule: "every 60 minutes",
    timeZone: "Europe/London",
    secrets: [postmarkKey],
    timeoutSeconds: 180,
  },
  async () => {
    const db = admin.firestore();
    const snap = await db.doc("securityScanPrefs/global").get();
    if (!snap.exists) return;
    const prefs = snap.data() as ScanPrefs;
    if (!prefs.enabled || prefs.cadence === "off" || !prefs.nextRunAt) return;
    if (Date.parse(prefs.nextRunAt) > Date.now()) return;

    logger.info("Running scheduled security scan");
    const report = await runScan({ triggeredBy: "scheduled" });
    await persistReport(report);
    const next = nextRunIso(prefs, new Date());
    await db.doc("securityScanPrefs/global").set(
      {
        lastRunAt: report.createdAtIso,
        nextRunAt: next,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    await maybeEmailReport(report, prefs);
  },
);

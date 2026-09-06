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
  summary?: string;
  meaning?: string;
  impact?: string;
  fix?: string;
  dealLabel?: "Fix now" | "Fix soon" | "Worth doing" | "Nice to have" | "Looking good";
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
  critical: 18,
  high: 10,
  medium: 5,
  low: 2,
  info: 0,
};

const DEAL: Record<Severity, Finding["dealLabel"]> = {
  critical: "Fix now",
  high: "Fix soon",
  medium: "Worth doing",
  low: "Nice to have",
  info: "Looking good",
};

function withPlain(finding: Finding): Finding {
  return {
    ...finding,
    dealLabel: finding.dealLabel || DEAL[finding.severity],
    summary: finding.summary || finding.title,
    meaning: finding.meaning || finding.description,
    impact: finding.impact || (
      finding.severity === "critical" ? "Fix this first. The wrong person could see or change family data."
      : finding.severity === "high" ? "A signed-in person, or a stolen family login, could do more than they should."
      : finding.severity === "medium" ? "Worth doing. This is not a stranger on the internet breaking in."
      : finding.severity === "low" ? "A tidy-up. The family is not in danger because of this alone."
      : "A note, not a problem."
    ),
    fix: finding.fix || finding.recommendation,
  };
}

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
  let other = 0;
  let headers = 0;
  for (const finding of findings) {
    const weight = WEIGHT[finding.severity] || 0;
    if (finding.id.startsWith("hdr-")) headers += weight;
    else other += weight;
  }
  return Math.max(0, Math.min(100, 100 - other - Math.min(12, headers)));
}

function scoreHeadline(score: number): string {
  if (score >= 90) return "In good shape";
  if (score >= 75) return "Solid, with a few tidy-ups";
  if (score >= 60) return "Fine for a private family app, with work still worth doing";
  if (score >= 40) return "Needs attention, but this is not an emergency";
  return "Needs prompt work";
}

function scoreWhy(score: number, findings: Finding[], passkeyMissing: number): string {
  const critical = findings.filter((f) => f.severity === "critical").length;
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const parts: string[] = [];
  if (critical + high === 0 && medium === 0) {
    parts.push("The score is high because nothing here lets the wrong person in.");
  } else if (critical + high === 0) {
    parts.push(`The score is ${score} because of ${medium} item${medium === 1 ? "" : "s"} worth doing — seatbelts and tidy-ups, not a break-in.`);
  } else {
    parts.push(`The score is ${score} mainly because of ${critical + high} more serious item${critical + high === 1 ? "" : "s"} (Fix now / Fix soon).`);
  }
  parts.push("100 is a clean bill of health. The same missing header on two web addresses is not counted twice. Notes marked Looking good do not lower the score.");
  if (passkeyMissing > 0) {
    parts.push(`${passkeyMissing} account${passkeyMissing === 1 ? " has" : "s have"} not finished passkey setup yet.`);
  }
  return parts.join(" ");
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
        title: "The website does not tell the browser which scripts are allowed",
        description: `${url} is missing a Content-Security-Policy header.`,
        recommendation: "Keep the Content-Security-Policy header in firebase.json and deploy hosting.",
        evidence: url,
        summary: "The website does not tell the browser which scripts are allowed.",
        meaning: "If a bad script ever got onto a page, the browser would have fewer brakes.",
        impact: "Worth doing. It is a seatbelt, not a sign that anyone is in.",
        fix: "Deploy the hosting headers already set in firebase.json.",
      });
    }
    if (!xfo && !csp?.includes("frame-ancestors")) {
      findings.push({
        id: "hdr-xfo",
        severity: "low",
        category: "infrastructure",
        title: "Other sites could try to show Hardy Hub inside a frame",
        description: `${url} has neither X-Frame-Options nor CSP frame-ancestors.`,
        recommendation: "Keep X-Frame-Options: DENY in firebase.json hosting headers.",
        evidence: url,
        summary: "Other sites could try to show Hardy Hub inside a frame.",
        meaning: "That is a click-jacking trick. Unlikely on a private family site.",
        impact: "Nice to have.",
        fix: "Deploy the hosting headers already set in firebase.json.",
      });
    }
    if (!xcto || xcto.toLowerCase() !== "nosniff") {
      findings.push({
        id: "hdr-xcto",
        severity: "low",
        category: "infrastructure",
        title: "The site should tell browsers not to guess file types",
        description: `${url} is missing X-Content-Type-Options: nosniff.`,
        recommendation: "Keep X-Content-Type-Options: nosniff in firebase.json.",
        evidence: url,
        summary: "The site should tell browsers not to guess file types.",
        meaning: "Without this, a browser might treat a file as a script by mistake.",
        impact: "Nice to have.",
        fix: "Deploy the hosting headers already set in firebase.json.",
      });
    }
    if (!referrer) {
      findings.push({
        id: "hdr-referrer",
        severity: "info",
        category: "infrastructure",
        title: "Links out could include the full Hardy Hub address",
        description: `${url} has no Referrer-Policy header.`,
        recommendation: "Keep Referrer-Policy in firebase.json.",
        evidence: url,
        summary: "Links out could include the full Hardy Hub address.",
        meaning: "Another site might see which page you came from.",
        impact: "A tidy-up, not a break-in risk.",
        fix: "Deploy the hosting headers already set in firebase.json.",
      });
    }
    if (!hsts) {
      findings.push({
        id: "hdr-hsts",
        severity: "medium",
        category: "infrastructure",
        title: "This address did not insist on HTTPS",
        description: `${url} did not return Strict-Transport-Security.`,
        recommendation: "Keep the HSTS header on Firebase Hosting and always open hardyapp.co.uk over https.",
        evidence: url,
        summary: "This address did not insist on HTTPS.",
        meaning: "On public Wi‑Fi, a fake network could try to serve a non-secure copy.",
        impact: "Worth doing for the public web address. Firebase usually already forces HTTPS.",
        fix: "Deploy the hosting headers already set in firebase.json.",
      });
    }
    if (!permissions) {
      findings.push({
        id: "hdr-permissions",
        severity: "info",
        category: "infrastructure",
        title: "The site does not list which phone features it will not use",
        description: `${url} has no Permissions-Policy header.`,
        recommendation: "Keep the Permissions-Policy header in firebase.json.",
        evidence: url,
        summary: "The site does not list which phone features it will not use.",
        meaning: "Camera, mic and location are not explicitly switched off in a header.",
        impact: "A tidy-up.",
        fix: "Deploy the hosting headers already set in firebase.json.",
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
      title: "People must set up a passkey before they can use the app",
      description: "Firestore only opens family data after passkey enrolment. Remote displays are kept on a tighter, separate path.",
      recommendation: "Leave this as it is.",
      summary: "People must set up a passkey before they can use the app.",
      meaning: "A stolen password alone is not enough to open family data.",
      impact: "This is a strength, not a problem.",
      fix: "Leave this as it is.",
    },
    {
      id: "arch-default-modules",
      severity: "low",
      category: "authorization",
      title: "Some private pages do not ask for a passkey unless you turn that on",
      description:
        "Money, the password vault and remote displays ask for a passkey by default. Health, notes and similar pages stay open unless someone sets a lock in Settings.",
      recommendation: "In Settings → Security, require a passkey for any page you want extra-private.",
      actionPath: "/settings",
      summary: "Some private pages do not ask for a passkey unless you turn that on.",
      meaning: "A family member who is already signed in can open those pages without a second check.",
      impact: "Nice to have if a phone is shared. Not an internet break-in.",
      fix: "In Settings → Security, lock any page you want extra-private.",
    },
    {
      id: "arch-hardcoded-owner",
      severity: "low",
      category: "configuration",
      title: "The main owner email is written into the app code",
      description: "Owner checks use a fixed email address. Changing it needs a code change.",
      recommendation: "Later, move the owner list into an admin setting.",
      summary: "The main owner email is written into the app code.",
      meaning: "If you ever change that email, a developer has to update the code.",
      impact: "Nice to have. It does not let strangers in.",
      fix: "Leave it for now unless you are changing the owner email.",
    },
    {
      id: "arch-tattersalls-open",
      severity: "medium",
      category: "authorization",
      title: "Anyone signed in can see and change the Flats page",
      description:
        "Flats is a family-wide page. Every passkey-enrolled account can read and write it. That is fine if the whole family manages it.",
      recommendation: "Share Flats only with people who should edit it, and keep spare or guest accounts off that page.",
      summary: "Anyone signed in can see and change the Flats page.",
      meaning: "A guest account could edit rents and documents, not only look.",
      impact: "Worth doing if someone should only look. Not a problem if the whole family manages flats.",
      fix: "Use the share button on Flats, and do not leave unused accounts enabled.",
    },
    {
      id: "arch-appconfig-writable",
      severity: "low",
      category: "data_protection",
      title: "The shared AI key can be read by the family, but only an admin can change it",
      description:
        "appConfig writes are admin-only. The key still lives in Firestore so in-app AI works for the family.",
      recommendation: "Keep the key in Settings as an admin. When you can, move it to Secret Manager.",
      summary: "The shared AI key can be read by the family, but only an admin can change it.",
      meaning: "Signed-in people can use the key. They can no longer overwrite it.",
      impact: "Nice to have to move the key to a server secret later.",
      fix: "Nothing urgent. Only an admin should save a new key in Settings.",
    },
    {
      id: "arch-no-login-audit",
      severity: "low",
      category: "monitoring",
      title: "There is no saved list of who logged in or failed a passkey",
      description: "Auth success and failure are not written to an admin-readable history.",
      recommendation: "Add a login history later if you want one. Not urgent for a family app.",
      summary: "There is no saved list of who logged in or failed a passkey.",
      meaning: "If something odd happened last Tuesday, the app cannot show you a history of logins.",
      impact: "Nice to have. It does not mean someone is in.",
      fix: "Leave this unless you want a login history.",
    },
    {
      id: "arch-vault-strong",
      severity: "info",
      category: "data_protection",
      title: "Password vaults stay private even from admins",
      description: "Saved logins stay with the owner. Admin support cannot open them.",
      recommendation: "Leave this as it is.",
      summary: "Password vaults stay private even from admins.",
      meaning: "A helper with admin access still cannot open someone else’s saved logins.",
      impact: "This is a strength.",
      fix: "Leave this as it is.",
    },
    {
      id: "arch-invite-password-policy",
      severity: "info",
      category: "authentication",
      title: "New accounts need a strong starter password",
      description: "Invites cannot use a short or simple password.",
      recommendation: "Leave this as it is.",
      summary: "New accounts need a strong starter password.",
      meaning: "A weak invite password is rejected on the server.",
      impact: "This is a strength.",
      fix: "Leave this as it is.",
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
  scoreHeadline: string;
  scoreWhy: string;
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
      title: `${passkeyMissing} account${passkeyMissing === 1 ? " has" : "s have"} not finished passkey setup`,
      description:
        "Those people cannot use the app until they add a passkey — or they may still have an old login sitting there.",
      recommendation: "Ask them to add a passkey in Settings, or remove unused accounts in Admin.",
      actionPath: "/admin",
      evidence: `${passkeyEnrolled} enrolled / ${passkeyMissing} missing of ${profiles.size} profiles`,
      summary: `${passkeyMissing} account${passkeyMissing === 1 ? " has" : "s have"} not finished passkey setup.`,
      meaning: "The app is waiting for those people to add Face ID / fingerprint. Unused logins should be deleted.",
      impact: passkeyMissing >= 3 ? "Fix soon if those accounts are leftover." : "Worth doing for unused accounts.",
      fix: "Open Admin and remove leftover users, or ask them to finish passkey setup.",
    });
  }

  if (missingProfile > 0) {
    findings.push({
      id: "live-orphan-auth",
      severity: "medium",
      category: "authentication",
      title: `${missingProfile} login${missingProfile === 1 ? "" : "s"} exist without an app profile`,
      description: "Firebase Auth has accounts that do not match a Hardy Hub user profile.",
      recommendation: "Delete those logins in Admin, or restore their profiles.",
      evidence: String(missingProfile),
      summary: `${missingProfile} login${missingProfile === 1 ? "" : "s"} exist without an app profile.`,
      meaning: "Someone could sign in but the app would not know who they are.",
      impact: "Worth doing. Tidy leftover logins.",
      fix: "In Admin, delete unused logins.",
    });
  }

  if (superadmins > 2) {
    findings.push({
      id: "live-too-many-superadmins",
      severity: "medium",
      category: "authorization",
      title: `${superadmins} people have the top admin role`,
      description: "If one of those logins is stolen, the thief gets the widest access.",
      recommendation: "Keep superadmin to the few people who need it.",
      actionPath: "/admin",
      evidence: `${superadmins} superadmin, ${admins} admin`,
      summary: `${superadmins} people have the top admin role.`,
      meaning: "Each extra superadmin is another login that can change everything.",
      impact: "Worth doing. Prefer a normal admin for day-to-day help.",
      fix: "In Admin, drop leftover superadmin roles.",
    });
  }

  if (sensitiveUnlocked > 0) {
    findings.push({
      id: "live-modules-unlocked",
      severity: "low",
      category: "authorization",
      title: `${sensitiveUnlocked} account${sensitiveUnlocked === 1 ? " leaves" : "s leave"} several private pages unlocked`,
      description: "Health, notes or similar pages are set to no extra lock for those people.",
      recommendation: "In Settings → Security, require a passkey for pages you want extra-private.",
      actionPath: "/settings",
      evidence: String(sensitiveUnlocked),
      summary: `${sensitiveUnlocked} account${sensitiveUnlocked === 1 ? " leaves" : "s leave"} several private pages unlocked.`,
      meaning: "Once signed in, those pages open without a second check.",
      impact: "Nice to have on a family phone. Not an internet break-in.",
      fix: "In Settings → Security, lock the pages you care about.",
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
        title: `${stillEnabled} suspended account${stillEnabled === 1 ? " can" : "s can"} still sign in`,
        description: "The app says they are suspended, but Firebase login is still switched on.",
        recommendation: "In Admin, suspend again so the login is switched off as well.",
        actionPath: "/admin",
        evidence: String(stillEnabled),
        summary: `${stillEnabled} suspended account${stillEnabled === 1 ? " can" : "s can"} still sign in.`,
        meaning: "You thought they were locked out, but their password or passkey may still work.",
        impact: "Fix soon. A suspended person should not be able to get back in.",
        fix: "Open Admin and suspend those accounts again.",
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

  const headerFindings = [
    ...(await checkSecurityHeaders(HOSTING_URL)),
    ...(await checkSecurityHeaders(APP_URL)),
  ];
  const mergedHeaders = new Map<string, Finding>();
  for (const finding of headerFindings) {
    const existing = mergedHeaders.get(finding.id);
    if (!existing) {
      mergedHeaders.set(finding.id, finding);
      continue;
    }
    const extra = finding.evidence && finding.evidence !== existing.evidence ? `; ${finding.evidence}` : "";
    existing.evidence = `${existing.evidence || ""}${extra}`;
  }
  findings.push(...mergedHeaders.values());

  // Positive: HTTPS hosting reachable
  findings.push({
    id: "live-hosting-up",
    severity: "info",
    category: "infrastructure",
    title: "The live site answered over HTTPS",
    description: `${HOSTING_URL} responded during this scan.`,
    recommendation: "Nothing to do.",
    evidence: HOSTING_URL,
    summary: "The live site answered over HTTPS.",
    meaning: "People can reach the app, and the connection is encrypted.",
    impact: "This is a strength.",
    fix: "Nothing to do.",
  });

  const findingsPlain = findings.map(withPlain);
  const score = computeScore(findingsPlain);
  const summary = {
    totalFindings: findingsPlain.length,
    critical: findingsPlain.filter((f) => f.severity === "critical").length,
    high: findingsPlain.filter((f) => f.severity === "high").length,
    medium: findingsPlain.filter((f) => f.severity === "medium").length,
    low: findingsPlain.filter((f) => f.severity === "low").length,
    info: findingsPlain.filter((f) => f.severity === "info").length,
    usersChecked: profiles.size,
    passkeyEnrolled,
    passkeyMissing,
  };

  const recommendations = [
    ...findingsPlain
      .filter((f) => f.severity === "critical" || f.severity === "high" || f.severity === "medium")
      .slice(0, 8)
      .map((f) => f.fix || f.recommendation),
  ];
  const uniqueRecs = [...new Set(recommendations)];

  return {
    score,
    grade: gradeFor(score),
    scoreHeadline: scoreHeadline(score),
    scoreWhy: scoreWhy(score, findingsPlain, passkeyMissing),
    summary,
    breakdown: {
      authentication: categoryScore(findingsPlain, "authentication"),
      authorization: categoryScore(findingsPlain, "authorization"),
      dataProtection: categoryScore(findingsPlain, "data_protection"),
      configuration: categoryScore(findingsPlain, "configuration"),
      infrastructure: categoryScore(findingsPlain, "infrastructure"),
      monitoring: categoryScore(findingsPlain, "monitoring"),
    },
    findings: findingsPlain.sort((a, b) => (WEIGHT[b.severity] || 0) - (WEIGHT[a.severity] || 0)),
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

/**
 * Deep AI + live probe security review for the Admin dashboard.
 * Complements the fast posture scan with code-aware checks and safe probes.
 */
import * as admin from "firebase-admin";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { logger } from "firebase-functions";
import { computeScore, gradeFor, persistSecurityReport, runSecurityScanJob, scoreHeadline, scoreWhy } from "./securityScan";

const openaiApiKey = defineSecret("OPENAI_API_KEY");
const APP_URL = "https://hardyapp.co.uk";
const HOSTING_URL = "https://hardyhub-7b30d.web.app";
const OWNER_EMAIL = "chris.hardy.07@googlemail.com";

const CODE_INVENTORY = `
Hardy Hub is a private Firebase family app (React + Cloud Functions + Firestore).
Auth: Firebase email/password + WebAuthn passkeys. Custom claims set via Admin SDK: passkeyVerifiedAt, authMethod, deviceId.
App unlock: passkey freshness default 7 days. Trusted browsers keep a local hint and Firebase LOCAL persistence so a recent passkey skips the login screen.
Firestore: isAuthenticated() requires passkeyEnrolled. Display sessions authenticate as the pairing account with a deviceId claim; they may only read photos/tasks/calendar/birthdays/family notes and patch alarms/nightMode/alwaysOn/lastSeenAt.
Finance and other sensitive modules require a fresh passkeyVerifiedAt claim in rules.
Remote displays: QR pairing with hashed claim secret, 5-minute TTL. devicePairings has no client rules (Admin SDK only). Once claimed, the kiosk uses a long-lived custom token and must not be asked for a passkey every 7 days.
Owner email is hardcoded in a few admin checks: ${OWNER_EMAIL}.
Twilio softphone: signed callables for SMS/voice tokens; HTTP webhooks at /api/twilio/{voice,sms,status} must verify X-Twilio-Signature. Phone logs live at phone/{uid}/** (owner only).
Google OAuth tokens live in Firestore per user. TrueLayer bank connect uses functions. Password vaults are owner-only even for admins.
Hosting: CSP, HSTS, XFO DENY, nosniff, Referrer-Policy, Permissions-Policy (camera/microphone self for Voice).
Known residual risks to re-check: Flats (tattersalls) is family-wide writable; some pages default to no extra passkey; AI key historically in appConfig; Firebase web API key is public (expected) but must not grant data without Auth.
Login events are written to loginEvents (admin-read, functions-write).
`.trim();

function requireAuth(context: { auth?: { uid: string; token?: Record<string, unknown> } }) {
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

interface ProbeFinding {
  id: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: "authentication" | "authorization" | "data_protection" | "configuration" | "infrastructure" | "compliance" | "monitoring";
  kind: "security" | "improvement" | "activity";
  title: string;
  description: string;
  recommendation: string;
  summary: string;
  meaning: string;
  impact: string;
  fix: string;
  evidence?: string;
}

async function runPenTestProbes(): Promise<ProbeFinding[]> {
  const findings: ProbeFinding[] = [];

  const probe = async (label: string, url: string, init?: RequestInit) => {
    try {
      const res = await fetch(url, { method: init?.method || "GET", redirect: "follow", ...init });
      return { ok: res.ok, status: res.status, url };
    } catch (err) {
      return { ok: false, status: 0, url, error: String((err as Error).message || err) };
    }
  };

  const login = await probe("login", `${APP_URL}/login`);
  findings.push({
    id: "pentest-public-login",
    severity: "info",
    category: "infrastructure",
    kind: "security",
    title: login.status ? `The public login page answered (${login.status})` : "Could not reach the public login page",
    description: "A family app should have a login page on the open internet and keep private pages behind auth.",
    recommendation: "Nothing to do if this is 200.",
    summary: login.status ? "Strangers can see the login screen, which is expected." : "The live site did not answer during the probe.",
    meaning: "This is the front door. Private family pages should not load without signing in.",
    impact: "A note. It does not mean anyone is inside.",
    fix: "Nothing to do.",
    evidence: `${login.url} → ${login.status}`,
  });

  const adminPage = await probe("admin", `${APP_URL}/admin`);
  if (adminPage.status === 200) {
    findings.push({
      id: "pentest-admin-html",
      severity: "low",
      category: "authorization",
      kind: "security",
      title: "The admin address returns the app shell before login",
      description: "Firebase Hosting serves index.html for every route. Real admin APIs still require an admin account.",
      recommendation: "Keep admin Cloud Functions and Firestore rules admin-only (they already are).",
      summary: "Typing /admin without logging in still loads the app wrapper — not the admin data.",
      meaning: "This is how a single-page app works. The sensitive lists are not in that first HTML file.",
      impact: "Nice to have to know. Not a break-in.",
      fix: "Leave the hosting rewrite. Admin APIs must stay server-checked.",
      evidence: `GET /admin → ${adminPage.status}`,
    });
  }

  const pairing = await probe("pairing-status", HOSTING_URL);
  findings.push({
    id: "pentest-hosting-https",
    severity: pairing.status >= 200 && pairing.status < 400 ? "info" : "medium",
    category: "infrastructure",
    kind: "security",
    title: pairing.status >= 200 && pairing.status < 400
      ? "Firebase Hosting answered over HTTPS"
      : "Firebase Hosting did not answer cleanly",
    description: "The live hosting origin was probed the same way a simple internet check would.",
    recommendation: "If this fails, check Firebase Hosting.",
    summary: pairing.status >= 200 && pairing.status < 400
      ? "The hosted app is reachable over an encrypted connection."
      : "The hosted app did not return a healthy response.",
    meaning: "This is a reachability check, not a password guess.",
    impact: pairing.status >= 200 && pairing.status < 400 ? "This is a strength." : "Worth doing — people may not be able to open the app.",
    fix: pairing.status >= 200 && pairing.status < 400 ? "Nothing to do." : "Check Firebase Hosting and hardyapp.co.uk DNS.",
    evidence: `${HOSTING_URL} → ${pairing.status}`,
  });

  const twilioVoice = await probe("twilio-voice", `${APP_URL}/api/twilio/voice`, { method: "POST" });
  const twilioOk = twilioVoice.status === 403 || twilioVoice.status === 401;
  findings.push({
    id: "pentest-twilio-unsigned",
    severity: twilioOk ? "info" : twilioVoice.status === 0 ? "low" : "high",
    category: "infrastructure",
    kind: "security",
    title: twilioOk
      ? "Twilio voice webhook refused an unsigned request"
      : "Twilio voice webhook did not clearly refuse an unsigned request",
    description: "Anyone on the internet can hit the webhook URL. It must reject requests that are not signed by Twilio.",
    recommendation: "Keep X-Twilio-Signature checks on all three Twilio HTTP functions.",
    summary: twilioOk
      ? "A stranger cannot pretend to be Twilio on the voice webhook."
      : "The voice webhook did not return a clear ‘no’ to an unsigned POST.",
    meaning: "If this were open, someone could trigger outbound calls or inject call XML.",
    impact: twilioOk ? "This is a strength." : "Fix soon — webhook URLs leak in frontend rewrites and DNS.",
    fix: twilioOk ? "Leave the signature check as it is." : "Reject any POST to /api/twilio/* that fails Twilio.validateRequest.",
    evidence: `POST /api/twilio/voice → ${twilioVoice.status}`,
  });

  const firestoreOpen = await probe(
    "firestore-rest",
    "https://firestore.googleapis.com/v1/projects/hardyhub-7b30d/databases/(default)/documents/users",
  );
  const firestoreLocked = firestoreOpen.status === 401 || firestoreOpen.status === 403 || firestoreOpen.status === 404;
  findings.push({
    id: "pentest-firestore-unauth",
    severity: firestoreLocked ? "info" : firestoreOpen.status === 200 ? "critical" : "medium",
    category: "authorization",
    kind: "security",
    title: firestoreLocked
      ? "Unauthenticated Firestore REST did not list user documents"
      : "Unauthenticated Firestore REST returned an unexpected response",
    description: "A public REST list of /users would mean family accounts were readable without signing in.",
    recommendation: "Keep default-deny rules and do not grant public list on users.",
    summary: firestoreLocked
      ? "Strangers cannot list family user documents over the public Firestore API."
      : "The public Firestore API answered in a way we did not expect.",
    meaning: "This is a direct check of whether the database is hanging off the internet without a login.",
    impact: firestoreOpen.status === 200
      ? "Fix now. User records may be readable without signing in."
      : firestoreLocked ? "This is a strength." : "Worth confirming in the Google Cloud console.",
    fix: firestoreOpen.status === 200
      ? "Lock Firestore rules immediately and rotate any exposed data."
      : "Leave default-deny in place.",
    evidence: `GET firestore /users → ${firestoreOpen.status}`,
  });

  return findings;
}

async function askOpenAi(prompt: string): Promise<ProbeFinding[]> {
  const key = (() => {
    try { return String(openaiApiKey.value() || ""); } catch { return ""; }
  })();
  if (!key) {
    return [{
      id: "ai-key-missing",
      severity: "low",
      category: "configuration",
      kind: "improvement",
      title: "The thorough scan could not call the family AI key",
      description: "OPENAI_API_KEY is not set on this function, so the extra English review was skipped.",
      recommendation: "Set the OPENAI_API_KEY secret on Cloud Functions if you want the AI write-up.",
      summary: "The extra AI review was skipped because the family AI key is not available here.",
      meaning: "The live Firebase and header checks still ran. Only the written AI commentary is missing.",
      impact: "A tidy-up for the report, not a hole in the app.",
      fix: "In Google Cloud / Firebase, set the OPENAI_API_KEY secret used by other Hardy Hub AI tools.",
    }];
  }

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 2500,
        messages: [
          {
            role: "system",
            content: `You are a careful application security reviewer for a private family web app. Return ONLY JSON: {"findings":[{id,severity,category,kind,title,summary,meaning,impact,fix,description,recommendation,evidence}]}.
severity: critical|high|medium|low|info. kind: security|improvement|activity.
category: authentication|authorization|data_protection|configuration|infrastructure|compliance|monitoring.
Use short UK English. summary = simple English. meaning + impact + fix = a slightly more detailed explanation of why it matters and how to fix it.
Do not invent break-ins. If something is a strength, use severity info. Prefer ids prefixed ai-.`,
          },
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch (err) {
    logger.warn("deep scan openai fetch failed", { err });
    return [];
  }
  if (!response.ok) {
    logger.warn("deep scan openai status", { status: response.status });
    return [];
  }
  const data = await response.json() as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content || "";
  const jsonText = text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(jsonText) as { findings?: ProbeFinding[] };
    return (parsed.findings || []).slice(0, 20).map((f, i) => ({
      id: String(f.id || `ai-${i}`),
      severity: (["critical", "high", "medium", "low", "info"] as const).includes(f.severity) ? f.severity : "low",
      category: f.category || "configuration",
      kind: f.kind === "improvement" || f.kind === "activity" ? f.kind : "security",
      title: String(f.title || f.summary || "AI note"),
      description: String(f.description || f.meaning || ""),
      recommendation: String(f.recommendation || f.fix || ""),
      summary: String(f.summary || f.title || ""),
      meaning: String(f.meaning || f.description || ""),
      impact: String(f.impact || ""),
      fix: String(f.fix || f.recommendation || ""),
      evidence: f.evidence ? String(f.evidence) : undefined,
    }));
  } catch {
    return [];
  }
}

export const runDeepSecurityScan = onCall(
  {
    secrets: [openaiApiKey],
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (request) => {
    const uid = requireAuth(request);
    await requireAdmin(uid, request.auth?.token?.email);
    const base = await runSecurityScanJob({
      triggeredBy: "ai_deep",
      triggeredByUid: uid,
      triggeredByEmail: String(request.auth?.token?.email || ""),
    });
    const probes = await runPenTestProbes();
    const loginSnap = await admin.firestore().collection("loginEvents").orderBy("createdAtIso", "desc").limit(40).get();
    const loginSummary = loginSnap.docs.map((d) => {
      const data = d.data();
      return `${data.createdAtIso || ""} ${data.method} ${data.success ? "ok" : "fail"} ${data.email || data.uid || ""}`;
    }).join("\n");

    const ai = await askOpenAi(
      [
        CODE_INVENTORY,
        "",
        "Live posture findings:",
        base.findings.map((f) => `- [${f.severity}/${(f as { kind?: string }).kind || "security"}] ${f.id}: ${f.summary || f.title} | ${f.evidence || ""}`).join("\n"),
        "",
        "Safe internet probes:",
        probes.map((f) => `- ${f.id}: ${f.summary} (${f.evidence || ""})`).join("\n"),
        "",
        "Recent login events:",
        loginSummary || "(none yet)",
        "",
        "Review hackability of this family app. Separate real security issues from general improvements. Suggest concrete fixes.",
      ].join("\n"),
    );

    const seen = new Set(base.findings.map((f) => f.id));
    const extra = [...probes, ...ai].filter((f) => {
      if (seen.has(f.id)) return false;
      seen.add(f.id);
      return true;
    }) as typeof base.findings;
    const findings = [...base.findings, ...extra];
    const score = computeScore(findings);
    const grade = gradeFor(score);
    const report = {
      ...base,
      findings,
      score,
      grade,
      scoreHeadline: scoreHeadline(score, findings),
      scoreWhy: `${scoreWhy(score, findings, base.summary.passkeyMissing)} This was a thorough scan: live Firebase checks, safe internet probes, and an AI review of the architecture.`,
      summary: {
        ...base.summary,
        totalFindings: findings.length,
        critical: findings.filter((f) => f.severity === "critical").length,
        high: findings.filter((f) => f.severity === "high").length,
        medium: findings.filter((f) => f.severity === "medium").length,
        low: findings.filter((f) => f.severity === "low").length,
        info: findings.filter((f) => f.severity === "info").length,
      },
      triggeredBy: "ai_deep" as const,
      scanKind: "deep",
      durationMs: base.durationMs,
    };
    const saved = await persistSecurityReport(report);
    await admin.firestore().doc("securityScanPrefs/global").set(
      { lastRunAt: report.createdAtIso, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true },
    );
    return saved;
  },
);

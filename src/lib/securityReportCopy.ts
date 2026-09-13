import type {
  SecurityFinding,
  SecurityFindingSeverity,
  SecurityReport,
} from "@/types/securityReport";
import { SEVERITY_WEIGHT } from "@/types/securityReport";

export type SecurityDealLabel =
  | "Fix now"
  | "Fix soon"
  | "Worth doing"
  | "Nice to have"
  | "Looking good";

export interface PlainSecurityFinding extends SecurityFinding {
  summary: string;
  meaning: string;
  impact: string;
  fix: string;
  dealLabel: SecurityDealLabel;
}

const DEAL: Record<SecurityFindingSeverity, SecurityDealLabel> = {
  critical: "Fix now",
  high: "Fix soon",
  medium: "Worth doing",
  low: "Nice to have",
  info: "Looking good",
};

const KNOWN: Record<string, Partial<PlainSecurityFinding>> = {
  "arch-passkey-gate": {
    summary: "People must set up a passkey before they can use the app.",
    meaning: "A stolen password alone is not enough to open family data.",
    impact: "This is a strength, not a problem.",
    fix: "Leave this as it is.",
  },
  "arch-default-modules": {
    summary: "Some private pages do not ask for a passkey unless you turn that on.",
    meaning: "Money and remote displays are locked by default. Health, notes and similar pages stay open unless someone sets a lock in Settings.",
    impact: "Worth doing if a phone is shared or an account might be borrowed. Not an internet break-in.",
    fix: "In Settings → Security, require a passkey for any page you want extra-private.",
  },
  "arch-hardcoded-owner": {
    summary: "The main owner email is written into the app code.",
    meaning: "If you ever change that email, a developer has to update the code.",
    impact: "Nice to have. It does not let strangers in.",
    fix: "Later, move the owner list into an admin setting instead of the code.",
  },
  "arch-tattersalls-open": {
    summary: "Anyone signed in can see and change the Flats page.",
    meaning: "This is treated as a family-wide page. A guest account could edit rents and documents, not only look.",
    impact: "Fine if the whole family manages flats. Not fine if someone should only look, or if a spare login exists.",
    fix: "Share Flats with the people who should edit it, and keep guest accounts off that page.",
  },
  "arch-appconfig-writable": {
    summary: "The shared AI key can be read by the family, but only an admin can change it.",
    meaning: "In-app AI uses one key stored in the database. Signed-in people can use it. They can no longer overwrite it.",
    impact: "Nice to have to move the key to a server secret later. Not an open write hole any more.",
    fix: "Keep the key in Settings as an admin. When you can, move it to Secret Manager.",
  },
  "arch-login-audit": {
    summary: "Sign-ins and failed attempts are saved for the admin.",
    meaning: "You can see recent passkey, password and failed logins on the Security dashboard.",
    impact: "This is a strength.",
    fix: "Leave this as it is.",
  },
  "arch-no-login-audit": {
    summary: "Sign-ins and failed attempts are now saved for the admin.",
    meaning: "Login history is written to loginEvents and shown on the Security dashboard.",
    impact: "This is a strength.",
    fix: "Leave this as it is.",
  },
  "arch-vault-strong": {
    summary: "Password vaults stay private even from admins.",
    meaning: "A helper with admin access still cannot open someone else’s saved logins.",
    impact: "This is a strength.",
    fix: "Leave this as it is.",
  },
  "arch-invite-password-policy": {
    summary: "New accounts need a strong starter password.",
    meaning: "Invites cannot use a short or simple password.",
    impact: "This is a strength.",
    fix: "Leave this as it is.",
  },
  "hdr-csp": {
    summary: "The website does not tell the browser which scripts are allowed.",
    meaning: "If a bad script ever got onto a page, the browser would have fewer brakes.",
    impact: "Worth doing. It is a seatbelt, not a sign that anyone is in.",
    fix: "Keep the Content-Security-Policy header in firebase.json when you deploy.",
  },
  "hdr-xfo": {
    summary: "Other sites could try to show Hardy Hub inside a frame.",
    meaning: "That is a click-jacking trick. Unlikely on a private family site.",
    impact: "Nice to have.",
    fix: "Keep X-Frame-Options set to DENY in firebase.json.",
  },
  "hdr-xcto": {
    summary: "The site should tell browsers not to guess file types.",
    meaning: "Without this, a browser might treat a file as a script by mistake.",
    impact: "Nice to have.",
    fix: "Keep X-Content-Type-Options set to nosniff.",
  },
  "hdr-referrer": {
    summary: "Links out could include the full Hardy Hub address.",
    meaning: "Another site might see which page you came from.",
    impact: "Looking good / tidy-up. No break-in risk.",
    fix: "Keep Referrer-Policy set in firebase.json.",
  },
  "hdr-hsts": {
    summary: "One of the site addresses did not insist on HTTPS.",
    meaning: "On public Wi‑Fi, a fake network could try to serve a non-secure copy.",
    impact: "Worth doing for the public web address. Firebase usually already forces HTTPS.",
    fix: "Keep the HSTS header on hosting, and always use hardyapp.co.uk over https.",
  },
  "hdr-permissions": {
    summary: "The site does not list which phone features it will not use.",
    meaning: "Camera, mic and location are not explicitly switched off in a header.",
    impact: "Looking good / tidy-up.",
    fix: "Keep the Permissions-Policy header in firebase.json.",
  },
  "live-hosting-up": {
    summary: "The live site answered over HTTPS during the scan.",
    meaning: "People can reach the app, and the connection is encrypted.",
    impact: "This is a strength.",
    fix: "Nothing to do.",
  },
};

function fallbackCopy(finding: SecurityFinding): Pick<PlainSecurityFinding, "summary" | "meaning" | "impact" | "fix"> {
  return {
    summary: finding.title,
    meaning: finding.description,
    impact:
      finding.severity === "critical" ? "Fix this before you do other work. It could let the wrong person see or change family data."
      : finding.severity === "high" ? "This is a real gap. A signed-in person, or a stolen family login, could do more than they should."
      : finding.severity === "medium" ? "This is worth fixing when you can. It is not a stranger on the internet breaking in."
      : finding.severity === "low" ? "A tidy-up. Useful, but the family is not in danger because of this alone."
      : "A note, not a problem.",
    fix: finding.recommendation,
  };
}

export function dealLabelFor(severity: SecurityFindingSeverity): SecurityDealLabel {
  return DEAL[severity];
}

export function explainFinding(finding: SecurityFinding): PlainSecurityFinding {
  const known = KNOWN[finding.id] || {};
  const fallback = fallbackCopy(finding);
  return {
    ...finding,
    summary: finding.summary || known.summary || fallback.summary,
    meaning: finding.meaning || known.meaning || fallback.meaning,
    impact: finding.impact || known.impact || fallback.impact,
    fix: finding.fix || known.fix || fallback.fix,
    dealLabel: finding.dealLabel || known.dealLabel || DEAL[finding.severity],
  };
}

export function computeHonestSecurityScore(findings: SecurityFinding[]): number {
  let other = 0;
  let headers = 0;
  for (const finding of findings) {
    if ((finding.kind || "security") !== "security") continue;
    if (finding.severity === "info") continue;
    const weight = SEVERITY_WEIGHT[finding.severity] || 0;
    if (finding.id.startsWith("hdr-")) headers += weight;
    else other += weight;
  }
  return Math.max(0, Math.min(100, 100 - other - Math.min(12, headers)));
}

export function scoreHeadline(score: number, findings: SecurityFinding[] = []): string {
  const security = findings.filter((f) => (f.kind || "security") === "security" && f.severity !== "info");
  if (security.some((f) => f.severity === "critical")) return "Fix these security issues now";
  if (security.some((f) => f.severity === "high")) return "Security gaps need attention soon";
  if (score >= 90) return "In good shape";
  if (score >= 75) return "Solid, with a few tidy-ups";
  if (score >= 60) return "Fine for a private family app, with work still worth doing";
  if (security.every((f) => f.severity === "low") || security.length === 0) {
    return "Not wide open — these are hardening and tidy-ups";
  }
  return "Some hardening is worth doing";
}

export function explainScore(report: Pick<SecurityReport, "score" | "findings" | "summary">): string {
  const security = report.findings.filter((f) => (f.kind || "security") === "security" && f.severity !== "info");
  const critical = security.filter((f) => f.severity === "critical").length;
  const high = security.filter((f) => f.severity === "high").length;
  const medium = security.filter((f) => f.severity === "medium").length;
  const parts: string[] = [];

  if (critical + high === 0 && medium === 0) {
    parts.push("The security score is about how easy it would be for the wrong person to get in. Nothing here looks like a break-in.");
  } else if (critical + high === 0) {
    parts.push(
      `The score is ${report.score} because of ${medium} hardening item${medium === 1 ? "" : "s"} — seatbelts and tidy-ups, not a break-in.`,
    );
  } else {
    parts.push(
      `The score is ${report.score} mainly because of ${critical + high} more serious security item${critical + high === 1 ? "" : "s"} (labelled Fix now / Fix soon).`,
    );
  }

  parts.push(
    "Improvements that are not security holes sit in their own list. Notes marked Looking good do not lower the score.",
  );

  if (report.summary.passkeyMissing > 0) {
    parts.push(
      `${report.summary.passkeyMissing} account${report.summary.passkeyMissing === 1 ? " has" : "s have"} not finished passkey setup yet.`,
    );
  }

  return parts.join(" ");
}

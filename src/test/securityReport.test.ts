import { describe, expect, it } from "vitest";
import { computeSecurityScore, securityGrade } from "@/types/securityReport";
import type { SecurityFinding } from "@/types/securityReport";
import { explainFinding, explainScore } from "@/lib/securityReportCopy";

describe("security score", () => {
  it("starts at 100 with no findings", () => {
    expect(computeSecurityScore([])).toBe(100);
    expect(securityGrade(100)).toBe("A");
  });

  it("penalises by severity weights", () => {
    const findings: SecurityFinding[] = [
      {
        id: "1",
        severity: "high",
        category: "authorization",
        title: "t",
        description: "d",
        recommendation: "r",
      },
      {
        id: "2",
        severity: "medium",
        category: "configuration",
        title: "t",
        description: "d",
        recommendation: "r",
      },
    ];
    expect(computeSecurityScore(findings)).toBe(85);
    expect(securityGrade(85)).toBe("B");
  });

  it("clamps at zero", () => {
    const findings = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      severity: "critical" as const,
      category: "authentication" as const,
      title: "t",
      description: "d",
      recommendation: "r",
    }));
    expect(computeSecurityScore(findings)).toBe(0);
    expect(securityGrade(0)).toBe("F");
  });

  it("does not let repeated header notes flatten the score", () => {
    const findings: SecurityFinding[] = [
      { id: "hdr-csp", severity: "medium", category: "infrastructure", title: "t", description: "d", recommendation: "r" },
      { id: "hdr-hsts", severity: "medium", category: "infrastructure", title: "t", description: "d", recommendation: "r" },
      { id: "hdr-xfo", severity: "low", category: "infrastructure", title: "t", description: "d", recommendation: "r" },
      { id: "hdr-xcto", severity: "low", category: "infrastructure", title: "t", description: "d", recommendation: "r" },
    ];
    expect(computeSecurityScore(findings)).toBe(88);
  });
});

describe("plain language security copy", () => {
  it("explains a known finding in everyday words", () => {
    const plain = explainFinding({
      id: "arch-appconfig-writable",
      severity: "low",
      category: "data_protection",
      title: "t",
      description: "d",
      recommendation: "r",
    });
    expect(plain.dealLabel).toBe("Nice to have");
    expect(plain.summary.toLowerCase()).toContain("ai key");
    expect(plain.meaning.length).toBeGreaterThan(20);
    expect(plain.fix.length).toBeGreaterThan(10);
  });

  it("explains why a mid score is not an emergency", () => {
    const why = explainScore({
      score: 72,
      findings: [
        {
          id: "arch-tattersalls-open",
          severity: "medium",
          category: "authorization",
          title: "t",
          description: "d",
          recommendation: "r",
        },
      ],
      summary: {
        totalFindings: 1,
        critical: 0,
        high: 0,
        medium: 1,
        low: 0,
        info: 0,
        usersChecked: 3,
        passkeyEnrolled: 3,
        passkeyMissing: 0,
      },
    });
    expect(why).toContain("72");
    expect(why.toLowerCase()).toContain("not a break-in");
  });
});

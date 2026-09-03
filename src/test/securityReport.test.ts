import { describe, expect, it } from "vitest";
import { computeSecurityScore, securityGrade } from "@/types/securityReport";
import type { SecurityFinding } from "@/types/securityReport";

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
});

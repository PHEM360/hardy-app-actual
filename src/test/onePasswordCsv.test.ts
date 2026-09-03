import { describe, expect, it } from "vitest";
import { exportOnePasswordCsv, parseCsv, parseOnePasswordCsv } from "@/lib/onePasswordCsv";

describe("onePasswordCsv", () => {
  it("parses quoted CSV cells", () => {
    const rows = parseCsv('Title,Notes\n"Acme, Inc","Line 1\nLine 2"\n');
    expect(rows[1][0]).toBe("Acme, Inc");
    expect(rows[1][1]).toContain("Line 1");
  });

  it("imports a 1Password-style login CSV", () => {
    const csv = [
      "Title,Website,Username,Password,Notes,Tags",
      "Netflix,https://netflix.com,me@example.com,secret123,Family plan,Streaming",
      ",,,,",
    ].join("\n");
    const items = parseOnePasswordCsv(csv);
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe("Netflix");
    expect(items[0].username).toBe("me@example.com");
    expect(items[0].password).toBe("secret123");
    expect(items[0].url).toBe("https://netflix.com");
    expect(items[0].category).toBe("Streaming");
  });

  it("round-trips export headers 1Password understands", () => {
    const csv = exportOnePasswordCsv([
      {
        name: "Bank",
        url: "https://bank.example",
        username: "chris",
        password: "p@ss",
        notes: "main",
        category: "Finance",
      },
    ]);
    expect(csv.startsWith("Title,Website,Username,Password,Notes,Tags")).toBe(true);
    const again = parseOnePasswordCsv(csv);
    expect(again[0].name).toBe("Bank");
    expect(again[0].password).toBe("p@ss");
  });
});

import { describe, expect, it } from "vitest";
import { cleanCompanyPayload } from "@/lib/companyPayload";

describe("cleanCompanyPayload", () => {
  it("keeps an uploaded logo while removing Firestore-invalid undefined fields", () => {
    const payload = cleanCompanyPayload({
      name: "Example Ltd",
      color: "#6366f1",
      logoUrl: "https://storage.example/logo.png",
      parentCompanyId: undefined,
      contact: {
        email: "hello@example.com",
        phone: undefined,
      },
    });

    expect(payload).toEqual({
      name: "Example Ltd",
      color: "#6366f1",
      logoUrl: "https://storage.example/logo.png",
      contact: {
        email: "hello@example.com",
      },
    });
    expect("parentCompanyId" in payload).toBe(false);
  });
});

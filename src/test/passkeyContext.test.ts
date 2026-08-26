import { describe, expect, it } from "vitest";
import { resolvePasskeyContext } from "../../functions/src/passkeyContext";
import { passkeyErrorMessage } from "@/lib/passkeys";

describe("passkey origin context", () => {
  it("accepts the live site and common local ports", () => {
    expect(resolvePasskeyContext("https://hardyapp.co.uk")).toEqual({
      origin: "https://hardyapp.co.uk",
      rpID: "hardyapp.co.uk",
    });
    expect(resolvePasskeyContext("http://localhost:8080")?.rpID).toBe("localhost");
    expect(resolvePasskeyContext("http://localhost:8081")).toEqual({
      origin: "http://localhost:8081",
      rpID: "localhost",
    });
    expect(resolvePasskeyContext("http://127.0.0.1:5174")?.rpID).toBe("127.0.0.1");
  });

  it("rejects unknown public origins", () => {
    expect(resolvePasskeyContext("https://evil.example")).toBeNull();
    expect(resolvePasskeyContext("http://192.168.8.114:8081")).toBeNull();
  });
});

describe("passkey error copy", () => {
  it("explains a blocked local address instead of calling the passkey unverified", () => {
    expect(passkeyErrorMessage({
      code: "functions/permission-denied",
      message: "Firebase: Passkeys are not available from this web address. (functions/permission-denied)",
    })).toContain("http://localhost:8080");
  });

  it("keeps a genuine verification failure readable", () => {
    expect(passkeyErrorMessage({
      code: "functions/permission-denied",
      message: "Firebase: The passkey could not be verified. (functions/permission-denied)",
    })).toBe("The passkey could not be verified.");
  });
});

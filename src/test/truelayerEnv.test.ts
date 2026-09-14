import { describe, expect, it } from "vitest";
import { classifyTrueLayerTokenError, resolveTrueLayerEnv } from "../../functions/src/truelayerEnv";

describe("TrueLayer environment probe", () => {
  it("treats the console error as an unknown client", () => {
    expect(classifyTrueLayerTokenError("unauthorized_client", "Unknown client or client not enabled")).toBe("unknown_client");
    expect(classifyTrueLayerTokenError("invalid_grant", "Code is invalid")).toBe("recognized");
  });

  it("switches to the environment that recognises the client", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      const unknown = url.includes("sandbox");
      return {
        ok: false,
        json: async () => unknown
          ? { error: "unauthorized_client", error_description: "Unknown client or client not enabled" }
          : { error: "invalid_grant", error_description: "Authorization code is invalid" },
      } as Response;
    };
    const resolved = await resolveTrueLayerEnv({
      preferred: "sandbox",
      clientId: "abc",
      clientSecret: "secret",
      redirectUri: "https://hardyapp.co.uk/api/truelayer/callback",
      fetchImpl,
    });
    expect(resolved.env).toBe("live");
    expect(resolved.mismatch).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildTrueLayerAuthUrl,
  CANONICAL_REDIRECT_URI,
  classifyTrueLayerTokenError,
  encodeAuthQuery,
  envFromClientId,
  normalizeTrueLayerSecret,
  resolveTrueLayerEnv,
} from "../../functions/src/truelayerEnv";

describe("TrueLayer environment probe", () => {
  it("treats the console error as an unknown client", () => {
    expect(classifyTrueLayerTokenError("unauthorized_client", "Unknown client or client not enabled")).toBe("unknown_client");
    expect(classifyTrueLayerTokenError("invalid_client", "")).toBe("unknown_client");
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

  it("does not treat invalid_client on sandbox as a recognised sandbox app", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      return {
        ok: false,
        json: async () => url.includes("sandbox")
          ? { error: "invalid_client" }
          : { error: "invalid_grant" },
      } as Response;
    };
    const resolved = await resolveTrueLayerEnv({
      preferred: "sandbox",
      clientId: "hardyapp-69d4c7",
      clientSecret: "secret",
      redirectUri: CANONICAL_REDIRECT_URI,
      fetchImpl,
    });
    expect(resolved.env).toBe("live");
  });
});

describe("TrueLayer auth URL helpers", () => {
  it("strips stray newlines from secrets", () => {
    expect(normalizeTrueLayerSecret("hardyapp-69d4c7\n\n")).toBe("hardyapp-69d4c7");
    expect(envFromClientId("sandbox-hardyapp-69d4c7\n")).toBe("sandbox");
    expect(envFromClientId("hardyapp-69d4c7")).toBe("live");
  });

  it("encodes scopes with percent encoding instead of plus signs", () => {
    const query = encodeAuthQuery({
      response_type: "code",
      scope: "info accounts balance transactions offline_access",
      providers: "uk-ob-all uk-oauth-all",
    });
    expect(query).toContain("scope=info%20accounts%20balance%20transactions%20offline_access");
    expect(query).toContain("providers=uk-ob-all%20uk-oauth-all");
    expect(query).not.toContain("+");
  });

  it("treats sandbox-prefixed IDs as sandbox", () => {
    expect(envFromClientId("sandbox-hardyapp-69d4c7")).toBe("sandbox");
  });

  it("builds a live auth link against the registered hardyapp callback", () => {
    const url = buildTrueLayerAuthUrl("live", {
      response_type: "code",
      client_id: "hardyapp-69d4c7",
      redirect_uri: CANONICAL_REDIRECT_URI,
      scope: "info accounts balance transactions offline_access",
    });
    expect(url.startsWith("https://auth.truelayer.com/?")).toBe(true);
    expect(url).toContain("client_id=hardyapp-69d4c7");
    expect(url).toContain("redirect_uri=https%3A%2F%2Fhardyapp.co.uk%2Fapi%2Ftruelayer%2Fcallback");
    expect(url).not.toContain("hardyhub-7b30d");
  });
});

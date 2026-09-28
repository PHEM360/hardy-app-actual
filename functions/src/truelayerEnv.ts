export type TrueLayerEnv = "sandbox" | "live";

/** The only production URI registered on the live TrueLayer app. */
export const CANONICAL_REDIRECT_URI = "https://hardyapp.co.uk/api/truelayer/callback";

export function authHost(env: TrueLayerEnv) {
  return env === "sandbox" ? "https://auth.truelayer-sandbox.com" : "https://auth.truelayer.com";
}

export function apiHost(env: TrueLayerEnv) {
  return env === "sandbox" ? "https://api.truelayer-sandbox.com" : "https://api.truelayer.com";
}

export function normalizeTrueLayerSecret(value: string) {
  return String(value || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
}

export function envFromClientId(clientId: string): TrueLayerEnv | undefined {
  const id = normalizeTrueLayerSecret(clientId).toLowerCase();
  if (!id) return undefined;
  return id.startsWith("sandbox-") ? "sandbox" : "live";
}

export function encodeAuthQuery(params: Record<string, string>) {
  return Object.entries(params)
    .filter(([, value]) => value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
}

export function buildTrueLayerAuthUrl(env: TrueLayerEnv, params: Record<string, string>) {
  return `${authHost(env)}/?${encodeAuthQuery(params)}`;
}

export function classifyTrueLayerTokenError(error?: string, description?: string): "unknown_client" | "recognized" {
  const blob = `${error || ""} ${description || ""}`.toLowerCase();
  if (
    blob.includes("unknown client") ||
    blob.includes("client not enabled") ||
    blob.includes("unauthorized_client") ||
    blob.includes("invalid_client")
  ) {
    return "unknown_client";
  }
  return "recognized";
}

export async function probeTrueLayerEnv(
  env: TrueLayerEnv,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<"unknown_client" | "recognized" | "error"> {
  try {
    const res = await fetchImpl(`${authHost(env)}/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        code: "hardy-hub-env-probe",
      }).toString(),
    });
    const json = (await res.json().catch(() => ({}))) as { error?: string; error_description?: string };
    return classifyTrueLayerTokenError(json.error, json.error_description);
  } catch {
    return "error";
  }
}

export async function resolveTrueLayerEnv(args: {
  preferred: TrueLayerEnv;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  fetchImpl?: typeof fetch;
}): Promise<{ env: TrueLayerEnv; mismatch: boolean; probed: boolean }> {
  const clientId = normalizeTrueLayerSecret(args.clientId);
  const clientSecret = normalizeTrueLayerSecret(args.clientSecret);
  const hinted = envFromClientId(clientId);
  const preferred = hinted ?? args.preferred;
  const other: TrueLayerEnv = preferred === "sandbox" ? "live" : "sandbox";
  const first = await probeTrueLayerEnv(preferred, clientId, clientSecret, args.redirectUri, args.fetchImpl);
  if (first === "recognized") {
    return { env: preferred, mismatch: preferred !== args.preferred, probed: true };
  }
  const second = await probeTrueLayerEnv(other, clientId, clientSecret, args.redirectUri, args.fetchImpl);
  if (second === "recognized") {
    return { env: other, mismatch: true, probed: true };
  }
  // A live client ID must never be sent to sandbox auth, even if both probes failed.
  const fallback = hinted ?? args.preferred;
  return {
    env: fallback,
    mismatch: first === "unknown_client" || fallback !== args.preferred,
    probed: first !== "error" || second !== "error",
  };
}

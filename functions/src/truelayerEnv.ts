export type TrueLayerEnv = "sandbox" | "live";

export function authHost(env: TrueLayerEnv) {
  return env === "sandbox" ? "https://auth.truelayer-sandbox.com" : "https://auth.truelayer.com";
}

export function apiHost(env: TrueLayerEnv) {
  return env === "sandbox" ? "https://api.truelayer-sandbox.com" : "https://api.truelayer.com";
}

export function classifyTrueLayerTokenError(error?: string, description?: string): "unknown_client" | "recognized" {
  const blob = `${error || ""} ${description || ""}`.toLowerCase();
  if (
    blob.includes("unknown client") ||
    blob.includes("client not enabled") ||
    blob.includes("unauthorized_client")
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
  const preferred = args.preferred;
  const other: TrueLayerEnv = preferred === "sandbox" ? "live" : "sandbox";
  const first = await probeTrueLayerEnv(preferred, args.clientId, args.clientSecret, args.redirectUri, args.fetchImpl);
  if (first === "recognized") return { env: preferred, mismatch: false, probed: true };
  const second = await probeTrueLayerEnv(other, args.clientId, args.clientSecret, args.redirectUri, args.fetchImpl);
  if (second === "recognized") return { env: other, mismatch: true, probed: true };
  return { env: preferred, mismatch: first === "unknown_client", probed: first !== "error" || second !== "error" };
}

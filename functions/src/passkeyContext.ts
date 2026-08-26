export const PRIMARY_RP_ID = "hardyapp.co.uk";

const FIXED_ORIGINS = new Map([
  ["https://hardyapp.co.uk", "hardyapp.co.uk"],
  ["https://www.hardyapp.co.uk", "hardyapp.co.uk"],
  ["https://hardyhub-7b30d.web.app", "hardyhub-7b30d.web.app"],
  ["https://hardyhub-7b30d.firebaseapp.com", "hardyhub-7b30d.firebaseapp.com"],
  ["http://localhost:5173", "localhost"],
  ["http://localhost:8080", "localhost"],
]);

function localDevRpId(origin: string) {
  try {
    const url = new URL(origin);
    const localHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (!localHost || (url.protocol !== "http:" && url.protocol !== "https:")) return null;
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
    return url.hostname;
  } catch {
    return null;
  }
}

export function resolvePasskeyContext(origin: string) {
  const trimmed = String(origin || "").trim();
  const fixed = FIXED_ORIGINS.get(trimmed);
  if (fixed) return { origin: trimmed, rpID: fixed };
  const localRpId = localDevRpId(trimmed);
  if (localRpId) return { origin: trimmed, rpID: localRpId };
  return null;
}

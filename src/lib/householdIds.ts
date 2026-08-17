/** Firestore auto-ids and Firebase Auth uids look like this — not a household name. */
export function looksLikeGeneratedId(value: string | undefined | null): boolean {
  const v = (value ?? "").trim();
  if (v.length < 16 || v.length > 36) return false;
  if (/\s/.test(v)) return false;
  return /^[A-Za-z0-9_-]+$/.test(v);
}

export function is35PfpHousehold(name: string | undefined | null): boolean {
  return /35\s*pfp/i.test((name ?? "").trim());
}

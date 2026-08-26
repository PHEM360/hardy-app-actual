export function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function normalizeNotifyEmail(value: string) {
  const email = String(value || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 120) return null;
  return email;
}

export function parseNotifyEmails(value: unknown) {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value.map((item) => normalizeNotifyEmail(String(item || ""))).filter((item): item is string => !!item),
  ).slice(0, 10);
}

export function parseNotifyUids(value: unknown) {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value.map((item) => String(item || "").trim()).filter((id) => id.length >= 6 && id.length <= 128 && !/\s/.test(id)),
  ).slice(0, 10);
}

export function petAccessUids(pet: { ownerId?: unknown; sharedWith?: unknown }, pageShareUids: string[] = []) {
  const owner = String(pet.ownerId || "");
  const shared = Array.isArray(pet.sharedWith) ? pet.sharedWith.map((item) => String(item || "")) : [];
  return uniqueStrings(owner ? [owner, ...shared, ...pageShareUids] : [...shared, ...pageShareUids]);
}

export type ScanNotifyTarget = {
  uid: string;
  email: string;
  name: string;
  source: "access" | "extra";
};

export function buildScanNotifyTargets(input: {
  accessUids: string[];
  extraUids: string[];
  extraEmails: string[];
  users: Record<string, { email?: string; name?: string }>;
}): ScanNotifyTarget[] {
  const targets: ScanNotifyTarget[] = [];
  const seenUid = new Set<string>();
  const seenEmail = new Set<string>();

  const add = (uid: string, email: string, name: string, source: ScanNotifyTarget["source"]) => {
    const safeEmail = normalizeNotifyEmail(email) || "";
    if (uid && seenUid.has(uid)) return;
    if (safeEmail && seenEmail.has(safeEmail)) return;
    if (!uid && !safeEmail) return;
    if (uid) seenUid.add(uid);
    if (safeEmail) seenEmail.add(safeEmail);
    targets.push({ uid, email: safeEmail, name: name || "Family member", source });
  };

  for (const uid of uniqueStrings(input.accessUids)) {
    const user = input.users[uid] || {};
    add(uid, user.email || "", user.name || "Family member", "access");
  }
  for (const uid of uniqueStrings(input.extraUids)) {
    if (seenUid.has(uid)) continue;
    const user = input.users[uid] || {};
    add(uid, user.email || "", user.name || "Extra contact", "extra");
  }
  for (const email of parseNotifyEmails(input.extraEmails)) {
    add("", email, email, "extra");
  }
  return targets;
}

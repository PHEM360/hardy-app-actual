import type { PlainCredential } from "@/lib/passwordVaultCrypto";

/** Minimal CSV parser that handles quoted fields and commas. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    const next = input[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function csvEscape(value: string) {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function headerIndex(headers: string[], ...names: string[]) {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = normalized.indexOf(name.toLowerCase());
    if (idx >= 0) return idx;
  }
  return -1;
}

/**
 * Parse a 1Password (or compatible) CSV export into vault credentials.
 * Supports columns: Title, Website/URL, Username, Password, Notes, Tags.
 */
export function parseOnePasswordCsv(text: string): PlainCredential[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  const titleIdx = headerIndex(headers, "title", "name");
  const urlIdx = headerIndex(headers, "website", "url", "urls");
  const userIdx = headerIndex(headers, "username", "user name", "email");
  const passIdx = headerIndex(headers, "password");
  const notesIdx = headerIndex(headers, "notes", "note");
  const tagsIdx = headerIndex(headers, "tags", "tag");
  if (titleIdx < 0 && userIdx < 0 && passIdx < 0) {
    throw new Error("This CSV does not look like a 1Password login export (missing Title / Username / Password).");
  }

  const out: PlainCredential[] = [];
  for (const row of rows.slice(1)) {
    const name = (row[titleIdx] || "").trim();
    const username = (userIdx >= 0 ? row[userIdx] : "")?.trim() || "";
    const password = (passIdx >= 0 ? row[passIdx] : "")?.trim() || "";
    const url = (urlIdx >= 0 ? row[urlIdx] : "")?.trim() || "";
    const notes = (notesIdx >= 0 ? row[notesIdx] : "")?.trim() || "";
    const tags = (tagsIdx >= 0 ? row[tagsIdx] : "")?.trim() || "";
    if (!name && !username && !password) continue;
    if (!password && !username) continue;
    out.push({
      name: name || username || url || "Imported login",
      url: url || undefined,
      username: username || undefined,
      password: password || undefined,
      notes: notes || undefined,
      category: tags.split(/[;,]/)[0]?.trim() || "Imported",
      fields: [
        ...(username ? [{ id: crypto.randomUUID(), type: "username" as const, label: "Username", value: username }] : []),
        ...(password ? [{ id: crypto.randomUUID(), type: "password" as const, label: "Password", value: password }] : []),
        ...(url ? [{ id: crypto.randomUUID(), type: "website" as const, label: "Website", value: url }] : []),
      ],
    });
  }
  return out;
}

/** Export vault logins as a 1Password-compatible CSV. */
export function exportOnePasswordCsv(
  credentials: Array<{
    name: string;
    url?: string;
    username?: string;
    password?: string;
    notes?: string;
    category?: string;
  }>,
) {
  const header = ["Title", "Website", "Username", "Password", "Notes", "Tags"];
  const lines = [header.map(csvEscape).join(",")];
  for (const item of credentials) {
    lines.push(
      [
        item.name || "",
        item.url || "",
        item.username || "",
        item.password || "",
        item.notes || "",
        item.category || "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function downloadTextFile(filename: string, contents: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([contents], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

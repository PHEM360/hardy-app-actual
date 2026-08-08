import type { Account, BalanceEntry } from "@/hooks/useFinance";

export interface ImportPreviewRow {
  date: string; // ISO yyyy-mm-dd
  accountId: string;
  accountName: string;
  balance: number;
  existingEntryId?: string;
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  matchedAccountNames: string[];
  unmatchedColumns: string[];
  skippedCells: number;
  dateRange: { start: string; end: string } | null;
  updatingCount: number;
}

/** Minimal, dependency-free CSV parser — handles quoted fields, embedded commas/newlines, "" escapes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((f) => f.trim() !== "")) rows.push(row);
  }
  return rows;
}

function isoFrom(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Parses a date cell as ISO (yyyy-mm-dd), UK (dd/mm/yyyy or dd-mm-yyyy), or a JS-parseable fallback. */
export function parseDateCell(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return isoFrom(+m[1], +m[2], +m[3]);

  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (m) return isoFrom(+m[3], +m[2], +m[1]);

  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];

  return null;
}

export function parseBalanceCell(raw: string): number | null {
  const cleaned = raw.replace(/[£,\s]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return isNaN(n) ? null : n;
}

/**
 * Parses a CSV in the "Date, AccountName1, AccountName2, ..." template shape.
 * Columns must match an existing account name exactly (case/whitespace-insensitive);
 * unmatched columns are reported but skipped rather than guessed at.
 */
export function parseBalanceCsv(
  text: string,
  accounts: Account[],
  existingEntries: BalanceEntry[]
): ImportPreview {
  const table = parseCsv(text);
  if (table.length < 2) {
    return { rows: [], matchedAccountNames: [], unmatchedColumns: [], skippedCells: 0, dateRange: null, updatingCount: 0 };
  }

  const header = table[0];
  const accountCols: { index: number; account: Account }[] = [];
  const unmatchedColumns: string[] = [];

  for (let i = 1; i < header.length; i++) {
    const name = (header[i] ?? "").trim();
    if (!name) continue;
    const account = accounts.find((a) => a.name.trim().toLowerCase() === name.toLowerCase());
    if (account) accountCols.push({ index: i, account });
    else unmatchedColumns.push(name);
  }

  const existingByKey = new Map(existingEntries.map((e) => [`${e.accountId}_${e.date}`, e.id]));

  const rows: ImportPreviewRow[] = [];
  let skippedCells = 0;
  let updatingCount = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (let r = 1; r < table.length; r++) {
    const line = table[r];
    const date = parseDateCell(line[0] ?? "");
    if (!date) {
      if (line.some((c) => c.trim())) skippedCells++;
      continue;
    }
    for (const { index, account } of accountCols) {
      const raw = line[index] ?? "";
      if (!raw.trim()) continue;
      const balance = parseBalanceCell(raw);
      if (balance === null) {
        skippedCells++;
        continue;
      }
      const existingEntryId = existingByKey.get(`${account.id}_${date}`);
      if (existingEntryId) updatingCount++;
      rows.push({ date, accountId: account.id, accountName: account.name, balance, existingEntryId });
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
    }
  }

  return {
    rows,
    matchedAccountNames: accountCols.map((c) => c.account.name),
    unmatchedColumns,
    skippedCells,
    dateRange: minDate && maxDate ? { start: minDate, end: maxDate } : null,
    updatingCount,
  };
}

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Builds a downloadable CSV template with one column per existing account. */
export function buildTemplateCsv(accounts: Account[]): string {
  const header = ["Date", ...accounts.map((a) => a.name)];
  const exampleRow = [new Date().toISOString().split("T")[0], ...accounts.map(() => "")];
  return [header, exampleRow].map((row) => row.map(csvEscape).join(",")).join("\r\n");
}

export function downloadTextFile(filename: string, content: string, mimeType = "text/csv;charset=utf-8;") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

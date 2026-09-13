import { jsPDF } from "jspdf";
import type { HouseholdNote } from "@/types/app";

function formatDate(value: HouseholdNote["updatedAt"] | HouseholdNote["createdAt"]) {
  if (!value) return "";
  const ms =
    typeof value?.toMillis === "function"
      ? value.toMillis()
      : typeof value?.seconds === "number"
        ? value.seconds * 1000
        : typeof value === "string" || typeof value === "number"
          ? new Date(value).getTime()
          : NaN;
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function wrapLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  const raw = (text || "").replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];
  for (const paragraph of raw) {
    if (!paragraph) {
      lines.push("");
      continue;
    }
    const wrapped = doc.splitTextToSize(paragraph, maxWidth) as string[];
    lines.push(...wrapped);
  }
  return lines.length ? lines : [""];
}

/** Build a printable PDF of all household notes, grouped by type. */
export function buildHouseholdNotesPdf(
  notes: HouseholdNote[],
  opts: { householdName: string; noteTypes: string[] },
): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 48;
  const marginTop = 56;
  const marginBottom = 48;
  const maxWidth = pageW - marginX * 2;
  let y = marginTop;

  const ensureSpace = (needed: number) => {
    if (y + needed <= pageH - marginBottom) return;
    doc.addPage();
    y = marginTop;
  };

  const stamp = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text(`${opts.householdName} — Notes summary`, marginX, y);
  y += 22;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(`Generated ${stamp} · ${notes.length} note${notes.length === 1 ? "" : "s"}`, marginX, y);
  y += 18;
  doc.setDrawColor(200);
  doc.line(marginX, y, pageW - marginX, y);
  y += 20;
  doc.setTextColor(0);

  const typeOrder = [
    ...opts.noteTypes,
    ...notes
      .map((n) => n.noteType || "Untyped")
      .filter((t) => t !== "Untyped" && !opts.noteTypes.includes(t)),
    "Untyped",
  ].filter((t, i, arr) => arr.indexOf(t) === i);

  const grouped = new Map<string, HouseholdNote[]>();
  for (const type of typeOrder) grouped.set(type, []);
  for (const note of notes) {
    const key = note.noteType?.trim() || "Untyped";
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(note);
  }

  let wroteAny = false;
  for (const [type, items] of grouped) {
    if (!items.length) continue;
    wroteAny = true;
    ensureSpace(36);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 90, 110);
    doc.text(type, marginX, y);
    y += 16;
    doc.setTextColor(0);

    for (const note of items) {
      const title = note.title?.trim() || "Untitled note";
      const bodyLines = wrapLines(doc, note.body || "", maxWidth);
      const dateLabel = formatDate(note.updatedAt || note.createdAt);
      const headerH = 28;
      const bodyH = bodyLines.length * 13;
      ensureSpace(headerH + Math.min(bodyH, 80) + 12);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(title, marginX, y);
      y += 14;
      if (dateLabel) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(110);
        doc.text(dateLabel, marginX, y);
        doc.setTextColor(0);
        y += 12;
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const line of bodyLines) {
        ensureSpace(14);
        doc.text(line || " ", marginX, y);
        y += 13;
      }
      y += 14;
    }
  }

  if (!wroteAny) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text("No notes yet.", marginX, y);
  }

  return doc.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function shareOrDownloadNotesPdf(
  blob: Blob,
  filename: string,
  opts: { householdName: string },
) {
  const file = new File([blob], filename, { type: "application/pdf" });
  const canShareFiles =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] });

  if (canShareFiles) {
    await navigator.share({
      files: [file],
      title: `${opts.householdName} notes`,
      text: `Household notes summary for ${opts.householdName}`,
    });
    return "shared" as const;
  }

  downloadBlob(blob, filename);
  const subject = encodeURIComponent(`${opts.householdName} — household notes`);
  const body = encodeURIComponent(
    `Attached is the household notes summary for ${opts.householdName}.\n\n(The PDF was downloaded — attach it to this email before sending.)`,
  );
  window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
  return "downloaded" as const;
}

export function printNotesPdf(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank");
  if (!win) {
    downloadBlob(blob, "household-notes.pdf");
    URL.revokeObjectURL(url);
    return;
  }
  const revoke = () => URL.revokeObjectURL(url);
  win.addEventListener("load", () => {
    try {
      win.focus();
      win.print();
    } finally {
      setTimeout(revoke, 60_000);
    }
  });
  // Fallback revoke if load never fires (some browsers)
  setTimeout(revoke, 120_000);
}

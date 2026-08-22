export type ReceiptKind = "image" | "pdf" | "other";

export type ReceiptSource = {
  url?: string;
  file?: File;
  name?: string;
};

function pathFromUrl(url: string) {
  try {
    return decodeURIComponent(url.split("?")[0] ?? "");
  } catch {
    return url;
  }
}

export function filenameFromUrl(url: string) {
  const path = pathFromUrl(url);
  const raw = path.split("/").pop() || "Receipt";
  return raw.replace(/^\d+_/, "") || "Receipt";
}

export function receiptKindFromNameAndType(name: string, mime = ""): ReceiptKind {
  const n = name.toLowerCase();
  const t = mime.toLowerCase();
  if (t.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|bmp|avif)$/i.test(n)) return "image";
  if (t.includes("pdf") || n.endsWith(".pdf")) return "pdf";
  return "other";
}

export function receiptKind(source: ReceiptSource): ReceiptKind {
  if (source.file) {
    return receiptKindFromNameAndType(source.file.name, source.file.type);
  }
  const url = source.url ?? "";
  return receiptKindFromNameAndType(source.name || filenameFromUrl(url), "");
}

export function receiptLabel(source: ReceiptSource) {
  if (source.name?.trim()) return source.name.trim();
  if (source.file?.name) return source.file.name;
  if (source.url) return filenameFromUrl(source.url);
  return "Receipt";
}

export function alignedReceiptNames(urls: string[], names?: string[]) {
  return urls.map((url, i) => names?.[i]?.trim() || filenameFromUrl(url));
}

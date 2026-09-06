const SHORT_HOSTS = new Set(["photos.app.goo.gl", "goo.gl"]);
const PHOTOS_HOSTS = new Set(["photos.google.com", "photos.app.goo.gl"]);

export function isGooglePhotosShareUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (SHORT_HOSTS.has(host) && url.pathname.length > 1) return true;
    if (!PHOTOS_HOSTS.has(host)) return false;
    return /\/(share|album|u\/\d+\/(?:share|album))\//.test(url.pathname);
  } catch {
    return false;
  }
}

export function googlePhotosMediaId(url: string): string {
  const path = url.split("?")[0].split("=")[0].replace(/\\+$/, "");
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function sizedGooglePhotoUrl(url: string, width = 1600): string {
  const base = unescapeGooglePhotoUrl(url).split("=")[0].replace(/\\+$/, "");
  return `${base}=w${width}`;
}

export function unescapeGooglePhotoUrl(value: string): string {
  return value
    .replace(/\\u003d/gi, "=")
    .replace(/\\u0026/gi, "&")
    .replace(/\\\//g, "/");
}

export function extractGooglePhotosFromHtml(html: string): {
  title: string;
  urls: string[];
} {
  const title = albumTitleFromHtml(html);
  const pw = collectUrls(html, /https:\/\/lh3\.googleusercontent\.com\/pw\/[A-Za-z0-9_\-]+/g);
  if (pw.length) return { title, urls: pw };
  return {
    title,
    urls: collectUrls(html, /https:\/\/lh3\.googleusercontent\.com\/[A-Za-z0-9_\-]{24,}/g),
  };
}

function albumTitleFromHtml(html: string): string {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  const title = html.match(/<title>([^<]+)<\/title>/i);
  const raw = decodeBasicEntities(og?.[1] || title?.[1] || "Google Photos");
  return raw.replace(/\s*[–-]\s*Google Photos\s*$/i, "").trim() || "Google Photos";
}

function collectUrls(html: string, pattern: RegExp): string[] {
  const found = new Set<string>();
  for (const match of html.matchAll(pattern)) {
    const raw = unescapeGooglePhotoUrl(match[0]);
    if (raw.length < 40) continue;
    found.add(sizedGooglePhotoUrl(raw));
  }
  return [...found];
}

function decodeBasicEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

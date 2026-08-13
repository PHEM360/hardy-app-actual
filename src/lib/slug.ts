/** Lowercase letters, numbers, hyphens only — keeps friendly URLs clean and predictable. */
export function normalizeSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Short random slug used as the default identifier before a friendly one is claimed. */
export function randomSlug(): string {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 5);
}

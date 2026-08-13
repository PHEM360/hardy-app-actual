/**
 * Canonical public base URL for this app. Anything that encodes a link meant
 * to be scanned/opened outside the current tab (QR codes, printed tags,
 * shared links) must use this instead of `window.location.origin` — the
 * origin is whatever the browser happens to be on, which is localhost during
 * `npm run dev` and would otherwise get baked permanently into a printed QR
 * code. Falls back to the current origin when VITE_APP_BASE_URL isn't set
 * (i.e. in dev), so local testing still opens locally.
 */
export const APP_BASE_URL: string = import.meta.env.VITE_APP_BASE_URL ?? window.location.origin;

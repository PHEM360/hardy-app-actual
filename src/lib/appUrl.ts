/**
 * Canonical public base URL for this app. Anything that encodes a link meant
 * to be scanned/opened outside the current tab (QR codes, printed tags,
 * shared links) must use this instead of `window.location.origin` — the
 * origin is whatever the browser happens to be on, which is localhost during
 * `npm run dev` and would otherwise get baked permanently into a printed QR
 * code or a claimed friendly URL. Set in `.env` (loaded in every mode, dev
 * included) so a link claimed while running the dev server is just as real
 * and scannable as one claimed in production — a dog tag QR code is a
 * physical artifact meant to work immediately, not something worth testing
 * against a throwaway local address. The `window.location.origin` fallback
 * only matters if `.env` is ever missing entirely.
 */
export const APP_BASE_URL: string = import.meta.env.VITE_APP_BASE_URL ?? window.location.origin;

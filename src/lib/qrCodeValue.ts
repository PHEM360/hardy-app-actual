import type { QRCodeItem } from "@/types/app";
import { APP_BASE_URL } from "@/lib/appUrl";

/**
 * The actual string a QR code image should encode for a saved item. URL-type
 * codes (not `sendLocation`) route through hardyapp.co.uk/l/:slug once saved,
 * so the destination can change later without needing to reprint — every
 * other content type already stores its final encodable value directly in
 * `content` (a `tel:` URI, plain text, an image URL). Every render site
 * (generator preview, print/export, library card, label designer) must use
 * this instead of reading `item.content` directly.
 */
export function qrCodeValue(item: QRCodeItem): string {
  if (item.contentType === "url" && !item.sendLocation && item.slug) {
    return `${APP_BASE_URL}/l/${item.slug}`;
  }
  return item.content || " ";
}

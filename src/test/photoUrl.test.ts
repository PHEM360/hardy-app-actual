import { describe, expect, it, vi } from "vitest";
import { rewritePhotoProxyUrl } from "@/lib/photoUrl";
import { isNativeApp } from "@/lib/nativeApp";

vi.mock("@/lib/nativeApp", async () => {
  const actual = await vi.importActual<typeof import("@/lib/nativeApp")>("@/lib/nativeApp");
  return {
    ...actual,
    isNativeApp: vi.fn(() => false),
  };
});

describe("photo proxy urls", () => {
  it("rewrites Drive and Google Photos proxies onto the current origin", () => {
    vi.mocked(isNativeApp).mockReturnValue(false);
    const origin = window.location.origin;
    expect(rewritePhotoProxyUrl("https://hardyhub-7b30d.web.app/api/drive-photo?o=u&f=f&t=t"))
      .toBe(`${origin}/api/drive-photo?o=u&f=f&t=t`);
    expect(rewritePhotoProxyUrl("https://hardyhub-7b30d.web.app/api/gphotos-photo?o=u&f=f&t=t"))
      .toBe(`${origin}/api/gphotos-photo?o=u&f=f&t=t`);
    expect(rewritePhotoProxyUrl("https://firebasestorage.googleapis.com/v0/b/bucket/o/a.jpg"))
      .toBe("https://firebasestorage.googleapis.com/v0/b/bucket/o/a.jpg");
  });

  it("sends native photo proxies to Firebase Hosting so Capacitor does not swallow /api", () => {
    vi.mocked(isNativeApp).mockReturnValue(true);
    expect(rewritePhotoProxyUrl("https://hardyapp.co.uk/api/drive-photo?o=u&f=f&t=t"))
      .toBe("https://hardyhub-7b30d.web.app/api/drive-photo?o=u&f=f&t=t");
  });
});

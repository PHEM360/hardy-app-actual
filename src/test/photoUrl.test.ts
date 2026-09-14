import { describe, expect, it } from "vitest";
import { rewritePhotoProxyUrl } from "@/lib/photoUrl";

describe("photo proxy urls", () => {
  it("rewrites Drive and Google Photos proxies onto the current origin", () => {
    const origin = window.location.origin;
    expect(rewritePhotoProxyUrl("https://hardyhub-7b30d.web.app/api/drive-photo?o=u&f=f&t=t"))
      .toBe(`${origin}/api/drive-photo?o=u&f=f&t=t`);
    expect(rewritePhotoProxyUrl("https://hardyhub-7b30d.web.app/api/gphotos-photo?o=u&f=f&t=t"))
      .toBe(`${origin}/api/gphotos-photo?o=u&f=f&t=t`);
    expect(rewritePhotoProxyUrl("https://firebasestorage.googleapis.com/v0/b/bucket/o/a.jpg"))
      .toBe("https://firebasestorage.googleapis.com/v0/b/bucket/o/a.jpg");
  });
});

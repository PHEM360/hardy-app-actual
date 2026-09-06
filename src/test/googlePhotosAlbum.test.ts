import { describe, expect, it } from "vitest";
import {
  extractGooglePhotosFromHtml,
  googlePhotosMediaId,
  isGooglePhotosShareUrl,
  sizedGooglePhotoUrl,
} from "@/lib/googlePhotosAlbum";

describe("Google Photos album links", () => {
  it("accepts short and full shared album URLs", () => {
    expect(isGooglePhotosShareUrl("https://photos.app.goo.gl/FamilyHoliday")).toBe(true);
    expect(isGooglePhotosShareUrl("https://photos.google.com/share/AF1QipExample?key=abc")).toBe(true);
    expect(isGooglePhotosShareUrl("https://photos.google.com/u/0/album/AF1QipExample")).toBe(true);
    expect(isGooglePhotosShareUrl("https://drive.google.com/drive/folders/xyz")).toBe(false);
  });

  it("pulls album pictures out of a shared page", () => {
    const html = `
      <title>Mum’s holiday - Google Photos</title>
      <script>window.AF=["https://lh3.googleusercontent.com/pw/AP1GczFamilyOne","https://lh3.googleusercontent.com/pw/AP1GczFamilyTwo"]</script>
    `;
    expect(extractGooglePhotosFromHtml(html)).toEqual({
      title: "Mum’s holiday",
      urls: [
        "https://lh3.googleusercontent.com/pw/AP1GczFamilyOne=w1600",
        "https://lh3.googleusercontent.com/pw/AP1GczFamilyTwo=w1600",
      ],
    });
    expect(googlePhotosMediaId("https://lh3.googleusercontent.com/pw/AP1GczFamilyOne=w1600")).toBe("AP1GczFamilyOne");
    expect(sizedGooglePhotoUrl("https://lh3.googleusercontent.com/pw/AP1GczFamilyOne")).toBe(
      "https://lh3.googleusercontent.com/pw/AP1GczFamilyOne=w1600",
    );
  });
});

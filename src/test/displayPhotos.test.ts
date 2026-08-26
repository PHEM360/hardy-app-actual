import { describe, expect, it } from "vitest";
import {
  displayPhotoSrcFromLink,
  isGoogleDriveFolderUrl,
  parseDisplayPhotoLinks,
  visibleDisplayPhotos,
} from "@/lib/displayPhotos";

describe("display photo links", () => {
  it("turns a Drive file share link into a viewable image URL", () => {
    expect(displayPhotoSrcFromLink("https://drive.google.com/file/d/abc123XYZ/view?usp=sharing"))
      .toBe("https://drive.google.com/uc?export=view&id=abc123XYZ");
    expect(displayPhotoSrcFromLink("https://photos.example.com/holiday.jpg"))
      .toBe("https://photos.example.com/holiday.jpg");
  });

  it("rejects folders and local addresses so they are not treated as photos", () => {
    expect(isGoogleDriveFolderUrl("https://drive.google.com/drive/folders/xyz")).toBe(true);
    expect(displayPhotoSrcFromLink("https://drive.google.com/drive/folders/xyz")).toBeNull();
    expect(displayPhotoSrcFromLink("http://localhost/secret.jpg")).toBeNull();
  });

  it("collects several pasted links and counts Drive folders separately", () => {
    expect(parseDisplayPhotoLinks(`
      https://drive.google.com/file/d/aaa/view
      https://drive.google.com/drive/folders/house
      not-a-url
      https://cdn.example.com/one.jpg
    `)).toEqual({
      urls: [
        "https://drive.google.com/uc?export=view&id=aaa",
        "https://cdn.example.com/one.jpg",
      ],
      folderCount: 1,
      skippedCount: 1,
    });
  });

  it("drops photos that never received a usable URL", () => {
    expect(visibleDisplayPhotos([
      { id: "ok", url: "https://cdn.example.com/one.jpg" },
      { id: "blank", url: "" },
    ]).map((photo) => photo.id)).toEqual(["ok"]);
  });
});

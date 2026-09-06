import { describe, expect, it } from "vitest";
import { albumLibraryKey, photoLibraryKey, resolveDisplayPhotos, snapshotPhotoRefs } from "@/lib/photoSelection";

const photos = [
  { id: "a", ownerId: "chris", albumId: "hols", url: "https://img/a.jpg", caption: "A" },
  { id: "b", ownerId: "chris", albumId: "hols", url: "https://img/b.jpg", caption: "B" },
  { id: "c", ownerId: "sarah", albumId: "mums", url: "https://img/c.jpg", caption: "C" },
];

describe("photo selection for displays", () => {
  it("uses explicit photo refs first so shared albums still show", () => {
    const picked = resolveDisplayPhotos(photos, {
      photoRefs: [{ id: "sarah:c", url: "https://img/c.jpg", caption: "C" }],
    });
    expect(picked.map((photo) => photo.id)).toEqual(["c"]);
  });

  it("filters to selected albums then selected pictures", () => {
    const inAlbum = resolveDisplayPhotos(photos, { photoAlbumIds: ["chris:hols"] });
    expect(inAlbum.map((photo) => photo.id)).toEqual(["a", "b"]);
    const subset = resolveDisplayPhotos(photos, { photoAlbumIds: ["chris:hols"], photoIds: ["chris:b"] });
    expect(subset.map((photo) => photo.id)).toEqual(["b"]);
  });

  it("snapshots stable keys for the display", () => {
    expect(photoLibraryKey(photos[0])).toBe("chris:a");
    expect(albumLibraryKey({ id: "hols", ownerId: "chris" })).toBe("chris:hols");
    expect(snapshotPhotoRefs([photos[0]])).toEqual([{ id: "chris:a", url: "https://img/a.jpg", caption: "A" }]);
  });
});

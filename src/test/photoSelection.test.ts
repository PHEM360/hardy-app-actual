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

  it("resolves albums live rather than freezing on stale photo refs", () => {
    // A widget that was set up via the album picker carries both live
    // album/photo ids AND (previously) a frozen url snapshot. The live ids
    // must win, or a photo removed from the album keeps "working" from a
    // stale cached url, and one added never appears.
    const stalePick = {
      photoAlbumIds: ["chris:hols"],
      photoRefs: [{ id: "sarah:c", url: "https://img/c.jpg", caption: "C" }],
    };
    expect(resolveDisplayPhotos(photos, stalePick).map((photo) => photo.id)).toEqual(["a", "b"]);
  });

  it("shows nothing when nothing has been picked yet, instead of every photo", () => {
    expect(resolveDisplayPhotos(photos, {})).toEqual([]);
  });

  it("snapshots stable keys for the display", () => {
    expect(photoLibraryKey(photos[0])).toBe("chris:a");
    expect(albumLibraryKey({ id: "hols", ownerId: "chris" })).toBe("chris:hols");
    expect(snapshotPhotoRefs([photos[0]])).toEqual([{ id: "chris:a", url: "https://img/a.jpg", caption: "A" }]);
  });
});

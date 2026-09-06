import { describe, expect, it } from "vitest";
import { LANDING_PAGE_OPTIONS } from "@/lib/defaultLanding";
import { photosForDisplayWidget } from "@/lib/displayPhotos";
import { createDisplayWidget } from "@/lib/displayPages";

describe("default landing options", () => {
  it("lists Today, Home, then Tasks first", () => {
    expect(LANDING_PAGE_OPTIONS.slice(0, 3).map((o) => o.path)).toEqual([
      "/today",
      "/dashboard",
      "/tasks",
    ]);
  });
});

describe("photosForDisplayWidget", () => {
  const library = { id: "lib1", url: "https://x/a.jpg" };
  const albumA = { id: "album:a:1", url: "https://x/b.jpg", albumId: "a" };
  const albumB = { id: "album:b:1", url: "https://x/c.jpg", albumId: "b" };
  const photos = [library, albumA, albumB];

  it("defaults to library photos when nothing is selected", () => {
    expect(photosForDisplayWidget(photos, {})).toEqual([library]);
  });

  it("filters to selected albums", () => {
    expect(photosForDisplayWidget(photos, { albumIds: ["b"] })).toEqual([albumB]);
  });

  it("unions selected library photo ids and albums", () => {
    expect(photosForDisplayWidget(photos, { photoIds: ["lib1"], albumIds: ["a"] })).toEqual([
      library,
      albumA,
    ]);
  });
});

describe("createDisplayWidget photos", () => {
  it("initialises albumIds", () => {
    expect(createDisplayWidget("photos").albumIds).toEqual([]);
  });
});

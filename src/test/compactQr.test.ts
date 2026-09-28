import { describe, expect, it } from "vitest";
import { compactQrModules, qrModulesToPath } from "@/lib/compactQr";
import { publicTagUrl, tagQrValue } from "@/components/pets/DogTagFace";

const tagLink = { shortCode: "K7M2QX9", slug: "billy", petId: "AbCdEfGhIjKlMnOpQrSt", id: "UvWxYzAbCdEfGhIjKlMn", code: "abcdefgh1234" };

describe("compactQrModules", () => {
  it("fits an uppercase short tag link in a 25x25 grid", () => {
    expect(compactQrModules("HTTPS://HARDYAPP.CO.UK/T/K7M2QX9")).toHaveLength(25);
  });

  it("still encodes mixed case text via byte mode", () => {
    expect(compactQrModules("https://hardyapp.co.uk/tag/AbCdEfGhIjKlMnOpQrSt/UvWxYzAbCdEfGhIjKlMn?c=abcdefgh1234")).toHaveLength(37);
  });
});

describe("qrModulesToPath", () => {
  it("merges horizontal runs into one rectangle each", () => {
    expect(qrModulesToPath([[true, true, false, true]])).toBe("M0 0h2v1h-2zM3 0h1v1h-1z");
  });
});

describe("tag links", () => {
  it("prefers the short link and uppercases it only for the QR", () => {
    expect(publicTagUrl(tagLink)).toMatch(/\/t\/K7M2QX9$/);
    expect(tagQrValue(tagLink)).toBe(publicTagUrl(tagLink).toUpperCase());
  });

  it("falls back to the slug, then the long link, when there is no short code", () => {
    expect(publicTagUrl({ ...tagLink, shortCode: "" })).toMatch(/\/p\/billy$/);
    expect(publicTagUrl({ ...tagLink, shortCode: "", slug: "" })).toMatch(/\/tag\/AbCdEfGhIjKlMnOpQrSt\/UvWxYzAbCdEfGhIjKlMn\?c=abcdefgh1234$/);
  });
});

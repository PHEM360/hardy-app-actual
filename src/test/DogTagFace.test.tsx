import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TagFace } from "@/components/pets/DogTagFace";
import { DEFAULT_TAG_PROFILE, type DogTag } from "@/hooks/useDogTags";

vi.mock("react-qr-code", () => ({
  default: () => <div data-testid="qr" />,
}));

function tag(partial: Partial<DogTag> = {}): DogTag {
  return {
    id: "tag-1",
    petId: "pet-1",
    ownerId: "owner",
    label: "Collar tag",
    code: "abc",
    slug: "billy",
    shape: "rounded",
    bgColor: "#ffffff",
    fgColor: "#000000",
    stickerText: "Billy",
    sizeCm: 3.5,
    qrSizeCm: 1.8,
    stickerTextSizeCm: 0.35,
    backText: "",
    backTextSizeCm: 0.4,
    profile: DEFAULT_TAG_PROFILE,
    lastScanLocation: null,
    notifyEmails: [],
    notifyUids: [],
    ...partial,
  };
}

describe("TagFace", () => {
  it("does not invent back text when the back box is empty", () => {
    render(<TagFace tag={tag({ backText: "   " })} side="back" pxPerCm={40} />);
    expect(screen.queryByText(/IF FOUND/i)).toBeNull();
    expect(screen.queryByText(/Please scan/i)).toBeNull();
  });

  it("shows the back text that was entered", () => {
    render(<TagFace tag={tag({ backText: "Call Chris" })} side="back" pxPerCm={40} />);
    expect(screen.getByText("Call Chris")).toBeTruthy();
  });
});

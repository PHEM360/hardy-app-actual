import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DogTagPrintDialog } from "@/components/pets/DogTagPrintDialog";
import { DEFAULT_TAG_PROFILE, type DogTag } from "@/hooks/useDogTags";
import type { Pet } from "@/hooks/usePets";

vi.mock("react-qr-code", () => ({
  default: () => <div data-testid="qr" />,
}));

function pet(partial: Partial<Pet> & Pick<Pet, "id" | "name">): Pet {
  return {
    breed: "Labrador",
    birthday: "2020-01-01",
    avatar: "🐶",
    ownerId: "owner",
    sharedWith: [],
    fleaOptions: [],
    wormOptions: [],
    vaccinationOptions: [],
    selectedFlea: "",
    selectedWorm: "",
    treatmentNotes: "",
    weightHistory: [],
    treatmentHistory: [],
    fleaNotifications: [],
    wormNotifications: [],
    insurance: {
      provider: "",
      policyNumber: "",
      renewalDate: "2027-01-01",
      monthlyPremium: 0,
      coverLevel: "",
      excess: 0,
    },
    ...partial,
  };
}

function tag(partial: Partial<DogTag> & Pick<DogTag, "id" | "petId" | "label">): DogTag {
  return {
    ownerId: "owner",
    code: "abc",
    slug: "",
    shape: "rounded",
    bgColor: "#ffffff",
    fgColor: "#000000",
    stickerText: partial.label,
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

describe("DogTagPrintDialog", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.stubGlobal("print", vi.fn());
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  it("lets you pick tags from more than one pet and print them together", () => {
    const billy = pet({ id: "p1", name: "Billy" });
    const luna = pet({ id: "p2", name: "Luna" });
    render(
      <DogTagPrintDialog
        open
        onClose={() => {}}
        pets={[billy, luna]}
        tagsByPet={{
          p1: [tag({ id: "t1", petId: "p1", label: "Collar tag" })],
          p2: [tag({ id: "t2", petId: "p2", label: "Harness tag" })],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip 4 cm" }));
    expect(screen.getByText("4.0 cm")).toBeTruthy();

    fireEvent.click(screen.getByRole("checkbox", { name: "Print Billy Collar tag" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Print Luna Harness tag" }));
    fireEvent.click(screen.getByRole("button", { name: /Print 4 stickers/ }));
    expect(window.print).toHaveBeenCalled();
  });

  it("places the first sticker by tapping the A4 preview", () => {
    const billy = pet({ id: "p1", name: "Billy" });
    render(
      <DogTagPrintDialog
        open
        onClose={() => {}}
        pets={[billy]}
        tagsByPet={{ p1: [tag({ id: "t1", petId: "p1", label: "Collar tag" })] }}
        preselectedKeys={["p1/t1"]}
      />,
    );

    const preview = screen.getByRole("button", { name: "Choose where the first sticker starts" });
    Object.defineProperty(preview, "getBoundingClientRect", {
      value: () => ({ left: 0, top: 0, width: 210, height: 297, right: 210, bottom: 297 }),
    });
    fireEvent.click(preview, { clientX: 21, clientY: 42 });
    expect(screen.getByText("4.2 cm")).toBeTruthy();
    expect(screen.getByText("2.1 cm")).toBeTruthy();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PetsShareButton } from "@/components/pets/PetsShareButton";
import type { Pet } from "@/hooks/usePets";

vi.mock("@/auth/AuthContext", () => ({
  useAuth: () => ({ dataUid: "owner" }),
}));

vi.mock("@/hooks/useAppUsers", () => ({
  useAppUsers: () => [
    { id: "owner", name: "Chris", email: "chris@example.com" },
    { id: "sitter", name: "Sam", email: "sam@example.com" },
  ],
}));

vi.mock("@/hooks/usePageShares", () => ({
  usePageShares: () => ({
    mine: [],
    shareWith: vi.fn(),
    updatePermission: vi.fn(),
    revoke: vi.fn(),
  }),
}));

function pet(partial: Partial<Pet> & Pick<Pet, "id" | "name">): Pet {
  return {
    breed: "",
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

describe("PetsShareButton", () => {
  beforeEach(() => {
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  it("lets you share the whole page or only selected pets", async () => {
    const sharePet = vi.fn().mockResolvedValue(undefined);
    render(
      <PetsShareButton
        pets={[pet({ id: "billy", name: "Billy" }), pet({ id: "luna", name: "Luna" })]}
        sharePet={sharePet}
        unsharePet={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    expect(screen.getByRole("button", { name: /Whole Pets page/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Specific pets/ }));
    fireEvent.click(screen.getByText("Billy"));
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.click(screen.getByText("Sam"));
    fireEvent.click(screen.getByRole("button", { name: "Share access" }));
    await waitFor(() => expect(sharePet).toHaveBeenCalledWith("billy", "sitter"));
  });
});

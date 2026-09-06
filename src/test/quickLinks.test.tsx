import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ALL_LINKS } from "@/components/widgets/QuickLinksWidget";
import Email from "@/pages/Email";

vi.mock("@/hooks/useSharedScope", () => ({
  useSharedScope: () => ({
    scopeUserId: "me",
    permission: "edit",
    pageTitle: "Email",
    isOwnScope: true,
    availableScopes: [],
    setScopeUserId: () => undefined,
    loading: false,
    scopeName: "Me",
  }),
}));

vi.mock("@/hooks/useMail", () => ({
  useMail: () => ({
    accounts: [],
    messages: [],
    settings: { instructions: "Keep personal and work mail easy to find.", autoClassify: true },
    aiResult: null,
    loading: false,
    unreadCount: 0,
    saveInstructions: vi.fn(),
    patchMessage: vi.fn(),
  }),
}));

vi.mock("@/components/sharing/PageShareBar", () => ({
  default: () => null,
}));

describe("quick links", () => {
  it("opens a new note the same way Notes → New note does", () => {
    const note = ALL_LINKS.find((link) => link.id === "note");
    expect(note).toMatchObject({ href: "/notes?new=1" });
  });

  it("sends Email to the mailbox page", () => {
    const email = ALL_LINKS.find((link) => link.id === "email");
    expect(email).toMatchObject({ label: "Email", href: "/email" });
  });
});

describe("Email mailbox", () => {
  it("asks you to connect an account when the mailbox is empty", () => {
    render(
      <MemoryRouter>
        <Email />
      </MemoryRouter>,
    );
    expect(screen.getByText("Add your first mailbox")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Email" })).toBeInTheDocument();
  });
});

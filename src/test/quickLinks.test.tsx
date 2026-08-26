import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ALL_LINKS } from "@/components/widgets/QuickLinksWidget";
import Email from "@/pages/Email";

describe("quick links", () => {
  it("opens a new note the same way Notes → New note does", () => {
    const note = ALL_LINKS.find((link) => link.id === "note");
    expect(note).toMatchObject({ href: "/notes?new=1" });
  });

  it("sends Email to the placeholder page", () => {
    const email = ALL_LINKS.find((link) => link.id === "email");
    expect(email).toMatchObject({ label: "Email", href: "/email" });
  });
});

describe("Email placeholder", () => {
  it("shows a not-just-yet page", () => {
    render(
      <MemoryRouter>
        <Email />
      </MemoryRouter>,
    );
    expect(screen.getByText("Not just yet")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Email" })).toBeInTheDocument();
  });
});

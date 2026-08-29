import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { HomeLayoutChooser } from "@/components/home/HomeLayoutChooser";

describe("HomeLayoutChooser", () => {
  it("lets the user pick Today or Tiles", () => {
    const onChoose = vi.fn();
    render(<HomeLayoutChooser onChoose={onChoose} />);
    fireEvent.click(screen.getByRole("button", { name: /Today/i }));
    expect(onChoose).toHaveBeenCalledWith("today");
    fireEvent.click(screen.getByRole("button", { name: /Tiles/i }));
    expect(onChoose).toHaveBeenCalledWith("tiles");
  });
});

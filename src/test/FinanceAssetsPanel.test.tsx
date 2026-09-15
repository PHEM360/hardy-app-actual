import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FinanceAssetsPanel } from "@/components/finance/FinanceAssetsPanel";

describe("FinanceAssetsPanel", () => {
  it("shows net income and yield for a let property", () => {
    render(
      <FinanceAssetsPanel
        assets={[
          {
            id: "1",
            kind: "property",
            name: "Let flat",
            value: 360_000,
            rentMonthly: 1_800,
            expensesMonthly: 300,
            primaryResidence: false,
            growthAssumptionPct: 2.5,
          },
        ]}
        canEdit
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Let flat")).toBeInTheDocument();
    expect(screen.getByText("£18,000.00 / yr")).toBeInTheDocument();
    expect(screen.getByText("5.0%")).toBeInTheDocument();
    expect(screen.getByText("2.5% assumed growth")).toBeInTheDocument();
  });

  it("opens add property with value, rent, costs, growth and primary home", () => {
    render(
      <FinanceAssetsPanel
        assets={[]}
        canEdit
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Add property" }));
    expect(screen.getByLabelText("Current value (£)")).toBeInTheDocument();
    expect(screen.getByLabelText("Monthly rent (£)")).toBeInTheDocument();
    expect(screen.getByLabelText("Monthly costs (£)")).toBeInTheDocument();
    expect(screen.getByLabelText("Assumed annual growth (%)")).toBeInTheDocument();
    expect(screen.getByText("This is our primary home")).toBeInTheDocument();
  });
});

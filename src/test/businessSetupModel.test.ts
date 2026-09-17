import { describe, expect, it } from "vitest";
import {
  defaultBusinessSetup,
  mergeBusinessSetup,
  newCostItem,
  newIncomeStream,
  projectBusinessSetup,
} from "@/lib/businessSetupModel";

describe("business setup modeller", () => {
  it("applies start-up costs only in year 1 and carries a break-even year forward", () => {
    const setup = defaultBusinessSetup("Test co");
    setup.years = 3;
    setup.taxRatePercent = 0;
    setup.startupCosts = [newCostItem("Kit", 1000)];
    setup.ongoingCosts = [newCostItem("Rent", 1200)];
    setup.incomeStreams = [{ ...newIncomeStream("Sales"), amount: 2000, growthMode: "rate", growthRatePercent: 0 }];

    const projection = projectBusinessSetup(setup);
    expect(projection.years).toHaveLength(3);
    expect(projection.years[0].startupCosts).toBe(1000);
    expect(projection.years[1].startupCosts).toBe(0);
    expect(projection.years[0].netProfit).toBe(2000 - 1200 - 1000);
    expect(projection.years[1].netProfit).toBe(2000 - 1200);
    // Cumulative cash: -200 after year 1, +600 after year 2 -> break-even year 2.
    expect(projection.breakEvenYear).toBe(2);
    expect(projection.peakFundingNeeded).toBe(200);
  });

  it("compounds a rate-based income stream and respects an optional cap", () => {
    const setup = defaultBusinessSetup("Growth co");
    setup.years = 4;
    setup.incomeStreams = [
      { ...newIncomeStream("Subscriptions"), amount: 1000, growthMode: "rate", growthRatePercent: 100, maxAnnualAmount: 3000 },
    ];
    const projection = projectBusinessSetup(setup);
    expect(projection.years[0].revenue).toBe(1000);
    expect(projection.years[1].revenue).toBe(2000);
    // Would be 4000 uncapped; capped at 3000.
    expect(projection.years[2].revenue).toBe(3000);
    expect(projection.years[3].revenue).toBe(3000);
  });

  it("linearly ramps a toMax income stream up to its cap and then holds flat", () => {
    const setup = defaultBusinessSetup("Ramp co");
    setup.years = 5;
    setup.incomeStreams = [
      { ...newIncomeStream("Clients"), amount: 0, growthMode: "toMax", maxAnnualAmount: 4000, yearsToMax: 3 },
    ];
    const projection = projectBusinessSetup(setup);
    expect(projection.years[0].revenue).toBe(0);
    expect(projection.years[1].revenue).toBe(2000);
    expect(projection.years[2].revenue).toBe(4000);
    expect(projection.years[3].revenue).toBe(4000);
    expect(projection.years[4].revenue).toBe(4000);
  });

  it("supports flat, rate and manual ongoing-cost growth modes", () => {
    const flat = defaultBusinessSetup("Flat");
    flat.years = 3;
    flat.ongoingCosts = [newCostItem("Costs", 1000)];
    flat.expenseGrowth = { mode: "flat", ratePercent: 20, manualByYear: [] };
    const flatProjection = projectBusinessSetup(flat);
    expect(flatProjection.years.map((y) => y.ongoingCosts)).toEqual([1000, 1000, 1000]);

    const rate = { ...flat, expenseGrowth: { mode: "rate" as const, ratePercent: 10, manualByYear: [] } };
    const rateProjection = projectBusinessSetup(rate);
    expect(rateProjection.years.map((y) => y.ongoingCosts)).toEqual([1000, 1100, 1210]);

    const manual = { ...flat, expenseGrowth: { mode: "manual" as const, ratePercent: 0, manualByYear: [500, 1500] } };
    const manualProjection = projectBusinessSetup(manual);
    // Year 3 has no manual override supplied, so it falls back to the baseline.
    expect(manualProjection.years.map((y) => y.ongoingCosts)).toEqual([500, 1500, 1000]);
  });

  it("never lets tax go negative when the plan runs at a loss", () => {
    const setup = defaultBusinessSetup("Loss co");
    setup.years = 1;
    setup.taxRatePercent = 20;
    setup.ongoingCosts = [newCostItem("Costs", 5000)];
    setup.incomeStreams = [{ ...newIncomeStream("Sales"), amount: 1000 }];
    const projection = projectBusinessSetup(setup);
    expect(projection.years[0].tax).toBe(0);
    expect(projection.years[0].netProfit).toBe(-4000);
  });

  it("defensively merges partial/malformed Firestore data back into a valid shape", () => {
    const merged = mergeBusinessSetup({
      name: "Recovered",
      years: 99,
      startupCosts: [{ id: "a", name: "Kit", amount: "500" as unknown as number }, { id: "b", name: "", amount: 10 }],
      incomeStreams: "not-an-array" as unknown as never,
      expenseGrowth: { mode: "bogus" as unknown as "flat", ratePercent: "abc" as unknown as number, manualByYear: [] },
    });
    expect(merged.years).toBe(10); // clamped to the 1-10 range
    expect(merged.startupCosts).toEqual([{ id: "a", name: "Kit", amount: 500 }]); // blank-named item dropped
    expect(merged.incomeStreams).toMatchObject(defaultBusinessSetup().incomeStreams.map(({ id: _id, ...rest }) => rest));
    expect(merged.expenseGrowth.mode).toBe("flat");
    expect(merged.expenseGrowth.ratePercent).toBe(5);
  });
});

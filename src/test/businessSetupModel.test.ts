import { describe, expect, it } from "vitest";
import {
  defaultBusinessSetup,
  mergeBusinessSetup,
  monthlyCashFlowYearOne,
  newCostItem,
  newIncomeStream,
  newStaffRole,
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
      startupCosts: [
        { id: "a", name: "Kit", amount: "500" as unknown as number },
        { id: "b", name: "", amount: 10 },
        { id: "c", name: "", amount: 0 },
      ],
      incomeStreams: "not-an-array" as unknown as never,
      expenseGrowth: { mode: "bogus" as unknown as "flat", ratePercent: "abc" as unknown as number, manualByYear: [] },
    });
    expect(merged.years).toBe(10); // clamped to the 1-10 range
    // A completely empty row is dropped; an unnamed row with an amount is kept,
    // because the projection counts it.
    expect(merged.startupCosts).toEqual([{ id: "a", name: "Kit", amount: 500 }, { id: "b", name: "", amount: 10 }]);
    expect(merged.costOfSalesPercent).toBe(0);
    expect(merged.funding).toEqual({ ownerInvestment: 0, loanAmount: 0, loanInterestPercent: 8, loanTermYears: 5 });
    expect(merged.incomeStreams).toMatchObject(defaultBusinessSetup().incomeStreams.map(({ id: _id, ...rest }) => rest));
    expect(merged.expenseGrowth.mode).toBe("flat");
    expect(merged.expenseGrowth.ratePercent).toBe(5);
  });

  it("models income year by year, carrying the last entered figure into blank years", () => {
    const setup = defaultBusinessSetup("Manual co");
    setup.years = 5;
    setup.incomeStreams = [
      { ...newIncomeStream("Sales"), amount: 999, growthMode: "manual", manualByYear: [10000, null, 30000, null, 0] },
    ];
    const projection = projectBusinessSetup(setup);
    // Year 2 is blank so it repeats year 1; year 4 repeats year 3; an explicit 0 is respected.
    expect(projection.years.map((y) => y.revenue)).toEqual([10000, 10000, 30000, 30000, 0]);
  });

  it("uses the baseline amount for manual years before any figure is entered", () => {
    const setup = defaultBusinessSetup("Manual co");
    setup.years = 3;
    setup.incomeStreams = [{ ...newIncomeStream("Sales"), amount: 5000, growthMode: "manual", manualByYear: [null, null, 8000] }];
    expect(projectBusinessSetup(setup).years.map((y) => y.revenue)).toEqual([5000, 5000, 8000]);
  });

  it("counts an income stream that has not been named yet", () => {
    const setup = defaultBusinessSetup("Unnamed co");
    setup.years = 1;
    setup.incomeStreams = [{ ...newIncomeStream("Sales"), amount: 1000 }, { ...newIncomeStream(""), amount: 500 }];
    const projection = projectBusinessSetup(setup);
    expect(projection.years[0].revenue).toBe(1500);
    expect(projection.years[0].incomeByStream[1].name).toBe("Income stream 2");
  });

  it("starts a stream in a later year and grows it from that year", () => {
    const setup = defaultBusinessSetup("Later co");
    setup.years = 4;
    setup.incomeStreams = [{ ...newIncomeStream("Consulting"), amount: 1000, growthMode: "rate", growthRatePercent: 100, startYear: 3 }];
    expect(projectBusinessSetup(setup).years.map((y) => y.revenue)).toEqual([0, 0, 1000, 2000]);
  });

  it("takes cost of sales off revenue to give gross profit and margin", () => {
    const setup = defaultBusinessSetup("Margin co");
    setup.years = 1;
    setup.taxRatePercent = 0;
    setup.costOfSalesPercent = 40;
    setup.incomeStreams = [{ ...newIncomeStream("Sales"), amount: 10000 }];
    const projection = projectBusinessSetup(setup);
    expect(projection.years[0].costOfSales).toBe(4000);
    expect(projection.years[0].grossProfit).toBe(6000);
    expect(projection.years[0].netProfit).toBe(6000);
    expect(projection.grossMarginPercent).toBe(60);
  });

  it("uses up earlier losses before charging tax", () => {
    const setup = defaultBusinessSetup("Loss relief co");
    setup.years = 3;
    setup.taxRatePercent = 20;
    setup.startupCosts = [newCostItem("Kit", 5000)];
    setup.incomeStreams = [{ ...newIncomeStream("Sales"), amount: 2000, growthMode: "rate", growthRatePercent: 0 }];
    const projection = projectBusinessSetup(setup);
    // Year 1 loses 3000. Year 2 profit of 2000 is fully covered (1000 loss left).
    // Year 3 profit of 2000 has 1000 covered, so tax is 20% of the other 1000.
    expect(projection.years.map((y) => y.tax)).toEqual([0, 0, 200]);
    expect(projection.breakEvenYear).toBe(3);
  });

  it("does not call an empty plan break-even", () => {
    const setup = defaultBusinessSetup("Empty co");
    setup.incomeStreams = [];
    expect(projectBusinessSetup(setup).breakEvenYear).toBeNull();
  });

  it("puts funding in the bank, charges loan interest to profit and repays capital from cash", () => {
    const setup = defaultBusinessSetup("Funded co");
    setup.years = 2;
    setup.taxRatePercent = 0;
    setup.incomeStreams = [];
    setup.funding = { ownerInvestment: 1000, loanAmount: 2000, loanInterestPercent: 10, loanTermYears: 2 };
    const projection = projectBusinessSetup(setup);
    // Annuity payment on 2000 at 10% over 2 years is 1152.38 a year.
    expect(projection.years[0].loanInterest).toBe(200);
    expect(projection.years[0].loanRepayment).toBe(952);
    expect(projection.years[0].netProfit).toBe(-200);
    expect(projection.years[0].cumulativeCash).toBe(3000 - 1152);
    expect(projection.years[1].loanBalance).toBe(0);
    expect(projection.totalFunding).toBe(3000);
    // No shortfall yet: the funding covers the repayments.
    expect(projection.peakFundingNeeded).toBe(0);
  });

  it("grows an individual cost at its own rate while the rest follow the plan", () => {
    const setup = defaultBusinessSetup("Growth co");
    setup.years = 3;
    setup.ongoingCosts = [{ ...newCostItem("Rent", 1000), growthPercent: null }, { ...newCostItem("Ads", 1000), growthPercent: 100 }];
    setup.expenseGrowth = { mode: "rate", ratePercent: 10, manualByYear: [] };
    // Rent follows the plan's 10%; Ads doubles each year.
    expect(projectBusinessSetup(setup).years.map((y) => y.ongoingCosts)).toEqual([2000, 3100, 5210]);
    // With the plan set to flat, only the cost with its own rate grows.
    setup.expenseGrowth = { mode: "flat", ratePercent: 10, manualByYear: [] };
    expect(projectBusinessSetup(setup).years.map((y) => y.ongoingCosts)).toEqual([2000, 3000, 5000]);
  });

  it("pays staff from their hiring month, with on-costs and yearly pay rises", () => {
    const setup = defaultBusinessSetup("Staff co");
    setup.years = 2;
    setup.taxRatePercent = 0;
    setup.incomeStreams = [];
    setup.staffOnCostPercent = 20;
    setup.staffPayRisePercent = 10;
    // Hired in month 7 of year 1: six months of 12,000 a year, plus 20% on-costs.
    setup.staff = [{ ...newStaffRole("Barista"), annualSalary: 12000, headcount: 2, startYear: 1, startMonth: 7 }];
    const projection = projectBusinessSetup(setup);
    expect(projection.years[0].staffCosts).toBe(2 * 6000 * 1.2);
    // Full year two, with a 10% rise.
    expect(projection.years[1].staffCosts).toBe(Math.round(2 * 12000 * 1.2 * 1.1));
    expect(projection.years[0].netProfit).toBe(-14400);
  });

  it("takes VAT out of takings and gives back VAT on costs when registered", () => {
    const setup = defaultBusinessSetup("VAT co");
    setup.years = 1;
    setup.taxRatePercent = 0;
    setup.incomeStreams = [{ ...newIncomeStream("Sales"), amount: 12000 }];
    setup.ongoingCosts = [newCostItem("Rent", 6000)];
    setup.vat = { registered: true, ratePercent: 20, pricesIncludeVat: true, reclaimCostsPercent: 100 };
    const year = projectBusinessSetup(setup).years[0];
    expect(year.grossTakings).toBe(12000);
    expect(year.vatOnSales).toBe(2000);
    expect(year.revenue).toBe(10000);
    expect(year.vatReclaimed).toBe(1000);
    expect(year.ongoingCosts).toBe(5000);
    expect(year.netProfit).toBe(5000);

    // VAT added on top of prices passes straight through: sales are untouched.
    setup.vat = { ...setup.vat, pricesIncludeVat: false, reclaimCostsPercent: 0 };
    expect(projectBusinessSetup(setup).years[0].revenue).toBe(12000);
  });

  it("flags the year an unregistered business passes the VAT threshold", () => {
    const setup = defaultBusinessSetup("Threshold co");
    setup.years = 2;
    setup.incomeStreams = [{ ...newIncomeStream("Sales"), amount: 80000, growthMode: "rate", growthRatePercent: 25 }];
    expect(projectBusinessSetup(setup).years.map((y) => y.vatThresholdExceeded)).toEqual([false, true]);
  });

  it("builds a month by month bank balance for year one", () => {
    const setup = defaultBusinessSetup("Cash co");
    setup.taxRatePercent = 0;
    setup.incomeStreams = [{ ...newIncomeStream("Sales"), amount: 12000 }];
    setup.ongoingCosts = [newCostItem("Rent", 6000)];
    setup.startupCosts = [newCostItem("Kit", 3000)];
    setup.funding = { ownerInvestment: 2000, loanAmount: 0, loanInterestPercent: 0, loanTermYears: 1 };
    const flow = monthlyCashFlowYearOne(setup);
    expect(flow.months).toHaveLength(12);
    // Month 1: 2000 opening + 1000 in - 500 rent - 3000 kit.
    expect(flow.months[0]).toEqual({ month: 1, moneyIn: 1000, moneyOut: 3500, balance: -500 });
    expect(flow.lowestBalance).toBe(-500);
    expect(flow.lowestMonth).toBe(1);
    // Ends the year where the yearly projection says the bank will be.
    expect(flow.months[11].balance).toBe(projectBusinessSetup({ ...setup, years: 1 }).years[0].cumulativeCash);
  });
});

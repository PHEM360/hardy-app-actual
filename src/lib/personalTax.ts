/**
 * UK personal / landlord tax modelling helpers (illustrative — not advice).
 */

export type TaxEntityType = "personal" | "sole_trader" | "ltd_company";

export interface PersonalTaxInputs {
  taxYearLabel: string;
  entityType: TaxEntityType;
  employmentIncomeGbp: number;
  tradingProfitGbp: number;
  propertyIncomeGbp: number;
  propertyExpensesGbp: number;
  propertyFinanceCostsGbp: number;
  usePropertyAllowance: boolean;
  otherIncomeGbp: number;
  dividendsGbp: number;
  pensionContributionsGbp: number;
  giftAidGbp: number;
  personalAllowanceOverride: number | null;
  isScottish: boolean;
}

export interface ClaimHint {
  id: string;
  title: string;
  detail: string;
  typicalSavingNote: string;
  appliesTo: Array<"property" | "employment" | "trading" | "general">;
}

export interface SaBoxLine {
  schedule: string;
  box: string;
  description: string;
  amountGbp: number;
}

export interface PersonalTaxResult {
  personalAllowanceGbp: number;
  totalIncomeGbp: number;
  propertyTaxableGbp: number;
  financeCostCreditGbp: number;
  taxableIncomeGbp: number;
  incomeTaxGbp: number;
  dividendTaxGbp: number;
  corporationTaxGbp: number;
  totalTaxGbp: number;
  effectiveRatePct: number;
  bandsUsed: string[];
  claimHints: ClaimHint[];
  saBoxes: SaBoxLine[];
  strategyNotes: string[];
}

const PA_DEFAULT = 12570;
const BASIC_LIMIT = 37700;
const HIGHER_LIMIT = 125140;
const BASIC_RATE = 0.2;
const HIGHER_RATE = 0.4;
const ADDITIONAL_RATE = 0.45;
const DIV_ALLOWANCE = 500;
const DIV_BASIC = 0.0875;
const DIV_HIGHER = 0.3375;
const DIV_ADDITIONAL = 0.3935;
const PROPERTY_ALLOWANCE = 1000;
const CT_MAIN = 0.25;

export const DEFAULT_TAX_INPUTS: PersonalTaxInputs = {
  taxYearLabel: "2025-26",
  entityType: "personal",
  employmentIncomeGbp: 0,
  tradingProfitGbp: 0,
  propertyIncomeGbp: 0,
  propertyExpensesGbp: 0,
  propertyFinanceCostsGbp: 0,
  usePropertyAllowance: false,
  otherIncomeGbp: 0,
  dividendsGbp: 0,
  pensionContributionsGbp: 0,
  giftAidGbp: 0,
  personalAllowanceOverride: null,
  isScottish: false,
};

export const CLAIM_HINTS: ClaimHint[] = [
  {
    id: "property-allowance",
    title: "Property income allowance (£1,000)",
    detail:
      "If allowable expenses are under £1,000 you may be better claiming the property allowance instead of itemising.",
    typicalSavingNote: "Compare allowance vs itemised expenses each year.",
    appliesTo: ["property"],
  },
  {
    id: "repairs-vs-improvements",
    title: "Repairs vs capital improvements",
    detail:
      "Like-for-like repairs are usually allowable; improvements that add value are generally capital.",
    typicalSavingNote: "Keep invoices that show repair vs upgrade clearly.",
    appliesTo: ["property"],
  },
  {
    id: "finance-cost-restriction",
    title: "Residential finance cost restriction",
    detail:
      "Individual landlords generally get mortgage interest relief as a basic-rate tax reduction, not a full deduction.",
    typicalSavingNote: "Track interest separately from capital repayments.",
    appliesTo: ["property"],
  },
  {
    id: "letting-fees",
    title: "Agent & letting fees",
    detail: "Letting agent, inventory and tenant-find fees are typically allowable.",
    typicalSavingNote: "Import bank lines tagged letting / agency fees.",
    appliesTo: ["property"],
  },
  {
    id: "travel-property",
    title: "Travel to the property",
    detail: "Travel wholly for managing the letting can be allowable; mixed private trips need care.",
    typicalSavingNote: "Log purpose, miles and dates.",
    appliesTo: ["property"],
  },
  {
    id: "uniform-employment",
    title: "Uniforms / specialist clothing",
    detail:
      "Plain clothes are rarely allowable. Distinctive uniforms or PPE required for work may be claimable.",
    typicalSavingNote: "Keep receipts; check employer already reimbursed.",
    appliesTo: ["employment", "trading"],
  },
  {
    id: "home-office",
    title: "Working from home",
    detail: "Simplified flat rate or actual household cost share may apply for trading / some employment.",
    typicalSavingNote: "Simplified rates are often easier to defend.",
    appliesTo: ["trading", "employment"],
  },
  {
    id: "pension-relief",
    title: "Pension contributions",
    detail: "Pension payments can reduce taxable income depending on scheme type.",
    typicalSavingNote: "Model contributions before year-end.",
    appliesTo: ["general"],
  },
  {
    id: "ltd-vs-personal",
    title: "Ltd company vs personal ownership",
    detail:
      "Holding property in a company can change mortgage interest relief and dividend tax. Model both.",
    typicalSavingNote: "Use the entity toggle on this calculator.",
    appliesTo: ["property", "general"],
  },
];

function resolvePersonalAllowance(totalIncome: number, override: number | null): number {
  if (override != null && Number.isFinite(override)) return Math.max(0, override);
  if (totalIncome <= 100000) return PA_DEFAULT;
  return Math.max(0, PA_DEFAULT - Math.floor((totalIncome - 100000) / 2));
}

function taxOnNonDividend(taxable: number): { tax: number; bands: string[] } {
  const bands: string[] = [];
  let remaining = Math.max(0, taxable);
  let tax = 0;
  const basic = Math.min(remaining, BASIC_LIMIT);
  if (basic > 0) {
    tax += basic * BASIC_RATE;
    bands.push(`Basic rate ${fmt(basic)} @ 20%`);
    remaining -= basic;
  }
  const higherCap = Math.max(0, HIGHER_LIMIT - PA_DEFAULT - BASIC_LIMIT);
  const higher = Math.min(remaining, higherCap);
  if (higher > 0) {
    tax += higher * HIGHER_RATE;
    bands.push(`Higher rate ${fmt(higher)} @ 40%`);
    remaining -= higher;
  }
  if (remaining > 0) {
    tax += remaining * ADDITIONAL_RATE;
    bands.push(`Additional rate ${fmt(remaining)} @ 45%`);
  }
  return { tax, bands };
}

function taxOnDividends(dividends: number, nonDivTaxable: number): number {
  let remaining = Math.max(0, dividends);
  let tax = 0;
  remaining -= Math.min(DIV_ALLOWANCE, remaining);
  let cursor = nonDivTaxable;
  const take = (limit: number, rate: number) => {
    const room = Math.max(0, limit - cursor);
    const chunk = Math.min(remaining, room);
    tax += chunk * rate;
    remaining -= chunk;
    cursor += chunk;
  };
  take(BASIC_LIMIT, DIV_BASIC);
  take(Math.max(BASIC_LIMIT, HIGHER_LIMIT - PA_DEFAULT), DIV_HIGHER);
  if (remaining > 0) tax += remaining * DIV_ADDITIONAL;
  return tax;
}

function fmt(n: number) {
  return `£${Math.round(n).toLocaleString("en-GB")}`;
}

export function computePersonalTax(input: PersonalTaxInputs): PersonalTaxResult {
  const claimHints = CLAIM_HINTS.filter((h) => {
    if (input.propertyIncomeGbp > 0 && h.appliesTo.includes("property")) return true;
    if (input.employmentIncomeGbp > 0 && h.appliesTo.includes("employment")) return true;
    if (input.tradingProfitGbp > 0 && h.appliesTo.includes("trading")) return true;
    return h.appliesTo.includes("general");
  });
  const strategyNotes: string[] = [];

  if (input.entityType === "ltd_company") {
    const profit = Math.max(
      0,
      input.propertyIncomeGbp +
        input.tradingProfitGbp -
        input.propertyExpensesGbp -
        input.propertyFinanceCostsGbp,
    );
    const corporationTaxGbp = profit * CT_MAIN;
    const dividendTaxGbp = taxOnDividends(input.dividendsGbp, 0);
    strategyNotes.push(
      "Company profits modelled at 25% corporation tax. Salary/dividends you extract are taxed personally.",
    );
    return {
      personalAllowanceGbp: 0,
      totalIncomeGbp: profit,
      propertyTaxableGbp: profit,
      financeCostCreditGbp: 0,
      taxableIncomeGbp: profit,
      incomeTaxGbp: 0,
      dividendTaxGbp,
      corporationTaxGbp,
      totalTaxGbp: corporationTaxGbp + dividendTaxGbp,
      effectiveRatePct: profit > 0 ? ((corporationTaxGbp + dividendTaxGbp) / profit) * 100 : 0,
      bandsUsed: [`Corporation tax ${fmt(profit)} @ 25%`],
      claimHints,
      saBoxes: [
        {
          schedule: "Company CT600 (simplified)",
          box: "Profit chargeable",
          description: "Taxable company profit (model)",
          amountGbp: profit,
        },
        {
          schedule: "Company CT600 (simplified)",
          box: "Corporation tax",
          description: "Estimated CT @ 25%",
          amountGbp: corporationTaxGbp,
        },
        {
          schedule: "SA100",
          box: "Dividends from UK companies",
          description: "Personal dividends received",
          amountGbp: input.dividendsGbp,
        },
      ],
      strategyNotes,
    };
  }

  let propertyTaxableGbp = 0;
  let financeCostCreditGbp = 0;
  if (input.usePropertyAllowance) {
    propertyTaxableGbp = Math.max(0, input.propertyIncomeGbp - PROPERTY_ALLOWANCE);
    strategyNotes.push("Property allowance £1,000 applied — itemised expenses ignored.");
  } else {
    propertyTaxableGbp = Math.max(0, input.propertyIncomeGbp - input.propertyExpensesGbp);
    financeCostCreditGbp = input.propertyFinanceCostsGbp * BASIC_RATE;
    if (input.propertyExpensesGbp < PROPERTY_ALLOWANCE && input.propertyIncomeGbp > 0) {
      strategyNotes.push("Expenses are below £1,000 — compare claiming the property allowance.");
    }
  }

  const earned =
    input.employmentIncomeGbp +
    input.tradingProfitGbp +
    propertyTaxableGbp +
    input.otherIncomeGbp;
  const pa = resolvePersonalAllowance(
    earned + input.dividendsGbp,
    input.personalAllowanceOverride,
  );
  const afterPension = Math.max(0, earned - input.pensionContributionsGbp);
  const taxableNonDiv = Math.max(0, afterPension - pa);
  const { tax: incomeTaxRaw, bands } = taxOnNonDividend(taxableNonDiv);
  const incomeTaxGbp = Math.max(0, incomeTaxRaw - financeCostCreditGbp);
  const dividendTaxGbp = taxOnDividends(input.dividendsGbp, taxableNonDiv);
  const totalTaxGbp = incomeTaxGbp + dividendTaxGbp;
  const totalIncomeGbp = earned + input.dividendsGbp;

  if (input.pensionContributionsGbp > 0) {
    strategyNotes.push("Pension contributions reduce modelled taxable non-dividend income.");
  }
  if (financeCostCreditGbp > 0) {
    strategyNotes.push(
      `Finance-cost basic-rate reduction of ${fmt(financeCostCreditGbp)} applied.`,
    );
  }
  if (input.entityType === "sole_trader" && input.tradingProfitGbp > 0) {
    strategyNotes.push("Sole-trader trading profit is included with other income (SA103-style).");
  }

  const saBoxes: SaBoxLine[] = [
    {
      schedule: "SA105 UK property",
      box: "Total rents and other income",
      description: "Gross property income",
      amountGbp: input.propertyIncomeGbp,
    },
    {
      schedule: "SA105 UK property",
      box: "Property expenses",
      description: input.usePropertyAllowance ? "Using allowance" : "Allowable expenses",
      amountGbp: input.usePropertyAllowance ? 0 : input.propertyExpensesGbp,
    },
    {
      schedule: "SA105 UK property",
      box: "Residential finance costs",
      description: "Mortgage interest for credit",
      amountGbp: input.propertyFinanceCostsGbp,
    },
    {
      schedule: "SA105 UK property",
      box: "Adjusted profit",
      description: "Taxable property profit (model)",
      amountGbp: propertyTaxableGbp,
    },
    {
      schedule: "SA102 Employment",
      box: "Pay from all employments",
      description: "Employment income",
      amountGbp: input.employmentIncomeGbp,
    },
    {
      schedule: "SA103 Self-employment",
      box: "Net business profit",
      description: "Trading profit",
      amountGbp: input.tradingProfitGbp,
    },
    {
      schedule: "SA100",
      box: "Dividends from UK companies",
      description: "Dividend income",
      amountGbp: input.dividendsGbp,
    },
    {
      schedule: "SA100",
      box: "Income tax due (model)",
      description: "Estimated income tax after finance-cost credit",
      amountGbp: incomeTaxGbp,
    },
    {
      schedule: "SA100",
      box: "Dividend tax due (model)",
      description: "Estimated tax on dividends",
      amountGbp: dividendTaxGbp,
    },
  ];

  return {
    personalAllowanceGbp: pa,
    totalIncomeGbp,
    propertyTaxableGbp,
    financeCostCreditGbp,
    taxableIncomeGbp: taxableNonDiv + input.dividendsGbp,
    incomeTaxGbp,
    dividendTaxGbp,
    corporationTaxGbp: 0,
    totalTaxGbp,
    effectiveRatePct: totalIncomeGbp > 0 ? (totalTaxGbp / totalIncomeGbp) * 100 : 0,
    bandsUsed: bands,
    claimHints,
    saBoxes: saBoxes.filter((b) => b.amountGbp !== 0 || /expenses|finance/i.test(b.box)),
    strategyNotes,
  };
}

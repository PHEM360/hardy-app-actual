/** UK defined-contribution pension modeller using 2026/27 GOV.UK rates. Illustrative, not advice. */

export const UK_PENSION_RULES = {
  taxYear: "2026/27",
  annualAllowanceGbp: 60_000,
  thresholdIncomeGbp: 200_000,
  adjustedIncomeGbp: 260_000,
  taperedMinimumGbp: 10_000,
  moneyPurchaseAnnualAllowanceGbp: 10_000,
  lumpSumAllowanceGbp: 268_275,
  lumpSumAndDeathBenefitAllowanceGbp: 1_073_100,
  taxFreePct: 0.25,
  nonEarnerGrossLimitGbp: 3_600,
  basicRateReliefPct: 20,
  minPensionAge: 55,
  minPensionAgeFrom: "2028-04-06",
  minPensionAgeAfter: 57,
  newStatePensionWeeklyGbp: 241.3,
  newStatePensionQualifyingYears: 35,
} as const;

export type PensionTaxRelief = "relief_at_source" | "net_pay" | "salary_sacrifice" | "none";
export type PensionContributionSource = "personal" | "employer" | "tax_relief";

export interface PensionContribution {
  id: string;
  date: string;
  amountGbp: number;
  source: PensionContributionSource;
}

export interface PensionScenario {
  id: string;
  name: string;
  provider: string;
  currentPotGbp: number;
  paidInGbp: number;
  feesPaidToDateGbp: number;
  annualGrowthPct: number;
  annualFeePct: number;
  years: number;
  monthlyPersonalGbp: number;
  monthlyEmployerGbp: number;
  taxRelief: PensionTaxRelief;
  relevantEarningsGbp: number;
  thresholdIncomeGbp: number;
  adjustedIncomeGbp: number;
  flexiblyAccessed: boolean;
  remainingLsaGbp: number;
  currentAge: number;
  retirementAge: number;
  drawdownRatePct: number;
  takeTaxFreeLumpSum: boolean;
  includeStatePension: boolean;
  niQualifyingYears: number;
  transferOutFeeGbp: number;
  transferOutFeePct: number;
}

export interface PensionYearPoint {
  year: number;
  potGbp: number;
  paidInGbp: number;
  feesGbp: number;
}

export interface PensionProjection {
  scenarioId: string;
  name: string;
  provider: string;
  currentPotGbp: number;
  paidInToDateGbp: number;
  growthToDateGbp: number;
  feesPaidToDateGbp: number;
  potAtHorizonGbp: number;
  paidInDuringProjectionGbp: number;
  feesDuringProjectionGbp: number;
  reliefAddedGbp: number;
  annualAllowanceGbp: number;
  annualAllowanceBreaches: number;
  taxFreeLumpSumGbp: number;
  remainingForIncomeGbp: number;
  annualDrawdownGbp: number;
  monthlyDrawdownGbp: number;
  statePensionMonthlyGbp: number;
  totalMonthlyGbp: number;
  accessAge: number;
  canAccessAtHorizon: boolean;
  minAccessAge: number;
  points: PensionYearPoint[];
}

export interface PensionComparison {
  a: PensionProjection;
  b: PensionProjection;
  potDeltaGbp: number;
  monthlyDeltaGbp: number;
  taxFreeDeltaGbp: number;
}

export interface PensionModelDoc {
  contributions: PensionContribution[];
  scenarios: PensionScenario[];
}

export function pensionId(prefix = "p") {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function defaultPensionScenario(id: string, name: string, provider: string): PensionScenario {
  return {
    id,
    name,
    provider,
    currentPotGbp: 0,
    paidInGbp: 0,
    feesPaidToDateGbp: 0,
    annualGrowthPct: id === "b" ? 6 : 5,
    annualFeePct: id === "b" ? 0.25 : 0.5,
    years: 20,
    monthlyPersonalGbp: 0,
    monthlyEmployerGbp: 0,
    taxRelief: "relief_at_source",
    relevantEarningsGbp: 40_000,
    thresholdIncomeGbp: 40_000,
    adjustedIncomeGbp: 40_000,
    flexiblyAccessed: false,
    remainingLsaGbp: UK_PENSION_RULES.lumpSumAllowanceGbp,
    currentAge: 40,
    retirementAge: 67,
    drawdownRatePct: 4,
    takeTaxFreeLumpSum: true,
    includeStatePension: true,
    niQualifyingYears: 35,
    transferOutFeeGbp: 0,
    transferOutFeePct: 0,
  };
}

export function defaultPensionModel(): PensionModelDoc {
  return {
    contributions: [],
    scenarios: [
      defaultPensionScenario("a", "Keep this pension", "Current provider"),
      defaultPensionScenario("b", "Transfer", "New provider"),
    ],
  };
}

export function growthToDateGbp(scenario: Pick<PensionScenario, "currentPotGbp" | "paidInGbp">): number {
  return scenario.currentPotGbp - scenario.paidInGbp;
}

export function annualAllowanceFor(scenario: Pick<PensionScenario, "flexiblyAccessed" | "thresholdIncomeGbp" | "adjustedIncomeGbp">): number {
  if (scenario.flexiblyAccessed) return UK_PENSION_RULES.moneyPurchaseAnnualAllowanceGbp;
  if (scenario.thresholdIncomeGbp <= UK_PENSION_RULES.thresholdIncomeGbp) return UK_PENSION_RULES.annualAllowanceGbp;
  if (scenario.adjustedIncomeGbp <= UK_PENSION_RULES.adjustedIncomeGbp) return UK_PENSION_RULES.annualAllowanceGbp;
  const reduction = Math.floor((scenario.adjustedIncomeGbp - UK_PENSION_RULES.adjustedIncomeGbp) / 2);
  return Math.max(UK_PENSION_RULES.taperedMinimumGbp, UK_PENSION_RULES.annualAllowanceGbp - reduction);
}

export function minPensionAgeAt(isoDate: string): number {
  return isoDate >= UK_PENSION_RULES.minPensionAgeFrom
    ? UK_PENSION_RULES.minPensionAgeAfter
    : UK_PENSION_RULES.minPensionAge;
}

export function minPensionAgeAfterYears(years: number, from = new Date()): number {
  const horizon = new Date(from);
  horizon.setFullYear(horizon.getFullYear() + Math.max(0, years));
  const iso = horizon.toISOString().slice(0, 10);
  return minPensionAgeAt(iso);
}

export function monthlyGrossFromPersonal(personalNetOrGross: number, taxRelief: PensionTaxRelief): { personal: number; relief: number } {
  if (personalNetOrGross <= 0) return { personal: 0, relief: 0 };
  if (taxRelief === "relief_at_source") {
    const gross = personalNetOrGross / (1 - UK_PENSION_RULES.basicRateReliefPct / 100);
    return { personal: personalNetOrGross, relief: gross - personalNetOrGross };
  }
  return { personal: personalNetOrGross, relief: 0 };
}

export function statePensionMonthlyGbp(niQualifyingYears: number, include: boolean): number {
  if (!include) return 0;
  const fraction = Math.min(1, Math.max(0, niQualifyingYears) / UK_PENSION_RULES.newStatePensionQualifyingYears);
  return (UK_PENSION_RULES.newStatePensionWeeklyGbp * 52 * fraction) / 12;
}

export function taxFreeLumpSumGbp(potGbp: number, remainingLsaGbp: number, take: boolean): number {
  if (!take || potGbp <= 0) return 0;
  return Math.min(potGbp * UK_PENSION_RULES.taxFreePct, Math.max(0, remainingLsaGbp));
}

export function paidInFromContributions(contributions: PensionContribution[]): number {
  return contributions.reduce((sum, item) => sum + Math.max(0, item.amountGbp || 0), 0);
}

export function projectPension(scenario: PensionScenario): PensionProjection {
  const months = Math.max(0, Math.round(scenario.years * 12));
  const monthlyGrowth = Math.pow(1 + scenario.annualGrowthPct / 100, 1 / 12) - 1;
  const monthlyFee = Math.pow(1 + Math.max(0, scenario.annualFeePct) / 100, 1 / 12) - 1;
  const allowance = annualAllowanceFor(scenario);
  const transferHaircut = Math.max(0, scenario.transferOutFeeGbp)
    + Math.max(0, scenario.currentPotGbp) * Math.max(0, scenario.transferOutFeePct) / 100;

  let pot = Math.max(0, scenario.currentPotGbp - transferHaircut);
  let paidIn = 0;
  let fees = 0;
  let reliefAdded = 0;
  let aaUsed = 0;
  let aaBreaches = 0;
  const points: PensionYearPoint[] = [{ year: 0, potGbp: pot, paidInGbp: 0, feesGbp: 0 }];

  for (let month = 1; month <= months; month += 1) {
    const { personal, relief } = monthlyGrossFromPersonal(scenario.monthlyPersonalGbp, scenario.taxRelief);
    const employer = Math.max(0, scenario.monthlyEmployerGbp);
    const intoPot = personal + employer + relief;
    pot += intoPot;
    paidIn += intoPot;
    reliefAdded += relief;
    aaUsed += intoPot;

    pot *= 1 + monthlyGrowth;
    const fee = pot * monthlyFee;
    pot -= fee;
    fees += fee;

    if (month % 12 === 0) {
      if (aaUsed > allowance + 0.5) aaBreaches += 1;
      aaUsed = 0;
      points.push({ year: month / 12, potGbp: pot, paidInGbp: paidIn, feesGbp: fees });
    }
  }
  if (months > 0 && months % 12 !== 0) {
    points.push({ year: months / 12, potGbp: pot, paidInGbp: paidIn, feesGbp: fees });
  }

  const taxFree = taxFreeLumpSumGbp(pot, scenario.remainingLsaGbp, scenario.takeTaxFreeLumpSum);
  const remaining = Math.max(0, pot - taxFree);
  const annualDrawdown = remaining * Math.max(0, scenario.drawdownRatePct) / 100;
  const monthlyDrawdown = annualDrawdown / 12;
  const stateMonthly = statePensionMonthlyGbp(scenario.niQualifyingYears, scenario.includeStatePension);
  const accessAge = scenario.currentAge + scenario.years;
  const minAccess = minPensionAgeAfterYears(scenario.years);

  return {
    scenarioId: scenario.id,
    name: scenario.name,
    provider: scenario.provider,
    currentPotGbp: scenario.currentPotGbp,
    paidInToDateGbp: scenario.paidInGbp,
    growthToDateGbp: growthToDateGbp(scenario),
    feesPaidToDateGbp: scenario.feesPaidToDateGbp,
    potAtHorizonGbp: pot,
    paidInDuringProjectionGbp: paidIn,
    feesDuringProjectionGbp: fees,
    reliefAddedGbp: reliefAdded,
    annualAllowanceGbp: allowance,
    annualAllowanceBreaches: aaBreaches,
    taxFreeLumpSumGbp: taxFree,
    remainingForIncomeGbp: remaining,
    annualDrawdownGbp: annualDrawdown,
    monthlyDrawdownGbp: monthlyDrawdown,
    statePensionMonthlyGbp: stateMonthly,
    totalMonthlyGbp: monthlyDrawdown + stateMonthly,
    accessAge,
    canAccessAtHorizon: accessAge >= minAccess,
    minAccessAge: minAccess,
    points,
  };
}

export function comparePensionScenarios(a: PensionScenario, b: PensionScenario): PensionComparison {
  const left = projectPension(a);
  const right = projectPension(b);
  return {
    a: left,
    b: right,
    potDeltaGbp: right.potAtHorizonGbp - left.potAtHorizonGbp,
    monthlyDeltaGbp: right.monthlyDrawdownGbp - left.monthlyDrawdownGbp,
    taxFreeDeltaGbp: right.taxFreeLumpSumGbp - left.taxFreeLumpSumGbp,
  };
}

export function mergePensionModel(raw: unknown): PensionModelDoc {
  const fallback = defaultPensionModel();
  if (!raw || typeof raw !== "object") return fallback;
  const data = raw as Partial<PensionModelDoc>;
  const contributions = Array.isArray(data.contributions)
    ? data.contributions.map((item, index) => ({
      id: String(item?.id || `c${index}`),
      date: typeof item?.date === "string" ? item.date : "",
      amountGbp: Number(item?.amountGbp) || 0,
      source: item?.source === "employer" || item?.source === "tax_relief" ? item.source : "personal",
    }))
    : [];
  const incoming = Array.isArray(data.scenarios) ? data.scenarios : [];
  const scenarios = fallback.scenarios.map((base, index) => {
    const patch = incoming[index] ?? incoming.find((item) => item?.id === base.id);
    return patch ? { ...base, ...patch, id: base.id } : base;
  });
  if (incoming.length > scenarios.length) {
    incoming.slice(scenarios.length).forEach((item, index) => {
      if (!item) return;
      scenarios.push({ ...defaultPensionScenario(item.id || `s${index + 2}`, item.name || "Scenario", item.provider || ""), ...item });
    });
  }
  return { contributions, scenarios };
}

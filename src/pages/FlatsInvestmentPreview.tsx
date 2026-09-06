import { Building2 } from "lucide-react";
import FeaturePageShell from "@/components/layout/FeaturePageShell";
import FlatInvestmentModelPanel from "@/components/flats/FlatInvestmentModel";
import { defaultInvestmentInputs } from "@/lib/flatInvestmentModel";
import type { FlatRecord } from "@/types/flats";

/**
 * Dev-only preview of the Flats investment model with sample to-let figures.
 * Routed at /dev/flats-investment-preview when import.meta.env.DEV is true.
 */
const SAMPLE_FLATS: FlatRecord[] = [
  {
    id: "tattersalls",
    name: "Tattersalls",
    slug: "tattersalls",
    address: "Sample flat",
    propertyValueGbp: 90_000,
    mortgageBalanceGbp: 0,
    mortgageRatePct: 0,
    ownership: "personal",
    tenant: {
      name: "",
      rentMonthlyGbp: 750,
      depositGbp: null,
    },
    tax: {
      ownership: "personal",
      usePropertyAllowance: false,
      financeCostRestrictionPct: 100,
    },
    bankLinks: [],
    expenseCategories: [],
    incomeCategories: [],
    documentCategories: [],
    balanceHistory: [],
    ledger: [],
    investmentModel: defaultInvestmentInputs({
      marketValueGbp: 90_000,
      offerPriceGbp: 80_000,
      rentMonthlyGbp: 750,
      serviceChargeAnnualGbp: 2_400,
      maintenanceAnnualGbp: 600,
      insuranceAnnualGbp: 250,
      lettingFeesPctOfRent: 10,
      voidMonthsPerYear: 0.5,
      oneOffs: [
        { id: "lease", label: "Lease extension", amountGbp: 8_000, year: 1 },
        { id: "dov", label: "Deed of variation", amountGbp: 1_500, year: 0 },
      ],
      horizonYears: 10,
      capitalGrowthPctPa: 2,
      alternativeReturnPctPa: 4,
      incomeTaxRatePct: 40,
    }),
  },
  {
    id: "mums-flat",
    name: "Mum's Flat",
    slug: "mums-flat",
    address: "",
    propertyValueGbp: 220_000,
    mortgageBalanceGbp: 0,
    mortgageRatePct: 0,
    ownership: "personal",
    tenant: {
      name: "",
      rentMonthlyGbp: 1_100,
      depositGbp: null,
    },
    tax: {
      ownership: "personal",
      usePropertyAllowance: false,
      financeCostRestrictionPct: 100,
    },
    bankLinks: [],
    expenseCategories: [],
    incomeCategories: [],
    documentCategories: [],
    balanceHistory: [],
    ledger: [],
    investmentModel: null,
  },
];

export default function FlatsInvestmentPreview() {
  return (
    <FeaturePageShell
      title="Flats"
      subtitle="Investment model preview (dev)"
      icon={<Building2 className="h-5 w-5" />}
    >
      <FlatInvestmentModelPanel flats={SAMPLE_FLATS} initialFlatId="tattersalls" localOnly />
    </FeaturePageShell>
  );
}

export interface ProviderFeeSource {
  key: string;
  label: string;
  url: string;
}

export const PROVIDER_FEE_SOURCES: ProviderFeeSource[] = [
  { key: "vanguard", label: "Vanguard", url: "https://www.vanguardinvestor.co.uk/what-we-offer/fees-explained" },
  { key: "interactive investor", label: "Interactive Investor", url: "https://www.ii.co.uk/our-charges" },
  { key: "true potential", label: "True Potential", url: "https://www.truepotential.co.uk/fees/" },
];

export function providerFeeSource(provider: string): ProviderFeeSource | undefined {
  const value = provider.trim().toLowerCase();
  return PROVIDER_FEE_SOURCES.find((source) => value.includes(source.key) || source.key.includes(value));
}

export function feeReviewDue(lastCheckedAt?: string, now = new Date()): boolean {
  if (!lastCheckedAt) return true;
  const checked = new Date(lastCheckedAt);
  if (Number.isNaN(checked.getTime())) return true;
  return checked.getUTCFullYear() !== now.getUTCFullYear() || checked.getUTCMonth() !== now.getUTCMonth();
}

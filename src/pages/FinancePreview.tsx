import Finance from "@/pages/Finance";
import { buildMockFinanceData } from "@/lib/mockFinanceData";

/**
 * Dev-only, unauthenticated preview of the Finance page with synthetic sample
 * data. Routed at /dev/finance-preview, only when import.meta.env.DEV is true
 * (see App.tsx) — never reachable in a production build. Exists so the page's
 * UI can be iterated on and screenshotted without a real login.
 */
export default function FinancePreview() {
  const mockData = buildMockFinanceData();
  return <Finance mockData={mockData} />;
}

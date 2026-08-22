import type { Company } from "@/types/app";

type CompanyWrite = Partial<Omit<Company, "id" | "createdAt" | "updatedAt">>;

/** Firestore rejects undefined field values, including nested contact fields. */
export function cleanCompanyPayload(company: CompanyWrite): CompanyWrite {
  const clean = Object.fromEntries(
    Object.entries(company).filter(([, value]) => value !== undefined),
  ) as CompanyWrite;

  if (company.contact) {
    clean.contact = Object.fromEntries(
      Object.entries(company.contact).filter(([, value]) => value !== undefined),
    );
  }

  return clean;
}

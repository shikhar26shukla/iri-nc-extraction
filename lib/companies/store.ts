import type { Company, IrisSkillEntry, NcSkillEntry } from "@/types";
import {
  dbCompanyExists,
  dbCountIrisEntries,
  dbCountNcEntries,
  dbGetCompany,
  dbInsertCompany,
  dbListCompanies,
  dbTouchCompanyUpdatedAt,
  dbUpdateCompany,
} from "@/lib/db/queries/companies";
import {
  dbReadIrisEntries,
  dbReadNcEntries,
  dbWriteIrisEntries,
  dbWriteNcEntries,
} from "@/lib/db/queries/entries";

export type { Company };

export interface CompanySummary extends Company {
  irisCount: number;
  ncCount: number;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

export async function companyExists(id: string): Promise<boolean> {
  return dbCompanyExists(id);
}

export async function listCompanies(): Promise<CompanySummary[]> {
  const companies = await dbListCompanies();
  const summaries = await Promise.all(
    companies.map(async (company) => ({
      ...company,
      irisCount: await dbCountIrisEntries(company.id),
      ncCount: await dbCountNcEntries(company.id),
    }))
  );
  return summaries;
}

export async function getCompany(id: string): Promise<Company | null> {
  return dbGetCompany(id);
}

export async function ensureCompany(id: string, name: string): Promise<Company> {
  const existing = await getCompany(id);
  if (existing) return existing;

  const now = new Date().toISOString();
  const company: Company = {
    id,
    name,
    autoLearnIris: false,
    createdAt: now,
    updatedAt: now,
  };
  await dbInsertCompany(company);
  return company;
}

export async function createCompany(name: string): Promise<Company> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Company name is required");

  const numericMatch = trimmed.match(/\b(\d{3,6})\b/);
  let baseId = numericMatch ? numericMatch[1] : slugify(trimmed);
  if (!baseId) baseId = `company-${Date.now()}`;

  let id = baseId;
  let suffix = 1;
  while (await companyExists(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  const now = new Date().toISOString();
  const company: Company = {
    id,
    name: trimmed,
    autoLearnIris: false,
    createdAt: now,
    updatedAt: now,
  };

  await dbInsertCompany(company);
  return company;
}

export async function readCompanyKnowledgeBase<T>(
  companyId: string,
  type: "iris" | "nc"
): Promise<T[]> {
  if (!(await companyExists(companyId))) return [];
  if (type === "iris") {
    return (await dbReadIrisEntries(companyId)) as T[];
  }
  return (await dbReadNcEntries(companyId)) as T[];
}

export async function updateCompany(
  id: string,
  updates: Partial<Pick<Company, "name" | "autoLearnIris">>
): Promise<Company> {
  const company = await getCompany(id);
  if (!company) throw new Error(`Company ${id} not found`);

  if (updates.name !== undefined) company.name = updates.name.trim();
  if (updates.autoLearnIris !== undefined) {
    company.autoLearnIris = updates.autoLearnIris;
  }
  company.updatedAt = new Date().toISOString();

  await dbUpdateCompany(company);
  return company;
}

export async function writeCompanyKnowledgeBase<T>(
  companyId: string,
  type: "iris" | "nc",
  entries: T[]
): Promise<void> {
  if (!(await companyExists(companyId))) {
    throw new Error(`Company ${companyId} not found`);
  }

  if (type === "iris") {
    await dbWriteIrisEntries(companyId, entries as IrisSkillEntry[]);
  } else {
    await dbWriteNcEntries(companyId, entries as NcSkillEntry[]);
  }

  await dbTouchCompanyUpdatedAt(companyId);
}

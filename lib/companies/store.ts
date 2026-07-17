import fs from "fs/promises";
import path from "path";
import type { Company, IrisSkillEntry, NcSkillEntry } from "@/types";

export type { Company };

export interface CompanySummary extends Company {
  irisCount: number;
  ncCount: number;
}

const COMPANIES_ROOT = path.join(process.cwd(), "data", "companies");

function companyDir(id: string): string {
  return path.join(COMPANIES_ROOT, id);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

export async function companyExists(id: string): Promise<boolean> {
  try {
    await fs.access(path.join(companyDir(id), "company.json"));
    return true;
  } catch {
    return false;
  }
}

export async function listCompanies(): Promise<CompanySummary[]> {
  await fs.mkdir(COMPANIES_ROOT, { recursive: true });
  const entries = await fs.readdir(COMPANIES_ROOT, { withFileTypes: true });
  const companies: CompanySummary[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const company = await getCompany(entry.name);
    if (!company) continue;
    const iris = await readCompanyKnowledgeBase<IrisSkillEntry>(entry.name, "iris");
    const nc = await readCompanyKnowledgeBase<NcSkillEntry>(entry.name, "nc");
    companies.push({
      ...company,
      irisCount: iris.length,
      ncCount: nc.length,
    });
  }

  return companies.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getCompany(id: string): Promise<Company | null> {
  const filePath = path.join(companyDir(id), "company.json");
  return readJsonFile<Company | null>(filePath, null);
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
  const dir = companyDir(id);
  await fs.mkdir(dir, { recursive: true });
  await writeJsonFile(path.join(dir, "company.json"), company);
  await writeJsonFile(path.join(dir, "iris.json"), []);
  await writeJsonFile(path.join(dir, "nc.json"), []);
  return company;
}

export async function createCompany(name: string): Promise<Company> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Company name is required");

  await fs.mkdir(COMPANIES_ROOT, { recursive: true });

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

  const dir = companyDir(id);
  await fs.mkdir(dir, { recursive: true });
  await writeJsonFile(path.join(dir, "company.json"), company);
  await writeJsonFile(path.join(dir, "iris.json"), []);
  await writeJsonFile(path.join(dir, "nc.json"), []);

  return company;
}

export async function readCompanyKnowledgeBase<T>(
  companyId: string,
  type: "iris" | "nc"
): Promise<T[]> {
  if (!(await companyExists(companyId))) return [];
  const filePath = path.join(companyDir(companyId), `${type}.json`);
  return readJsonFile<T[]>(filePath, []);
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

  await writeJsonFile(path.join(companyDir(id), "company.json"), company);
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
  const filePath = path.join(companyDir(companyId), `${type}.json`);
  await writeJsonFile(filePath, entries);

  const companyPath = path.join(companyDir(companyId), "company.json");
  const company = await readJsonFile<Company | null>(companyPath, null);
  if (company) {
    company.updatedAt = new Date().toISOString();
    await writeJsonFile(companyPath, company);
  }
}

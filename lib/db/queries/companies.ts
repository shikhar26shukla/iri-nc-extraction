import type { RowDataPacket } from "mysql2/promise";
import type { Company } from "@/types";
import { execute, query } from "@/lib/db/pool";

interface CompanyRow extends RowDataPacket {
  id: string;
  name: string;
  auto_learn_iris: number;
  created_at: Date;
  updated_at: Date;
}

function rowToCompany(row: CompanyRow): Company {
  return {
    id: row.id,
    name: row.name,
    autoLearnIris: row.auto_learn_iris === 1,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function dbCompanyExists(id: string): Promise<boolean> {
  const rows = await query<CompanyRow>(
    "SELECT id FROM companies WHERE id = ? LIMIT 1",
    [id]
  );
  return rows.length > 0;
}

export async function dbGetCompany(id: string): Promise<Company | null> {
  const rows = await query<CompanyRow>(
    "SELECT * FROM companies WHERE id = ? LIMIT 1",
    [id]
  );
  return rows[0] ? rowToCompany(rows[0]) : null;
}

export async function dbListCompanies(): Promise<Company[]> {
  const rows = await query<CompanyRow>(
    "SELECT * FROM companies ORDER BY name ASC"
  );
  return rows.map(rowToCompany);
}

export async function dbInsertCompany(company: Company): Promise<void> {
  await execute(
    `INSERT INTO companies (id, name, auto_learn_iris, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [
      company.id,
      company.name,
      company.autoLearnIris ? 1 : 0,
      new Date(company.createdAt),
      new Date(company.updatedAt),
    ]
  );
}

export async function dbUpdateCompany(company: Company): Promise<void> {
  await execute(
    `UPDATE companies SET name = ?, auto_learn_iris = ?, updated_at = ? WHERE id = ?`,
    [
      company.name,
      company.autoLearnIris ? 1 : 0,
      new Date(company.updatedAt),
      company.id,
    ]
  );
}

export async function dbTouchCompanyUpdatedAt(id: string): Promise<void> {
  await execute("UPDATE companies SET updated_at = ? WHERE id = ?", [
    new Date(),
    id,
  ]);
}

export async function dbCountIrisEntries(companyId: string): Promise<number> {
  const rows = await query<RowDataPacket & { count: number }>(
    "SELECT COUNT(*) AS count FROM iris_entries WHERE company_id = ?",
    [companyId]
  );
  return Number(rows[0]?.count || 0);
}

export async function dbCountNcEntries(companyId: string): Promise<number> {
  const rows = await query<RowDataPacket & { count: number }>(
    "SELECT COUNT(*) AS count FROM nc_entries WHERE company_id = ?",
    [companyId]
  );
  return Number(rows[0]?.count || 0);
}

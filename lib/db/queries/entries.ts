import type { RowDataPacket } from "mysql2/promise";
import type { IrisSkillEntry, NcSkillEntry } from "@/types";
import { execute, query, withTransaction } from "@/lib/db/pool";

interface IrisRow extends RowDataPacket {
  particular: string;
  iris_code: string;
  iris_codes: string | IrisSkillEntry["irisCodes"] | null;
  type: string | null;
  notes: string | null;
}

interface NcRow extends RowDataPacket {
  details: string;
  nc: string;
  nc_codes: string | NcSkillEntry["ncCodes"] | null;
}

function parseJson<T>(value: string | T | null): T | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return undefined;
    }
  }
  return value as T;
}

function rowToIrisEntry(row: IrisRow): IrisSkillEntry {
  return {
    particular: row.particular,
    irisCode: row.iris_code,
    irisCodes: parseJson(row.iris_codes),
    type: row.type || undefined,
    notes: row.notes || undefined,
  };
}

function rowToNcEntry(row: NcRow): NcSkillEntry {
  return {
    details: row.details,
    nc: row.nc,
    ncCodes: parseJson(row.nc_codes),
  };
}

export async function dbReadIrisEntries(companyId: string): Promise<IrisSkillEntry[]> {
  const rows = await query<IrisRow>(
    "SELECT particular, iris_code, iris_codes, type, notes FROM iris_entries WHERE company_id = ? ORDER BY particular ASC",
    [companyId]
  );
  return rows.map(rowToIrisEntry);
}

export async function dbReadNcEntries(companyId: string): Promise<NcSkillEntry[]> {
  const rows = await query<NcRow>(
    "SELECT details, nc, nc_codes FROM nc_entries WHERE company_id = ? ORDER BY details ASC",
    [companyId]
  );
  return rows.map(rowToNcEntry);
}

export async function dbWriteIrisEntries(
  companyId: string,
  entries: IrisSkillEntry[]
): Promise<void> {
  await withTransaction(async (conn) => {
    await conn.execute("DELETE FROM iris_entries WHERE company_id = ?", [companyId]);
    for (const entry of entries) {
      await conn.execute(
        `INSERT INTO iris_entries (company_id, particular, iris_code, iris_codes, type, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          entry.particular,
          entry.irisCode,
          entry.irisCodes ? JSON.stringify(entry.irisCodes) : null,
          entry.type || null,
          entry.notes || null,
        ]
      );
    }
  });
}

export async function dbWriteNcEntries(
  companyId: string,
  entries: NcSkillEntry[]
): Promise<void> {
  await withTransaction(async (conn) => {
    await conn.execute("DELETE FROM nc_entries WHERE company_id = ?", [companyId]);
    for (const entry of entries) {
      await conn.execute(
        `INSERT INTO nc_entries (company_id, details, nc, nc_codes)
         VALUES (?, ?, ?, ?)`,
        [
          companyId,
          entry.details,
          entry.nc,
          entry.ncCodes ? JSON.stringify(entry.ncCodes) : null,
        ]
      );
    }
  });
}

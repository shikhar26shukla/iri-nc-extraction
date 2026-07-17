import type { RowDataPacket } from "mysql2/promise";
import type { SkillBaseMergeStats, SkillBaseVersion } from "@/types";
import { execute, query } from "@/lib/db/pool";

interface VersionRow extends RowDataPacket {
  version: number;
  source: SkillBaseVersion["source"];
  file_name: string | null;
  entry_count: number;
  merge_stats: string | SkillBaseMergeStats | null;
  entries: string | unknown[];
  in_index: number;
  created_at: Date;
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

function rowToVersion(row: VersionRow): SkillBaseVersion {
  return {
    version: row.version,
    createdAt: row.created_at.toISOString(),
    source: row.source,
    entryCount: row.entry_count,
    fileName: row.file_name || undefined,
    mergeStats: parseJson<SkillBaseMergeStats>(row.merge_stats),
  };
}

export async function dbListVersions(
  companyId: string,
  skillType: "iris" | "nc"
): Promise<SkillBaseVersion[]> {
  const rows = await query<VersionRow>(
    `SELECT version, source, file_name, entry_count, merge_stats, entries, in_index, created_at
     FROM skill_base_versions
     WHERE company_id = ? AND skill_type = ? AND in_index = 1
     ORDER BY version DESC`,
    [companyId, skillType]
  );
  return rows.map(rowToVersion);
}

export async function dbGetMaxVersion(
  companyId: string,
  skillType: "iris" | "nc"
): Promise<number> {
  const rows = await query<RowDataPacket & { maxVersion: number | null }>(
    `SELECT MAX(version) AS maxVersion FROM skill_base_versions
     WHERE company_id = ? AND skill_type = ?`,
    [companyId, skillType]
  );
  return Number(rows[0]?.maxVersion || 0);
}

export async function dbInsertVersionSnapshot<T>(params: {
  companyId: string;
  skillType: "iris" | "nc";
  version: number;
  source: SkillBaseVersion["source"];
  fileName?: string;
  entryCount: number;
  mergeStats?: SkillBaseMergeStats;
  entries: T[];
  inIndex: boolean;
  createdAt?: string;
}): Promise<void> {
  await execute(
    `INSERT INTO skill_base_versions
      (company_id, skill_type, version, source, file_name, entry_count, merge_stats, entries, in_index, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.companyId,
      params.skillType,
      params.version,
      params.source,
      params.fileName || null,
      params.entryCount,
      params.mergeStats ? JSON.stringify(params.mergeStats) : null,
      JSON.stringify(params.entries),
      params.inIndex ? 1 : 0,
      params.createdAt ? new Date(params.createdAt) : new Date(),
    ]
  );
}

export async function dbGetVersionEntries<T>(
  companyId: string,
  skillType: "iris" | "nc",
  version: number
): Promise<T[] | null> {
  const rows = await query<VersionRow>(
    `SELECT entries FROM skill_base_versions
     WHERE company_id = ? AND skill_type = ? AND version = ?
     LIMIT 1`,
    [companyId, skillType, version]
  );
  if (!rows[0]) return null;
  const parsed = parseJson<T[]>(rows[0].entries as string);
  return parsed || null;
}

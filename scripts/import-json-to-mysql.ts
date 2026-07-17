import fs from "fs/promises";
import path from "path";
import { loadEnvLocal } from "@/lib/db/load-env";
import { execute, getPool } from "@/lib/db/pool";
import {
  dbInsertCompany,
  dbCompanyExists,
} from "@/lib/db/queries/companies";
import {
  dbWriteIrisEntries,
  dbWriteNcEntries,
} from "@/lib/db/queries/entries";
import { dbInsertVersionSnapshot } from "@/lib/db/queries/versions";
import type { Company, IrisSkillEntry, NcSkillEntry, SkillBaseVersion } from "@/types";

const COMPANIES_ROOT = path.resolve(
  process.cwd(),
  process.env.SEED_COMPANIES_DIR || path.join("data", "seed", "companies")
);

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function importVersions(
  companyId: string,
  skillType: "iris" | "nc",
  versionsDir: string
): Promise<number> {
  let imported = 0;
  const indexPath = path.join(versionsDir, "versions.json");
  const index = (await readJsonFile<SkillBaseVersion[]>(indexPath)) || [];
  const indexedVersions = new Set(index.map((v) => v.version));

  for (const record of index) {
    const snapshotPath = path.join(versionsDir, `v${record.version}.json`);
    const entries = await readJsonFile<unknown[]>(snapshotPath);
    if (!entries) {
      console.warn(`  Missing snapshot ${snapshotPath}, skipping v${record.version}`);
      continue;
    }

    await dbInsertVersionSnapshot({
      companyId,
      skillType,
      version: record.version,
      source: record.source,
      fileName: record.fileName,
      entryCount: record.entryCount,
      mergeStats: record.mergeStats,
      entries,
      inIndex: true,
      createdAt: record.createdAt,
    });
    imported += 1;
  }

  let files: string[];
  try {
    files = await fs.readdir(versionsDir);
  } catch {
    return imported;
  }

  for (const file of files) {
    const match = file.match(/^v(\d+)\.json$/);
    if (!match) continue;
    const version = parseInt(match[1], 10);
    if (indexedVersions.has(version)) continue;

    const entries = await readJsonFile<unknown[]>(path.join(versionsDir, file));
    if (!entries) continue;

    await dbInsertVersionSnapshot({
      companyId,
      skillType,
      version,
      source: "upload",
      entryCount: entries.length,
      entries,
      inIndex: false,
    });
    imported += 1;
  }

  return imported;
}

async function importCompany(companyId: string): Promise<void> {
  const dir = path.join(COMPANIES_ROOT, companyId);
  const company = await readJsonFile<Company>(path.join(dir, "company.json"));
  if (!company) {
    console.warn(`Skipping ${companyId}: no company.json`);
    return;
  }

  if (await dbCompanyExists(companyId)) {
    console.log(`Company ${companyId} already exists, updating entries`);
  } else {
    await dbInsertCompany(company);
    console.log(`Imported company ${companyId}: ${company.name}`);
  }

  const iris = (await readJsonFile<IrisSkillEntry[]>(path.join(dir, "iris.json"))) || [];
  const nc = (await readJsonFile<NcSkillEntry[]>(path.join(dir, "nc.json"))) || [];

  await dbWriteIrisEntries(companyId, iris);
  await dbWriteNcEntries(companyId, nc);
  console.log(`  IRIS entries: ${iris.length}, NC entries: ${nc.length}`);

  await execute("DELETE FROM skill_base_versions WHERE company_id = ?", [companyId]);

  const irisVersions = await importVersions(
    companyId,
    "iris",
    path.join(dir, "iris-versions")
  );
  const ncVersions = await importVersions(
    companyId,
    "nc",
    path.join(dir, "nc-versions")
  );
  console.log(`  Version snapshots: ${irisVersions} IRIS, ${ncVersions} NC`);
}

async function main() {
  loadEnvLocal();
  getPool();

  const entries = await fs.readdir(COMPANIES_ROOT, { withFileTypes: true });
  const companyIds = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (companyIds.length === 0) {
    console.log(`No companies found in ${COMPANIES_ROOT}`);
    return;
  }

  console.log(`Importing ${companyIds.length} companies from JSON...`);
  for (const companyId of companyIds) {
    await importCompany(companyId);
  }

  const pool = getPool();
  await pool.end();
  console.log("Import complete.");
}

main().catch((err) => {
  console.error("db:import failed:", err);
  process.exit(1);
});

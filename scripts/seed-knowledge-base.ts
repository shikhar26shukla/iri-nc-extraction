import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import {
  ensureCompany,
} from "@/lib/companies/store";
import { writeIrisSkillBaseWithSnapshot } from "@/lib/companies/skill-base-versions";
import { writeNcSkillBaseWithSnapshot } from "@/lib/companies/nc-skill-base-versions";
import { buildIrisSkillBaseFromWorkbook } from "@/lib/iris/build-skill-base";
import { buildNcSkillBaseFromWorkbook } from "@/lib/nc/build-skill-base";
import { countUniqueIrisCodes, upsertIrisSkillEntry } from "@/lib/iris/skill-base";
import { loadWorkbookBuffer } from "@/lib/excel/reader";
import { normalizeDetails } from "@/lib/normalization/text";
import type { IrisSkillEntry, NcSkillEntry } from "@/types";

const COMPANY_ID = "7033";
const COMPANY_NAME = "Forest Car Company Ltd";

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && value.text) {
    return String(value.text).trim();
  }
  return String(value).trim();
}

async function parseIrisSeed(filePath: string): Promise<IrisSkillEntry[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  const map = new Map<string, IrisSkillEntry>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const particular = cellText(row.getCell(2).value);
    const irisCode = cellText(row.getCell(3).value);
    if (!particular || !irisCode) return;
    upsertIrisSkillEntry(map, {
      particular,
      irisCode,
      type: cellText(row.getCell(1).value) || undefined,
      notes: cellText(row.getCell(4).value) || undefined,
    });
  });

  return Array.from(map.values());
}

async function parseNcSeed(filePath: string): Promise<NcSkillEntry[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);
  const sheet = workbook.worksheets[0];
  const map = new Map<string, NcSkillEntry>();

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const details = cellText(row.getCell(1).value);
    const nc = cellText(row.getCell(2).value);
    if (!details || !nc) return;
    map.set(normalizeDetails(details), { details, nc });
  });

  return Array.from(map.values());
}

async function main() {
  const root = process.cwd();
  await ensureCompany(COMPANY_ID, COMPANY_NAME);

  const irisSeed = path.join(root, "data", "seed", "iris-skill-base.xlsx");
  const ncSeed = path.join(root, "data", "seed", "nc-skill-base.xlsx");
  const test7033 = path.join(root, "test7033.xlsx");
  const nc7033 = path.join(root, "docs", "7033NC.xlsx");

  let ncEntries: NcSkillEntry[];
  let ncSource = "seed";
  let ncBuildStats = {
    entryCount: 0,
    rowsRead: 0,
    codesFound: 0,
    newDetails: 0,
    updatedDetails: 0,
    newCodes: 0,
    duplicatesMerged: 0,
  };

  try {
    await fs.access(nc7033);
    const buffer = await fs.readFile(nc7033);
    const workbook = await loadWorkbookBuffer(buffer);
    const result = buildNcSkillBaseFromWorkbook(workbook, "build", []);
    ncEntries = result.entries;
    ncBuildStats = result.stats;
    ncSource = "build";
    console.log(
      `Built NC skill base from docs/7033NC.xlsx: ${result.stats.entryCount} entries, ${result.stats.codesFound} unique codes, ${result.stats.rowsRead} rows`
    );
  } catch {
    ncEntries = await parseNcSeed(ncSeed);
    ncBuildStats.entryCount = ncEntries.length;
    console.log(`docs/7033NC.xlsx not found — using NC seed (${ncEntries.length} entries)`);
  }

  await writeNcSkillBaseWithSnapshot(COMPANY_ID, ncEntries, {
    source: ncSource === "build" ? "build" : "seed",
    fileName: ncSource === "build" ? "7033NC.xlsx" : "nc-skill-base.xlsx",
    mergeStats: {
      entryCount: ncBuildStats.entryCount,
      newParticulars: ncBuildStats.newDetails,
      updatedParticulars: ncBuildStats.updatedDetails,
      newDetails: ncBuildStats.newDetails,
      updatedDetails: ncBuildStats.updatedDetails,
      newCodes: ncBuildStats.newCodes,
      duplicatesMerged: ncBuildStats.duplicatesMerged,
    },
  });

  let irisEntries: IrisSkillEntry[];
  let irisSource = "seed";
  let irisBuildStats = {
    entryCount: 0,
    newParticulars: 0,
    updatedParticulars: 0,
    newCodes: 0,
    duplicatesMerged: 0,
    rowsRead: 0,
    codesFound: 0,
  };

  try {
    await fs.access(test7033);
    const buffer = await fs.readFile(test7033);
    const workbook = await loadWorkbookBuffer(buffer);
    const result = buildIrisSkillBaseFromWorkbook(workbook, "build", []);
    irisEntries = result.entries;
    irisBuildStats = result.stats;
    irisSource = "build";
    console.log(
      `Built IRIS skill base from test7033.xlsx: ${result.stats.entryCount} entries, ${result.stats.codesFound} unique codes, ${result.stats.rowsRead} rows`
    );
  } catch {
    irisEntries = await parseIrisSeed(irisSeed);
    irisBuildStats.entryCount = irisEntries.length;
    console.log(`test7033.xlsx not found — using seed (${irisEntries.length} entries)`);
  }

  await writeIrisSkillBaseWithSnapshot(COMPANY_ID, irisEntries, {
    source: irisSource === "build" ? "build" : "seed",
    fileName: irisSource === "build" ? "test7033.xlsx" : "iris-skill-base.xlsx",
    mergeStats: {
      entryCount: irisBuildStats.entryCount,
      newParticulars: irisBuildStats.newParticulars,
      updatedParticulars: irisBuildStats.updatedParticulars,
      newCodes: irisBuildStats.newCodes,
      duplicatesMerged: irisBuildStats.duplicatesMerged,
    },
  });

  const uniqueCodes = countUniqueIrisCodes(irisEntries);
  console.log(
    `Seeded company ${COMPANY_ID} with ${irisEntries.length} IRIS (${uniqueCodes} unique codes) and ${ncEntries.length} NC entries`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

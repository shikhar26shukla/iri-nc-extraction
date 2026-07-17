import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import {
  ensureCompany,
  writeCompanyKnowledgeBase,
} from "@/lib/companies/store";
import { writeIrisSkillBaseWithSnapshot } from "@/lib/companies/skill-base-versions";
import { buildIrisSkillBaseFromWorkbook } from "@/lib/iris/build-skill-base";
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

  const ncEntries = await parseNcSeed(ncSeed);
  await writeCompanyKnowledgeBase(COMPANY_ID, "nc", ncEntries);

  let irisEntries: IrisSkillEntry[];
  let source = "seed";
  let buildStats = {
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
    buildStats = result.stats;
    source = "build";
    console.log(
      `Built IRIS skill base from test7033.xlsx: ${result.stats.entryCount} entries, ${result.stats.codesFound} unique codes, ${result.stats.rowsRead} rows`
    );
  } catch {
    irisEntries = await parseIrisSeed(irisSeed);
    buildStats.entryCount = irisEntries.length;
    console.log(`test7033.xlsx not found — using seed (${irisEntries.length} entries)`);
  }

  await writeIrisSkillBaseWithSnapshot(COMPANY_ID, irisEntries, {
    source: source === "build" ? "build" : "seed",
    fileName: source === "build" ? "test7033.xlsx" : "iris-skill-base.xlsx",
    mergeStats: {
      entryCount: buildStats.entryCount,
      newParticulars: buildStats.newParticulars,
      updatedParticulars: buildStats.updatedParticulars,
      newCodes: buildStats.newCodes,
      duplicatesMerged: buildStats.duplicatesMerged,
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

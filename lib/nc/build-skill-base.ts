import ExcelJS from "exceljs";
import { getCellValue, parseSimpleSheet } from "@/lib/excel/reader";
import {
  buildNcSkillBaseMap,
  countUniqueNcCodes,
  detailsKey,
  finalizeNcSkillEntry,
  normalizeNcCodeStats,
  upsertNcSkillEntry,
} from "@/lib/nc/skill-base";
import type { NcCodeStat, NcSkillEntry, NcSkillBaseBuildStats } from "@/types";

interface RowAccumulator {
  details: string;
  codeCounts: Map<string, number>;
}

function accumulateFromWorkbook(
  workbook: ExcelJS.Workbook,
  existing: NcSkillEntry[] = []
): {
  accumulators: Map<string, RowAccumulator>;
  rowsRead: number;
  rowStats: {
    newDetails: number;
    updatedDetails: number;
    newCodes: number;
    duplicatesMerged: number;
  };
} {
  const { detection } = parseSimpleSheet(workbook, "nc");
  const worksheet = workbook.worksheets[0];
  const accumulators = new Map<string, RowAccumulator>();
  let rowsRead = 0;
  const rowStats = {
    newDetails: 0,
    updatedDetails: 0,
    newCodes: 0,
    duplicatesMerged: 0,
  };

  const existingMap = buildNcSkillBaseMap(existing);
  const updatedKeys = new Set<string>();

  if (!worksheet) {
    return { accumulators, rowsRead: 0, rowStats };
  }

  const detailsCol = detection.columnMap.details;
  const ncCol = detection.columnMap.nc;
  const supplierCol = detection.columnMap.supplier;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= detection.dataStartRow) return;

    const detailsRaw =
      detailsCol !== undefined ? getCellValue(row, detailsCol) : "";
    const supplier =
      supplierCol !== undefined ? getCellValue(row, supplierCol) : "";
    const details = detailsRaw || supplier;
    const ncCode = ncCol !== undefined ? getCellValue(row, ncCol).trim() : "";

    if (!details || !ncCode) return;

    rowsRead += 1;
    const key = detailsKey(details, supplier);
    const prev = existingMap.get(key);
    const prevCodes = prev
      ? new Set(normalizeNcCodeStats(prev).map((s) => s.code))
      : new Set<string>();

    if (!prev) {
      rowStats.newDetails += 1;
    } else if (prevCodes.has(ncCode)) {
      rowStats.duplicatesMerged += 1;
    } else {
      rowStats.newCodes += 1;
      if (!updatedKeys.has(key)) {
        updatedKeys.add(key);
        rowStats.updatedDetails += 1;
      }
    }

    let acc = accumulators.get(key);
    if (!acc) {
      acc = { details, codeCounts: new Map() };
      accumulators.set(key, acc);
    }

    acc.codeCounts.set(ncCode, (acc.codeCounts.get(ncCode) || 0) + 1);
  });

  return { accumulators, rowsRead, rowStats };
}

function accumulatorsToEntries(
  accumulators: Map<string, RowAccumulator>
): NcSkillEntry[] {
  const entries: NcSkillEntry[] = [];
  for (const acc of accumulators.values()) {
    const stats: NcCodeStat[] = Array.from(acc.codeCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
    entries.push(finalizeNcSkillEntry(acc.details, stats));
  }
  return entries.sort((a, b) => a.details.localeCompare(b.details));
}

export function buildNcSkillBaseFromWorkbook(
  workbook: ExcelJS.Workbook,
  mode: "build" | "merge",
  existing: NcSkillEntry[] = []
): { entries: NcSkillEntry[]; stats: NcSkillBaseBuildStats } {
  const { accumulators, rowsRead, rowStats } = accumulateFromWorkbook(
    workbook,
    mode === "merge" ? existing : []
  );
  const fromFile = accumulatorsToEntries(accumulators);

  let resultMap: Map<string, NcSkillEntry>;

  if (mode === "build") {
    resultMap = buildNcSkillBaseMap(fromFile);
  } else {
    resultMap = buildNcSkillBaseMap(existing);
    for (const entry of fromFile) {
      upsertNcSkillEntry(resultMap, entry);
    }
  }

  const entries = Array.from(resultMap.values());

  return {
    entries,
    stats: {
      entryCount: entries.length,
      rowsRead,
      codesFound: countUniqueNcCodes(entries),
      newDetails: rowStats.newDetails,
      updatedDetails: rowStats.updatedDetails,
      newCodes: rowStats.newCodes,
      duplicatesMerged: rowStats.duplicatesMerged,
    },
  };
}

function mergeStatsToLog(stats: NcSkillBaseBuildStats) {
  return {
    entryCount: stats.entryCount,
    newParticulars: stats.newDetails,
    updatedParticulars: stats.updatedDetails,
    newDetails: stats.newDetails,
    updatedDetails: stats.updatedDetails,
    newCodes: stats.newCodes,
    duplicatesMerged: stats.duplicatesMerged,
  };
}

export { mergeStatsToLog };

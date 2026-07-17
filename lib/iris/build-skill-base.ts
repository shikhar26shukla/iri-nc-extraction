import ExcelJS from "exceljs";
import {
  getCellValue,
  parseSimpleSheet,
} from "@/lib/excel/reader";
import { normalizeParticular } from "@/lib/normalization/text";
import {
  buildIrisSkillBaseMap,
  countUniqueIrisCodes,
  finalizeIrisSkillEntry,
  normalizeIrisCodeStats,
  upsertIrisSkillEntry,
} from "@/lib/iris/skill-base";
import type { IrisCodeStat, IrisSkillEntry, SkillBaseBuildStats } from "@/types";

interface RowAccumulator {
  particular: string;
  codeCounts: Map<string, number>;
  typeCounts: Map<string, number>;
  notes?: string;
}

function pickMostFrequent(map: Map<string, number>): string | undefined {
  let best: string | undefined;
  let bestCount = 0;
  for (const [value, count] of map) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

function isDataRow(particular: string): boolean {
  const p = normalizeParticular(particular);
  if (!p) return false;
  if (p === "OPENING BALANCE" || p === "CLOSING BALANCE") return false;
  return true;
}

function accumulateFromWorkbook(
  workbook: ExcelJS.Workbook,
  existing: IrisSkillEntry[] = []
): {
  accumulators: Map<string, RowAccumulator>;
  rowsRead: number;
  rowStats: {
    newParticulars: number;
    updatedParticulars: number;
    newCodes: number;
    duplicatesMerged: number;
  };
} {
  const { detection } = parseSimpleSheet(workbook, "iris");
  const worksheet = workbook.worksheets[0];
  const accumulators = new Map<string, RowAccumulator>();
  let rowsRead = 0;
  const rowStats = {
    newParticulars: 0,
    updatedParticulars: 0,
    newCodes: 0,
    duplicatesMerged: 0,
  };

  const existingMap = buildIrisSkillBaseMap(existing);
  const updatedKeys = new Set<string>();

  if (!worksheet) {
    return { accumulators, rowsRead: 0, rowStats };
  }

  const particularCol = detection.columnMap.particular!;
  const irisCol = detection.columnMap.iris;
  const typeCol = detection.columnMap.type;
  const notesCol = detection.columnMap.notes;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= detection.dataStartRow) return;

    const particular = getCellValue(row, particularCol);
    if (!isDataRow(particular)) return;

    const irisCode =
      irisCol !== undefined ? getCellValue(row, irisCol).trim() : "";
    if (!irisCode) return;

    rowsRead += 1;
    const key = normalizeParticular(particular);
    const prev = existingMap.get(key);
    const prevCodes = prev
      ? new Set(normalizeIrisCodeStats(prev).map((s) => s.code))
      : new Set<string>();

    if (!prev) {
      rowStats.newParticulars += 1;
    } else if (prevCodes.has(irisCode)) {
      rowStats.duplicatesMerged += 1;
    } else {
      rowStats.newCodes += 1;
      if (!updatedKeys.has(key)) {
        updatedKeys.add(key);
        rowStats.updatedParticulars += 1;
      }
    }

    let acc = accumulators.get(key);
    if (!acc) {
      acc = {
        particular,
        codeCounts: new Map(),
        typeCounts: new Map(),
        notes: notesCol !== undefined ? getCellValue(row, notesCol) || undefined : undefined,
      };
      accumulators.set(key, acc);
    }

    acc.codeCounts.set(irisCode, (acc.codeCounts.get(irisCode) || 0) + 1);
    if (typeCol !== undefined) {
      const typeValue = getCellValue(row, typeCol).trim();
      if (typeValue) {
        acc.typeCounts.set(typeValue, (acc.typeCounts.get(typeValue) || 0) + 1);
      }
    }
    if (!acc.notes && notesCol !== undefined) {
      acc.notes = getCellValue(row, notesCol) || undefined;
    }
  });

  return { accumulators, rowsRead, rowStats };
}

function accumulatorsToEntries(
  accumulators: Map<string, RowAccumulator>
): IrisSkillEntry[] {
  const entries: IrisSkillEntry[] = [];
  for (const acc of accumulators.values()) {
    const stats: IrisCodeStat[] = Array.from(acc.codeCounts.entries())
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count);
    entries.push(
      finalizeIrisSkillEntry(acc.particular, stats, {
        type: pickMostFrequent(acc.typeCounts),
        notes: acc.notes,
      })
    );
  }
  return entries.sort((a, b) => a.particular.localeCompare(b.particular));
}

export function buildIrisSkillBaseFromWorkbook(
  workbook: ExcelJS.Workbook,
  mode: "build" | "merge",
  existing: IrisSkillEntry[] = []
): { entries: IrisSkillEntry[]; stats: SkillBaseBuildStats } {
  const { accumulators, rowsRead, rowStats } = accumulateFromWorkbook(
    workbook,
    mode === "merge" ? existing : []
  );
  const fromFile = accumulatorsToEntries(accumulators);

  let resultMap: Map<string, IrisSkillEntry>;

  if (mode === "build") {
    resultMap = buildIrisSkillBaseMap(fromFile);
  } else {
    resultMap = buildIrisSkillBaseMap(existing);
    for (const entry of fromFile) {
      upsertIrisSkillEntry(resultMap, entry);
    }
  }

  const entries = Array.from(resultMap.values());

  return {
    entries,
    stats: {
      entryCount: entries.length,
      rowsRead,
      codesFound: countUniqueIrisCodes(entries),
      newParticulars: rowStats.newParticulars,
      updatedParticulars: rowStats.updatedParticulars,
      newCodes: rowStats.newCodes,
      duplicatesMerged: rowStats.duplicatesMerged,
    },
  };
}

export function mergeRowsIntoSkillBase(
  existing: IrisSkillEntry[],
  rows: { particular: string; irisCode: string; type?: string; notes?: string }[]
): IrisSkillEntry[] {
  const map = buildIrisSkillBaseMap(existing);
  for (const row of rows) {
    if (!row.particular || !row.irisCode) continue;
    upsertIrisSkillEntry(map, {
      particular: row.particular,
      irisCode: row.irisCode,
      irisCodes: [{ code: row.irisCode, count: 1 }],
      type: row.type,
      notes: row.notes,
    });
  }
  return Array.from(map.values());
}

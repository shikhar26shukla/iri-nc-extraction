import ExcelJS from "exceljs";
import fs from "fs/promises";
import path from "path";
import Papa from "papaparse";
import type { ColumnMap, SheetDetection } from "@/types";

const PARTICULAR_ALIASES = ["particular", "particulars", "description", "narrative", "details", "payee"];
const DETAILS_ALIASES = ["details", "particular", "description", "narrative", "payee", "supplier"];
const NC_ALIASES = ["n/c", "nc", "nominal code", "nominal"];

export interface SimpleSheetResult {
  detection: SheetDetection;
  warnings: string[];
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object" && "text" in value && value.text) {
    return String(value.text).trim();
  }
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function findColumnIndex(headers: string[], aliases: string[]): number | undefined {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i] || "");
    if (!h) continue;
    for (const alias of aliases) {
      if (h === alias) return i;
      if (alias.length > 3 && h.includes(alias)) return i;
    }
  }
  return undefined;
}

function findIrisColumnIndex(headers: string[]): number | undefined {
  for (let i = 0; i < headers.length; i++) {
    const h = normalizeHeader(headers[i] || "");
    if (!h) continue;
    if (h.includes("iris") && h.includes("code")) return i;
    if (h === "iris") return i;
  }
  return undefined;
}

function looksLikeTransactionType(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (/^\d+([.,]\d+)?$/.test(v)) return false;
  if (v.length > 80) return false;
  return true;
}

function findTypeColumnIndex(
  worksheet: ExcelJS.Worksheet,
  headers: string[],
  particularIdx: number,
  headerRowNumber: number
): number | undefined {
  const byHeader = findColumnIndex(headers, [
    "type",
    "tran type",
    "transaction type",
  ]);
  if (byHeader !== undefined) return byHeader;

  const candidate = particularIdx - 1;
  if (candidate < 0) return undefined;

  const header = normalizeHeader(headers[candidate] || "");
  if (header && header !== "date") return undefined;

  let typedRows = 0;
  const sampleLimit = 8;
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRowNumber || typedRows >= sampleLimit) return;
    const value = cellText(row.getCell(candidate + 1).value);
    if (looksLikeTransactionType(value)) typedRows += 1;
  });

  return typedRows > 0 ? candidate : undefined;
}

function getHeaderRowAt(worksheet: ExcelJS.Worksheet, rowNumber: number): string[] {
  const row = worksheet.getRow(rowNumber);
  const headers: string[] = [];
  const colCount = Math.max(worksheet.columnCount, 20);
  for (let c = 1; c <= colCount; c++) {
    headers.push(cellText(row.getCell(c).value));
  }
  while (headers.length > 0 && !headers[headers.length - 1]) {
    headers.pop();
  }
  return headers;
}

const MAX_HEADER_SCAN_ROWS = 30;
const MIN_HEADER_SCORE = 3;

interface HeaderCandidate {
  sheetName: string;
  worksheet: ExcelJS.Worksheet;
  headerRowNumber: number;
  headers: string[];
  score: number;
  dataRowCount: number;
}

function scoreHeaderRow(headers: string[], mode: "iris" | "nc"): number {
  if (mode === "iris") {
    let score = 0;
    if (findColumnIndex(headers, PARTICULAR_ALIASES) !== undefined) score += 3;
    if (findIrisColumnIndex(headers) !== undefined) score += 2;
    if (
      findColumnIndex(headers, ["type", "tran type", "transaction type"]) !==
      undefined
    ) {
      score += 1;
    }
    if (findColumnIndex(headers, ["date"]) !== undefined) score += 1;
    return score;
  }

  let score = 0;
  if (findColumnIndex(headers, DETAILS_ALIASES) !== undefined) score += 3;
  if (findColumnIndex(headers, NC_ALIASES) !== undefined) score += 2;
  if (
    findColumnIndex(headers, ["supplier", "a/c ref", "account name"]) !== undefined
  ) {
    score += 1;
  }
  if (findColumnIndex(headers, ["tran no.", "tran no"]) !== undefined) score += 1;
  return score;
}

function countDataRows(worksheet: ExcelJS.Worksheet, headerRowNumber: number): number {
  let count = 0;
  worksheet.eachRow({ includeEmpty: false }, (_row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    count += 1;
  });
  return count;
}

function findBestHeaderCandidate(
  workbook: ExcelJS.Workbook,
  mode: "iris" | "nc"
): HeaderCandidate | null {
  let best: HeaderCandidate | null = null;

  for (const worksheet of workbook.worksheets) {
    const scanLimit = Math.min(MAX_HEADER_SCAN_ROWS, worksheet.rowCount || MAX_HEADER_SCAN_ROWS);
    for (let rowNumber = 1; rowNumber <= scanLimit; rowNumber++) {
      const headers = getHeaderRowAt(worksheet, rowNumber);
      if (!headers.some((h) => h)) continue;

      const score = scoreHeaderRow(headers, mode);
      if (score < MIN_HEADER_SCORE) continue;

      const dataRowCount = countDataRows(worksheet, rowNumber);
      if (
        !best ||
        score > best.score ||
        (score === best.score && dataRowCount > best.dataRowCount)
      ) {
        best = {
          sheetName: worksheet.name,
          worksheet,
          headerRowNumber: rowNumber,
          headers,
          score,
          dataRowCount,
        };
      }
    }
  }

  return best;
}

function getWorksheetByName(
  workbook: ExcelJS.Workbook,
  sheetName: string
): ExcelJS.Worksheet | undefined {
  return workbook.getWorksheet(sheetName) ?? workbook.worksheets.find((s) => s.name === sheetName);
}

export async function loadWorkbookBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook;
}

export async function loadWorkbookFromPath(filePath: string): Promise<ExcelJS.Workbook> {
  const buffer = await fs.readFile(filePath);
  return loadWorkbookBuffer(buffer);
}

export function parseSimpleSheet(
  workbook: ExcelJS.Workbook,
  mode: "iris" | "nc"
): SimpleSheetResult {
  const warnings: string[] = [];

  if (workbook.worksheets.length === 0) {
    throw new Error("Workbook has no sheets.");
  }

  const candidate = findBestHeaderCandidate(workbook, mode);
  if (!candidate) {
    if (mode === "iris") {
      throw new Error(
        "Could not find a Particular column (Particular, Particulars, Description, Narrative, or Payee). " +
          "Daybook exports may have report headers above the column row — ensure Details/Particular headers exist."
      );
    }
    throw new Error(
      "Could not find a Details column (Details, Particular, Description, Narrative, Payee, or Supplier). " +
        "Daybook exports may have report headers above the column row — ensure Details and N/C headers exist."
    );
  }

  const { worksheet, sheetName, headerRowNumber, headers } = candidate;
  const headerRowIndex = headerRowNumber - 1;
  const dataStartRow = headerRowNumber;

  if (headerRowNumber > 1 || sheetName !== workbook.worksheets[0]?.name) {
    warnings.push(
      `Auto-selected sheet "${sheetName}" with headers on row ${headerRowNumber} (${candidate.dataRowCount} data rows).`
    );
  }

  if (workbook.worksheets.length > 1 && sheetName === workbook.worksheets[0]?.name) {
    warnings.push(
      `File has ${workbook.worksheets.length} sheets. Using "${sheetName}" based on header detection.`
    );
  }

  if (mode === "iris") {
    const particularIdx = findColumnIndex(headers, PARTICULAR_ALIASES)!;

    return {
      warnings,
      detection: {
        sheetName,
        sheetType: "bank",
        headerRowIndex,
        dataStartRow,
        columnMap: {
          particular: particularIdx,
          iris: findIrisColumnIndex(headers),
          type: findTypeColumnIndex(worksheet, headers, particularIdx, headerRowNumber),
          notes: findColumnIndex(headers, ["notes", "category"]),
          date: findColumnIndex(headers, ["date"]),
        },
      },
    };
  }

  const detailsIdx = findColumnIndex(headers, DETAILS_ALIASES)!;

  let supplierIdx: number | undefined;
  const supplierHeaderIdx = findColumnIndex(headers, [
    "supplier",
    "a/c ref",
    "account name",
  ]);
  if (supplierHeaderIdx !== undefined) {
    supplierIdx = supplierHeaderIdx;
  } else if (detailsIdx > 0) {
    supplierIdx = detailsIdx - 1;
  }

  return {
    warnings,
    detection: {
      sheetName,
      sheetType: "expense",
      headerRowIndex,
      dataStartRow,
      columnMap: {
        details: detailsIdx,
        supplier: supplierIdx,
        nc: findColumnIndex(headers, NC_ALIASES),
        date: findColumnIndex(headers, ["date"]),
      },
    },
  };
}

export function getCellValue(row: ExcelJS.Row, colIndex: number | undefined): string {
  if (colIndex === undefined) return "";
  return cellText(row.getCell(colIndex + 1).value);
}

export function isCodedIrisFile(workbook: ExcelJS.Workbook): boolean {
  try {
    const { detection } = parseSimpleSheet(workbook, "iris");
    const irisCol = detection.columnMap.iris;
    if (irisCol === undefined) return false;

    const worksheet = getWorksheetByName(workbook, detection.sheetName);
    if (!worksheet) return false;

    let found = false;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (found || rowNumber <= detection.dataStartRow) return;
      const irisCode = getCellValue(row, irisCol).trim();
      if (irisCode) found = true;
    });
    return found;
  } catch {
    return false;
  }
}

export function isCodedNcFile(workbook: ExcelJS.Workbook): boolean {
  try {
    const { detection } = parseSimpleSheet(workbook, "nc");
    const ncCol = detection.columnMap.nc;
    if (ncCol === undefined) return false;

    const worksheet = getWorksheetByName(workbook, detection.sheetName);
    if (!worksheet) return false;

    let found = false;
    worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (found || rowNumber <= detection.dataStartRow) return;
      const ncCode = getCellValue(row, ncCol).trim();
      if (ncCode) found = true;
    });
    return found;
  } catch {
    return false;
  }
}

export async function parseCsvBuffer(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const text = buffer.toString("utf-8");
  const parsed = Papa.parse<string[]>(text, { skipEmptyLines: false });
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  parsed.data.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      sheet.getCell(rowIndex + 1, colIndex + 1).value = cell;
    });
  });
  return workbook;
}

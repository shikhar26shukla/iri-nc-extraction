import ExcelJS from "exceljs";
import type { IrisOutputRow, NcOutputRow, SheetDetection } from "@/types";

export function appendOutputColumn(
  worksheet: ExcelJS.Worksheet,
  detection: SheetDetection,
  columnTitle: string,
  valuesByRow: Map<number, { code: string; confidence?: number }>
): number {
  const headerRowNumber = detection.headerRowIndex + 1;
  const headerRow = worksheet.getRow(headerRowNumber);

  let outputCol = worksheet.columnCount + 1;
  for (let c = 1; c <= worksheet.columnCount; c++) {
    const val = String(headerRow.getCell(c).value || "").toLowerCase();
    if (val.includes(columnTitle.toLowerCase())) {
      outputCol = c;
      break;
    }
  }

  if (outputCol > worksheet.columnCount) {
    headerRow.getCell(outputCol).value = columnTitle;
    headerRow.getCell(outputCol).font = { bold: true };
  }

  for (const [rowIndex, result] of valuesByRow) {
    const row = worksheet.getRow(rowIndex);
    row.getCell(outputCol).value = result.code;
  }

  return outputCol;
}

export function appendConfidenceColumn(
  worksheet: ExcelJS.Worksheet,
  detection: SheetDetection,
  valuesByRow: Map<number, { confidence: number }>,
  afterCol: number
): void {
  const headerRowNumber = detection.headerRowIndex + 1;
  const headerRow = worksheet.getRow(headerRowNumber);
  const confidenceCol = afterCol + 1;

  headerRow.getCell(confidenceCol).value = "Confidence";
  headerRow.getCell(confidenceCol).font = { bold: true };

  for (const [rowIndex, result] of valuesByRow) {
    worksheet.getRow(rowIndex).getCell(confidenceCol).value = result.confidence;
  }
}

export async function workbookToBuffer(workbook: ExcelJS.Workbook): Promise<Buffer> {
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

export function buildOutputFilename(originalName: string, suffix: "IRIS" | "NC"): string {
  const base = originalName.replace(/\.(xlsx|xls|csv)$/i, "");
  return `${base}_${suffix}.xlsx`;
}

export async function buildIrisOutputWorkbook(rows: IrisOutputRow[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("IRIS Codes");

  const headerRow = sheet.getRow(1);
  headerRow.values = ["Particular", "IRIS Code", "Type", "Notes"];
  headerRow.font = { bold: true };

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 2);
    excelRow.values = [
      row.particular,
      row.irisCode,
      row.type || "",
      row.notes || "",
    ];
  });

  sheet.columns = [
    { width: 50 },
    { width: 14 },
    { width: 18 },
    { width: 24 },
  ];

  return workbook;
}

export async function buildNcOutputWorkbook(rows: NcOutputRow[]): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Nominal Codes");

  const headerRow = sheet.getRow(1);
  headerRow.values = ["Details", "N/C"];
  headerRow.font = { bold: true };

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(index + 2);
    excelRow.values = [row.details, row.nc];
  });

  sheet.columns = [{ width: 50 }, { width: 14 }];

  return workbook;
}

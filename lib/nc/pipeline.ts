import ExcelJS from "exceljs";
import {
  getCellValue,
  isCodedNcFile,
  loadWorkbookBuffer,
  parseCsvBuffer,
  parseSimpleSheet,
} from "@/lib/excel/reader";
import {
  buildNcOutputWorkbook,
  buildOutputFilename,
  workbookToBuffer,
} from "@/lib/excel/writer";
import { readCompanyKnowledgeBase } from "@/lib/companies/store";
import { writeNcSkillBaseWithSnapshot } from "@/lib/companies/nc-skill-base-versions";
import { buildNcSkillBaseFromWorkbook } from "@/lib/nc/build-skill-base";
import { mergeNcCodes } from "@/lib/nc/skill-base";
import { NcMatcher } from "@/lib/matching/nc-matcher";
import { callClaudeJson, getConfidenceThreshold, getMaxAiBatchSize } from "@/lib/ai/claude";
import { NC_SYSTEM_PROMPT, buildNcUserPrompt } from "@/lib/ai/nc-prompt";
import { normalizeDetails } from "@/lib/normalization/text";
import type {
  ExtractedRow,
  MatchResult,
  NcOutputRow,
  NcSkillEntry,
  ProcessedFileResult,
  ProcessingLog,
  SheetDetection,
} from "@/types";

interface AiNcResponse {
  id: number;
  code: string | null;
  confidence: number;
  reason?: string;
}

function extractNcRows(
  worksheet: ExcelJS.Worksheet,
  detection: SheetDetection
): ExtractedRow[] {
  const rows: ExtractedRow[] = [];
  const detailsCol = detection.columnMap.details;
  const supplierCol = detection.columnMap.supplier;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= detection.dataStartRow) return;

    const details = detailsCol !== undefined ? getCellValue(row, detailsCol) : "";
    const supplier =
      supplierCol !== undefined ? getCellValue(row, supplierCol) : "";
    const text = normalizeDetails(details, supplier);

    if (!text) return;

    rows.push({
      rowIndex: rowNumber,
      text: details || supplier,
      supplierName: supplier || undefined,
      existingCode: getCellValue(row, detection.columnMap.nc) || undefined,
    });
  });

  return rows;
}

async function resolveWithAi(
  matcher: NcMatcher,
  uncertain: ExtractedRow[]
): Promise<Map<number, MatchResult>> {
  const results = new Map<number, MatchResult>();
  const batchSize = getMaxAiBatchSize();

  for (let i = 0; i < uncertain.length; i += batchSize) {
    const batch = uncertain.slice(i, i + batchSize);
    const batchWithIds = batch.map((row, idx) => ({ ...row, id: i + idx }));
    const candidates: Record<number, NcSkillEntry[]> = {};

    for (const row of batchWithIds) {
      candidates[row.id] = matcher.getCandidates(row.text, row.supplierName);
    }

    const aiResults = await callClaudeJson<AiNcResponse[]>(
      NC_SYSTEM_PROMPT,
      buildNcUserPrompt(
        batchWithIds.map((r) => ({
          id: r.id,
          details: r.text,
          supplier: r.supplierName,
        })),
        candidates
      )
    );

    if (!aiResults) {
      for (const row of batchWithIds) {
        results.set(row.rowIndex, {
          code: null,
          confidence: 0,
          source: "unresolved",
          reason: "AI unavailable",
        });
      }
      continue;
    }

    for (const item of aiResults) {
      const row = batchWithIds.find((r) => r.id === item.id);
      if (!row) continue;
      if (item.code && item.confidence >= 0.5) {
        results.set(row.rowIndex, {
          code: String(item.code),
          confidence: item.confidence,
          source: "ai",
          reason: item.reason,
        });
      } else {
        results.set(row.rowIndex, {
          code: null,
          confidence: item.confidence ?? 0,
          source: "unresolved",
          reason: item.reason,
        });
      }
    }
  }

  return results;
}

function toOutputRow(row: ExtractedRow, match: MatchResult): NcOutputRow {
  const nc = mergeNcCodes(row.existingCode || match.code || "");
  return {
    details: row.text,
    nc,
  };
}

export async function processNcFile(
  buffer: Buffer,
  originalName: string,
  companyId: string
): Promise<ProcessedFileResult> {
  const ext = originalName.toLowerCase();
  const workbook =
    ext.endsWith(".csv")
      ? await parseCsvBuffer(buffer)
      : await loadWorkbookBuffer(buffer);

  const skillBase = await readCompanyKnowledgeBase<NcSkillEntry>(companyId, "nc");
  const threshold = getConfidenceThreshold();
  const matcher = new NcMatcher(skillBase, threshold);
  const codedFile = isCodedNcFile(workbook);

  const log: ProcessingLog = {
    rowsProcessed: 0,
    matchedLocally: 0,
    matchedByAI: 0,
    matchedFromSkillBase: 0,
    matchedFromSourceFile: 0,
    unresolved: 0,
    skippedSheets: [],
    processedSheets: [],
    errors: [],
    skillBaseUpdated: false,
  };

  const { detection, warnings } = parseSimpleSheet(workbook, "nc");
  log.errors.push(...warnings);

  const worksheet = workbook.getWorksheet(detection.sheetName);
  if (!worksheet) {
    log.errors.push("Could not read first sheet.");
    return {
      originalName,
      outputName: buildOutputFilename(originalName, "NC"),
      buffer: await workbookToBuffer(await buildNcOutputWorkbook([])),
      log,
    };
  }

  log.processedSheets.push(detection.sheetName);
  const extracted = extractNcRows(worksheet, detection);
  log.rowsProcessed = extracted.length;

  const uncertain: ExtractedRow[] = [];
  const resolved = new Map<number, MatchResult>();

  for (const row of extracted) {
    const match = matcher.match(row.text, row.supplierName);
    if (match.code && (match.source === "exact" || match.source === "fuzzy")) {
      log.matchedLocally += 1;
      log.matchedFromSkillBase = (log.matchedFromSkillBase || 0) + 1;
      resolved.set(row.rowIndex, match);
    } else {
      uncertain.push(row);
    }
  }

  if (uncertain.length > 0) {
    const aiResults = await resolveWithAi(matcher, uncertain);
    for (const row of uncertain) {
      const aiMatch = aiResults.get(row.rowIndex);
      if (aiMatch?.code) {
        log.matchedByAI += 1;
        log.matchedFromSkillBase = (log.matchedFromSkillBase || 0) + 1;
        resolved.set(row.rowIndex, aiMatch);
      } else if (row.existingCode) {
        log.matchedLocally += 1;
        log.matchedFromSourceFile = (log.matchedFromSourceFile || 0) + 1;
        resolved.set(row.rowIndex, {
          code: row.existingCode,
          confidence: 0.5,
          source: "source-file",
        });
      } else {
        log.unresolved += 1;
        resolved.set(row.rowIndex, aiMatch || {
          code: null,
          confidence: 0,
          source: "unresolved",
        });
      }
    }
  }

  const outputRows: NcOutputRow[] = extracted.map((row) => {
    const match = resolved.get(row.rowIndex)!;
    return toOutputRow(row, match);
  });

  if (codedFile) {
    const existing = await readCompanyKnowledgeBase<NcSkillEntry>(companyId, "nc");
    const { entries, stats } = buildNcSkillBaseFromWorkbook(workbook, "merge", existing);

    await writeNcSkillBaseWithSnapshot(companyId, entries, {
      source: "auto-merge",
      fileName: originalName,
      mergeStats: {
        entryCount: stats.entryCount,
        newParticulars: stats.newDetails,
        updatedParticulars: stats.updatedDetails,
        newDetails: stats.newDetails,
        updatedDetails: stats.updatedDetails,
        newCodes: stats.newCodes,
        duplicatesMerged: stats.duplicatesMerged,
      },
    });

    log.skillBaseUpdated = true;
    log.skillBaseMerge = {
      entryCount: stats.entryCount,
      newParticulars: stats.newDetails,
      updatedParticulars: stats.updatedDetails,
      newDetails: stats.newDetails,
      updatedDetails: stats.updatedDetails,
      newCodes: stats.newCodes,
      duplicatesMerged: stats.duplicatesMerged,
    };
  }

  const outputBuffer = await workbookToBuffer(await buildNcOutputWorkbook(outputRows));

  return {
    originalName,
    outputName: buildOutputFilename(originalName, "NC"),
    buffer: outputBuffer,
    log,
  };
}

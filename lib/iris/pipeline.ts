import {
  getCellValue,
  isCodedIrisFile,
  loadWorkbookBuffer,
  parseCsvBuffer,
  parseSimpleSheet,
} from "@/lib/excel/reader";
import {
  buildIrisOutputWorkbook,
  buildOutputFilename,
  workbookToBuffer,
} from "@/lib/excel/writer";
import { readCompanyKnowledgeBase } from "@/lib/companies/store";
import { writeIrisSkillBaseWithSnapshot } from "@/lib/companies/skill-base-versions";
import { buildIrisSkillBaseFromWorkbook } from "@/lib/iris/build-skill-base";
import { IrisMatcher } from "@/lib/matching/iris-matcher";
import { callClaudeJson, getConfidenceThreshold, getMaxAiBatchSize } from "@/lib/ai/claude";
import { IRIS_SYSTEM_PROMPT, buildIrisUserPrompt } from "@/lib/ai/iris-prompt";
import { normalizeParticular } from "@/lib/normalization/text";
import {
  mergeIrisCodes,
  normalizeIrisCodeStats,
} from "@/lib/iris/skill-base";
import type {
  ExtractedRow,
  IrisOutputRow,
  IrisSkillEntry,
  MatchResult,
  ProcessedFileResult,
  ProcessingLog,
  SheetDetection,
} from "@/types";
import ExcelJS from "exceljs";

interface AiIrisResponse {
  id: number;
  code: string | null;
  confidence: number;
  reason?: string;
}

function isDataRow(particular: string): boolean {
  const p = normalizeParticular(particular);
  if (!p) return false;
  if (p === "OPENING BALANCE") return false;
  if (p === "CLOSING BALANCE") return false;
  return true;
}

function extractIrisRows(
  worksheet: ExcelJS.Worksheet,
  detection: SheetDetection
): ExtractedRow[] {
  const rows: ExtractedRow[] = [];
  const col = detection.columnMap.particular;
  if (col === undefined) return rows;

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= detection.dataStartRow) return;
    const particular = getCellValue(row, col);
    if (!isDataRow(particular)) return;

    rows.push({
      rowIndex: rowNumber,
      text: particular,
      existingCode: getCellValue(row, detection.columnMap.iris) || undefined,
      existingType: getCellValue(row, detection.columnMap.type) || undefined,
      existingNotes: getCellValue(row, detection.columnMap.notes) || undefined,
    });
  });

  return rows;
}

async function resolveWithAi(
  matcher: IrisMatcher,
  uncertain: ExtractedRow[]
): Promise<Map<number, MatchResult>> {
  const results = new Map<number, MatchResult>();
  const batchSize = getMaxAiBatchSize();

  for (let i = 0; i < uncertain.length; i += batchSize) {
    const batch = uncertain.slice(i, i + batchSize);
    const batchWithIds = batch.map((row, idx) => ({ ...row, id: i + idx }));
    const candidates: Record<number, IrisSkillEntry[]> = {};

    for (const row of batchWithIds) {
      candidates[row.id] = matcher.getCandidates(row.text);
    }

    const aiResults = await callClaudeJson<AiIrisResponse[]>(
      IRIS_SYSTEM_PROMPT,
      buildIrisUserPrompt(
        batchWithIds.map((r) => ({ id: r.id, particular: r.text })),
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
        const candidate = candidates[row.id]?.find((c) => {
          const codes = normalizeIrisCodeStats(c).map((s) => s.code);
          return codes.includes(String(item.code));
        });
        results.set(row.rowIndex, {
          code: String(item.code),
          confidence: item.confidence,
          source: "ai",
          reason: item.reason,
          type: candidate?.type,
          notes: candidate?.notes,
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

function toOutputRow(row: ExtractedRow, match: MatchResult): IrisOutputRow {
  const irisCode =
    match.code && row.existingCode && match.code !== row.existingCode
      ? mergeIrisCodes(match.code, row.existingCode)
      : mergeIrisCodes(match.code || row.existingCode || "");
  return {
    particular: row.text,
    irisCode,
    type: row.existingType || match.type,
    notes: row.existingNotes || match.notes,
  };
}

export async function processIrisFile(
  buffer: Buffer,
  originalName: string,
  companyId: string
): Promise<ProcessedFileResult> {
  const ext = originalName.toLowerCase();
  const workbook =
    ext.endsWith(".csv")
      ? await parseCsvBuffer(buffer)
      : await loadWorkbookBuffer(buffer);

  const skillBase = await readCompanyKnowledgeBase<IrisSkillEntry>(companyId, "iris");
  const threshold = getConfidenceThreshold();
  const matcher = new IrisMatcher(skillBase, threshold);
  const codedFile = isCodedIrisFile(workbook);

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
    missingType: 0,
    skillBaseUpdated: false,
  };

  const { detection, warnings } = parseSimpleSheet(workbook, "iris");
  log.errors.push(...warnings);

  const worksheet = workbook.getWorksheet(detection.sheetName);
  if (!worksheet) {
    log.errors.push("Could not read first sheet.");
    const outputWorkbook = await buildIrisOutputWorkbook([]);
    return {
      originalName,
      outputName: buildOutputFilename(originalName, "IRIS"),
      buffer: await workbookToBuffer(outputWorkbook),
      log,
    };
  }

  log.processedSheets.push(detection.sheetName);
  const extracted = extractIrisRows(worksheet, detection);
  log.rowsProcessed = extracted.length;

  const uncertain: ExtractedRow[] = [];
  const resolved = new Map<number, MatchResult>();

  for (const row of extracted) {
    const match = matcher.match(row.text);
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

  const outputRows: IrisOutputRow[] = extracted.map((row) => {
    const match = resolved.get(row.rowIndex)!;
    const output = toOutputRow(row, match);
    if (output.irisCode && !output.type) {
      log.missingType = (log.missingType || 0) + 1;
    }
    return output;
  });

  if (codedFile) {
    const existing = await readCompanyKnowledgeBase<IrisSkillEntry>(companyId, "iris");
    const { entries, stats } = buildIrisSkillBaseFromWorkbook(workbook, "merge", existing);

    await writeIrisSkillBaseWithSnapshot(companyId, entries, {
      source: "auto-merge",
      fileName: originalName,
      mergeStats: {
        entryCount: stats.entryCount,
        newParticulars: stats.newParticulars,
        updatedParticulars: stats.updatedParticulars,
        newCodes: stats.newCodes,
        duplicatesMerged: stats.duplicatesMerged,
      },
    });

    log.skillBaseUpdated = true;
    log.skillBaseMerge = {
      entryCount: stats.entryCount,
      newParticulars: stats.newParticulars,
      updatedParticulars: stats.updatedParticulars,
      newCodes: stats.newCodes,
      duplicatesMerged: stats.duplicatesMerged,
    };
  }

  const outputBuffer = await workbookToBuffer(await buildIrisOutputWorkbook(outputRows));

  return {
    originalName,
    outputName: buildOutputFilename(originalName, "IRIS"),
    buffer: outputBuffer,
    log,
  };
}

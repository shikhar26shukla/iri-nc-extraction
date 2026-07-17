export interface IrisCodeStat {
  code: string;
  count: number;
}

export interface IrisSkillEntry {
  particular: string;
  irisCode: string;
  irisCodes?: IrisCodeStat[];
  type?: string;
  notes?: string;
}

export interface NcCodeStat {
  code: string;
  count: number;
}

export interface NcSkillEntry {
  details: string;
  nc: string;
  ncCodes?: NcCodeStat[];
}

export interface ProcessingLog {
  rowsProcessed: number;
  matchedLocally: number;
  matchedByAI: number;
  matchedFromSkillBase?: number;
  matchedFromSourceFile?: number;
  unresolved: number;
  skippedSheets: string[];
  processedSheets: string[];
  errors: string[];
  missingType?: number;
  skillBaseUpdated?: boolean;
  skillBaseMerge?: SkillBaseMergeStats;
}

export interface SkillBaseMergeStats {
  entryCount: number;
  newParticulars: number;
  updatedParticulars: number;
  newCodes: number;
  duplicatesMerged: number;
  newDetails?: number;
  updatedDetails?: number;
}

export interface MatchResult {
  code: string | null;
  confidence: number;
  source: "exact" | "fuzzy" | "ai" | "unresolved" | "source-file";
  reason?: string;
  type?: string;
  notes?: string;
}

export interface IrisOutputRow {
  particular: string;
  irisCode: string;
  type?: string;
  notes?: string;
}

export interface NcOutputRow {
  details: string;
  nc: string;
}

export interface Company {
  id: string;
  name: string;
  autoLearnIris?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillBaseVersion {
  version: number;
  createdAt: string;
  source: "build" | "merge" | "auto-merge" | "auto-learn" | "restore" | "upload" | "seed";
  entryCount: number;
  fileName?: string;
  mergeStats?: SkillBaseMergeStats;
}

export interface SkillBaseBuildStats {
  entryCount: number;
  rowsRead: number;
  codesFound: number;
  newParticulars: number;
  updatedParticulars: number;
  newCodes: number;
  duplicatesMerged: number;
}

export interface NcSkillBaseBuildStats {
  entryCount: number;
  rowsRead: number;
  codesFound: number;
  newDetails: number;
  updatedDetails: number;
  newCodes: number;
  duplicatesMerged: number;
}

export interface ProcessedFileResult {
  originalName: string;
  outputName: string;
  buffer: Buffer;
  log: ProcessingLog;
}

export interface ColumnMap {
  particular?: number;
  details?: number;
  supplier?: number;
  iris?: number;
  nc?: number;
  date?: number;
  payments?: number;
  receipts?: number;
  balance?: number;
  type?: number;
  notes?: number;
}

export interface SheetDetection {
  sheetName: string;
  sheetType: "bank" | "expense" | "skip";
  headerRowIndex: number;
  columnMap: ColumnMap;
  dataStartRow: number;
}

export interface ExtractedRow {
  rowIndex: number;
  text: string;
  supplierName?: string;
  existingCode?: string;
  existingType?: string;
  existingNotes?: string;
}

export type ServiceType = "iris" | "nc";

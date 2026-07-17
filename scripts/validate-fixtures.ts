import fs from "fs/promises";
import path from "path";
import ExcelJS from "exceljs";
import {
  readCompanyKnowledgeBase,
  writeCompanyKnowledgeBase,
} from "@/lib/companies/store";
import { countUniqueIrisCodes } from "@/lib/iris/skill-base";
import { processIrisFile } from "@/lib/iris/pipeline";
import { processNcFile } from "@/lib/nc/pipeline";
import type { IrisSkillEntry, NcSkillEntry } from "@/types";

const COMPANY_ID = "7033";
const MIN_UNIQUE_CODES = 10;
const MIN_NC_ENTRIES = 30;

async function createUncodedWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.getRow(1).values = ["Particulars", "Date"];
  sheet.getRow(2).values = ["Test Supplier Alpha", "2024-01-01"];
  sheet.getRow(3).values = ["Test Supplier Beta", "2024-01-02"];
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

async function createUncodedNcWorkbook(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Sheet1");
  sheet.getRow(1).values = ["Details", "A/C Ref", "Net Amount"];
  sheet.getRow(2).values = ["Office supplies", "SUP001", 100];
  sheet.getRow(3).values = ["Fuel purchase", "FUEL001", 200];
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

async function main() {
  const root = process.cwd();
  const irisFixture = path.join(root, "test7033.xlsx");
  const ncFixture = path.join(root, "docs", "7033NC.xlsx");
  const ncSampleFixture = path.join(root, "data", "fixtures", "nc-sample.xlsx");

  console.log("=== Auto-merge: empty KB + coded extract ===");
  await writeCompanyKnowledgeBase(COMPANY_ID, "iris", []);
  const emptyKb = await readCompanyKnowledgeBase<IrisSkillEntry>(COMPANY_ID, "iris");
  if (emptyKb.length !== 0) {
    console.error("FAIL: Could not clear skill base for auto-merge test");
    process.exit(1);
  }

  const irisBuffer = await fs.readFile(irisFixture);
  const irisResult = await processIrisFile(
    irisBuffer,
    "test7033.xlsx",
    COMPANY_ID
  );

  if (!irisResult.log.skillBaseUpdated) {
    console.error("FAIL: Coded extract did not update skill base");
    process.exit(1);
  }
  console.log("PASS: Coded extract updated skill base");

  const afterMerge = await readCompanyKnowledgeBase<IrisSkillEntry>(COMPANY_ID, "iris");
  if (afterMerge.length === 0) {
    console.error("FAIL: Skill base still empty after coded extract");
    process.exit(1);
  }
  console.log(`PASS: Skill base has ${afterMerge.length} entries after auto-merge`);

  if (!irisResult.log.skillBaseMerge || irisResult.log.skillBaseMerge.entryCount === 0) {
    console.error("FAIL: Missing skill base merge stats");
    process.exit(1);
  }
  console.log("PASS: Merge stats returned", irisResult.log.skillBaseMerge);

  console.log("\n=== Auto-merge: uncoded extract must not modify KB ===");
  const kbBeforeUncoded = await readCompanyKnowledgeBase<IrisSkillEntry>(COMPANY_ID, "iris");
  const uncodedBuffer = await createUncodedWorkbook();
  const uncodedResult = await processIrisFile(
    uncodedBuffer,
    "uncoded-test.xlsx",
    COMPANY_ID
  );
  const kbAfterUncoded = await readCompanyKnowledgeBase<IrisSkillEntry>(COMPANY_ID, "iris");

  if (uncodedResult.log.skillBaseUpdated) {
    console.error("FAIL: Uncoded extract modified skill base");
    process.exit(1);
  }
  if (kbAfterUncoded.length !== kbBeforeUncoded.length) {
    console.error("FAIL: Skill base entry count changed after uncoded extract");
    process.exit(1);
  }
  console.log("PASS: Uncoded extract did not modify skill base");

  const skillBase = afterMerge;
  const uniqueCodes = countUniqueIrisCodes(skillBase);
  const typedEntries = skillBase.filter((e) => e.type && e.type.trim()).length;

  console.log(`\n=== Skill base check ===`);
  console.log(`Entries: ${skillBase.length}, unique IRIS codes: ${uniqueCodes}, with type: ${typedEntries}`);

  if (uniqueCodes < MIN_UNIQUE_CODES) {
    console.error(`FAIL: Expected at least ${MIN_UNIQUE_CODES} unique IRIS codes, got ${uniqueCodes}`);
    process.exit(1);
  }
  console.log(`PASS: >= ${MIN_UNIQUE_CODES} unique IRIS codes`);

  if (typedEntries === 0) {
    console.error("FAIL: No skill base entries have Type populated");
    process.exit(1);
  }
  console.log(`PASS: ${typedEntries} skill base entries have Type`);

  console.log("\n=== IRIS extraction log (second pass — skill base matching) ===");
  const secondPass = await processIrisFile(
    irisBuffer,
    "test7033.xlsx",
    COMPANY_ID
  );
  console.log(JSON.stringify(secondPass.log, null, 2));

  const fromSkillBase = secondPass.log.matchedFromSkillBase || 0;
  if (fromSkillBase === 0) {
    console.error("FAIL: No rows matched from skill base on second extract");
    process.exit(1);
  }
  console.log(`PASS: ${fromSkillBase} rows matched from skill base`);

  const missingType = secondPass.log.missingType || 0;
  if (missingType > 0) {
    console.error(`FAIL: ${missingType} output rows missing Type`);
    process.exit(1);
  }
  console.log("PASS: All output rows have Type populated");

  const outDir = path.join(root, "tmp", "validation");
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, secondPass.outputName), secondPass.buffer);

  const outputWb = new ExcelJS.Workbook();
  await outputWb.xlsx.readFile(path.join(outDir, secondPass.outputName));
  const outputSheet = outputWb.worksheets[0];
  let outputMissingType = 0;
  outputSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const irisCode = String(row.getCell(2).value || "").trim();
    const type = String(row.getCell(3).value || "").trim();
    if (irisCode && !type) outputMissingType += 1;
  });
  if (outputMissingType > 0) {
    console.error(`FAIL: Output workbook has ${outputMissingType} rows without Type`);
    process.exit(1);
  }
  console.log("PASS: Output workbook Type column verified");

  console.log("\n=== NC auto-merge: empty KB + coded extract ===");
  await writeCompanyKnowledgeBase(COMPANY_ID, "nc", []);
  const emptyNcKb = await readCompanyKnowledgeBase<NcSkillEntry>(COMPANY_ID, "nc");
  if (emptyNcKb.length !== 0) {
    console.error("FAIL: Could not clear NC skill base for auto-merge test");
    process.exit(1);
  }

  let ncBuffer: Buffer;
  try {
    ncBuffer = await fs.readFile(ncFixture);
  } catch {
    console.error("FAIL: docs/7033NC.xlsx not found for NC auto-merge test");
    process.exit(1);
  }

  const ncResult = await processNcFile(ncBuffer, "7033NC.xlsx", COMPANY_ID);

  if (!ncResult.log.skillBaseUpdated) {
    console.error("FAIL: Coded NC extract did not update skill base");
    process.exit(1);
  }
  console.log("PASS: Coded NC extract updated skill base");

  const afterNcMerge = await readCompanyKnowledgeBase<NcSkillEntry>(COMPANY_ID, "nc");
  if (afterNcMerge.length < MIN_NC_ENTRIES) {
    console.error(
      `FAIL: Expected at least ${MIN_NC_ENTRIES} NC entries after auto-merge, got ${afterNcMerge.length}`
    );
    process.exit(1);
  }
  console.log(`PASS: NC skill base has ${afterNcMerge.length} entries after auto-merge`);

  if (!ncResult.log.skillBaseMerge || ncResult.log.skillBaseMerge.entryCount === 0) {
    console.error("FAIL: Missing NC skill base merge stats");
    process.exit(1);
  }
  console.log("PASS: NC merge stats returned", ncResult.log.skillBaseMerge);

  const ncOutputPath = path.join(outDir, ncResult.outputName);
  await fs.writeFile(ncOutputPath, ncResult.buffer);

  let outputMissingNc = 0;
  let outputRowsWithNc = 0;
  const ncOutputWb = new ExcelJS.Workbook();
  await ncOutputWb.xlsx.readFile(ncOutputPath);
  const ncOutputSheet = ncOutputWb.worksheets[0];
  ncOutputSheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const details = String(row.getCell(1).value || "").trim();
    const nc = String(row.getCell(2).value || "").trim();
    if (details && !nc) outputMissingNc += 1;
    if (nc) outputRowsWithNc += 1;
  });
  if (outputMissingNc > 0) {
    console.error(`FAIL: NC output workbook has ${outputMissingNc} rows without N/C`);
    process.exit(1);
  }
  if (outputRowsWithNc === 0) {
    console.error("FAIL: NC output workbook has no N/C codes populated");
    process.exit(1);
  }
  console.log(`PASS: NC output workbook has N/C populated (${outputRowsWithNc} rows)`);

  console.log("\n=== NC auto-merge: uncoded extract must not modify KB ===");
  const ncKbBeforeUncoded = await readCompanyKnowledgeBase<NcSkillEntry>(COMPANY_ID, "nc");
  const uncodedNcBuffer = await createUncodedNcWorkbook();
  const uncodedNcResult = await processNcFile(
    uncodedNcBuffer,
    "uncoded-nc-test.xlsx",
    COMPANY_ID
  );
  const ncKbAfterUncoded = await readCompanyKnowledgeBase<NcSkillEntry>(COMPANY_ID, "nc");

  if (uncodedNcResult.log.skillBaseUpdated) {
    console.error("FAIL: Uncoded NC extract modified skill base");
    process.exit(1);
  }
  if (ncKbAfterUncoded.length !== ncKbBeforeUncoded.length) {
    console.error("FAIL: NC skill base entry count changed after uncoded extract");
    process.exit(1);
  }
  console.log("PASS: Uncoded NC extract did not modify skill base");

  console.log("\n=== NC sample fixture (optional) ===");
  try {
    const ncSampleBuffer = await fs.readFile(ncSampleFixture);
    const ncSampleResult = await processNcFile(ncSampleBuffer, "nc-sample.xlsx", COMPANY_ID);
    console.log(JSON.stringify(ncSampleResult.log, null, 2));
    await fs.writeFile(
      path.join(outDir, ncSampleResult.outputName),
      ncSampleResult.buffer
    );
  } catch (err) {
    console.log("NC sample fixture skipped or failed:", err instanceof Error ? err.message : err);
  }

  console.log("\nOutput written to tmp/validation/");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

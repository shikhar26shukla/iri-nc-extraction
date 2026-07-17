import fs from "fs/promises";
import path from "path";
import {
  ensureCompany,
  readCompanyKnowledgeBase,
  writeCompanyKnowledgeBase,
} from "@/lib/companies/store";
import type { IrisSkillEntry, NcSkillEntry } from "@/types";

async function readLegacyKb<T>(type: "iris" | "nc"): Promise<T[]> {
  const filePath = path.join(process.cwd(), "knowledge-base", `${type}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

async function main() {
  const companyId = "7033";
  const companyName = "Forest Car Company Ltd";

  await ensureCompany(companyId, companyName);

  const iris = await readLegacyKb<IrisSkillEntry>("iris");
  const nc = await readLegacyKb<NcSkillEntry>("nc");

  const existingIris = await readCompanyKnowledgeBase<IrisSkillEntry>(companyId, "iris");
  const existingNc = await readCompanyKnowledgeBase<NcSkillEntry>(companyId, "nc");

  if (iris.length > 0 && existingIris.length === 0) {
    await writeCompanyKnowledgeBase(companyId, "iris", iris);
    console.log(`Migrated ${iris.length} IRIS entries`);
  } else {
    console.log(`IRIS: ${existingIris.length || iris.length} entries`);
  }

  if (nc.length > 0 && existingNc.length === 0) {
    await writeCompanyKnowledgeBase(companyId, "nc", nc);
    console.log(`Migrated ${nc.length} NC entries`);
  } else {
    console.log(`NC: ${existingNc.length || nc.length} entries`);
  }

  console.log("Migration complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

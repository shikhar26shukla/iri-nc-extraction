import {
  readCompanyKnowledgeBase,
  writeCompanyKnowledgeBase,
} from "@/lib/companies/store";
import {
  dbGetVersionEntries,
  dbInsertVersionSnapshot,
  dbListVersions,
} from "@/lib/db/queries/versions";
import type { IrisSkillEntry, SkillBaseVersion } from "@/types";

function nextIndexedVersion(versions: SkillBaseVersion[]): number {
  return versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1;
}

export async function listIrisVersions(
  companyId: string
): Promise<SkillBaseVersion[]> {
  return dbListVersions(companyId, "iris");
}

export async function snapshotIrisSkillBase(
  companyId: string,
  meta: Omit<SkillBaseVersion, "version" | "createdAt" | "entryCount">
): Promise<SkillBaseVersion | null> {
  const current = await readCompanyKnowledgeBase<IrisSkillEntry>(companyId, "iris");
  if (current.length === 0) return null;

  const indexed = await dbListVersions(companyId, "iris");
  const nextVersion = nextIndexedVersion(indexed);
  const createdAt = new Date().toISOString();

  await dbInsertVersionSnapshot({
    companyId,
    skillType: "iris",
    version: nextVersion,
    source: meta.source,
    fileName: meta.fileName,
    mergeStats: meta.mergeStats,
    entryCount: current.length,
    entries: current,
    inIndex: true,
    createdAt,
  });

  return {
    version: nextVersion,
    createdAt,
    entryCount: current.length,
    source: meta.source,
    fileName: meta.fileName,
    mergeStats: meta.mergeStats,
  };
}

export async function restoreIrisVersion(
  companyId: string,
  version: number
): Promise<{ restored: IrisSkillEntry[]; snapshot: SkillBaseVersion | null }> {
  const restored = await dbGetVersionEntries<IrisSkillEntry>(
    companyId,
    "iris",
    version
  );
  if (!restored) {
    throw new Error(`Version ${version} not found for company ${companyId}`);
  }

  const preRestoreSnapshot = await snapshotIrisSkillBase(companyId, {
    source: "restore",
    fileName: `before-restore-v${version}`,
  });

  await writeCompanyKnowledgeBase(companyId, "iris", restored);

  return { restored, snapshot: preRestoreSnapshot };
}

export async function writeIrisSkillBaseWithSnapshot(
  companyId: string,
  entries: IrisSkillEntry[],
  meta: Omit<SkillBaseVersion, "version" | "createdAt" | "entryCount">
): Promise<SkillBaseVersion> {
  const current = await readCompanyKnowledgeBase<IrisSkillEntry>(companyId, "iris");
  const indexed = await dbListVersions(companyId, "iris");
  const versionNum = nextIndexedVersion(indexed);
  const createdAt = new Date().toISOString();

  if (current.length > 0) {
    await dbInsertVersionSnapshot({
      companyId,
      skillType: "iris",
      version: versionNum,
      source: "upload",
      entryCount: current.length,
      entries: current,
      inIndex: false,
      createdAt,
    });
  }

  await writeCompanyKnowledgeBase(companyId, "iris", entries);

  const recordVersion = current.length > 0 ? versionNum + 1 : versionNum;
  await dbInsertVersionSnapshot({
    companyId,
    skillType: "iris",
    version: recordVersion,
    source: meta.source,
    fileName: meta.fileName,
    mergeStats: meta.mergeStats,
    entryCount: entries.length,
    entries,
    inIndex: true,
    createdAt,
  });

  return {
    version: recordVersion,
    createdAt,
    entryCount: entries.length,
    source: meta.source,
    fileName: meta.fileName,
    mergeStats: meta.mergeStats,
  };
}

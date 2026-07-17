import fs from "fs/promises";
import path from "path";
import {
  readCompanyKnowledgeBase,
  writeCompanyKnowledgeBase,
} from "@/lib/companies/store";
import type { IrisSkillEntry, SkillBaseMergeStats, SkillBaseVersion } from "@/types";

const COMPANIES_ROOT = path.join(process.cwd(), "data", "companies");

function versionsDir(companyId: string): string {
  return path.join(COMPANIES_ROOT, companyId, "iris-versions");
}

function versionsIndexPath(companyId: string): string {
  return path.join(versionsDir(companyId), "versions.json");
}

function versionSnapshotPath(companyId: string, version: number): string {
  return path.join(versionsDir(companyId), `v${version}.json`);
}

async function readVersionsIndex(companyId: string): Promise<SkillBaseVersion[]> {
  try {
    const raw = await fs.readFile(versionsIndexPath(companyId), "utf-8");
    return JSON.parse(raw) as SkillBaseVersion[];
  } catch {
    return [];
  }
}

async function writeVersionsIndex(
  companyId: string,
  versions: SkillBaseVersion[]
): Promise<void> {
  await fs.mkdir(versionsDir(companyId), { recursive: true });
  await fs.writeFile(
    versionsIndexPath(companyId),
    JSON.stringify(versions, null, 2),
    "utf-8"
  );
}

function nextVersionNumber(versions: SkillBaseVersion[]): number {
  return versions.length > 0 ? Math.max(...versions.map((v) => v.version)) + 1 : 1;
}

export async function listIrisVersions(
  companyId: string
): Promise<SkillBaseVersion[]> {
  const versions = await readVersionsIndex(companyId);
  return versions.sort((a, b) => b.version - a.version);
}

export async function snapshotIrisSkillBase(
  companyId: string,
  meta: Omit<SkillBaseVersion, "version" | "createdAt" | "entryCount">
): Promise<SkillBaseVersion | null> {
  const current = await readCompanyKnowledgeBase<IrisSkillEntry>(companyId, "iris");
  if (current.length === 0) return null;

  const versions = await readVersionsIndex(companyId);
  const nextVersion = nextVersionNumber(versions);

  const snapshot: SkillBaseVersion = {
    version: nextVersion,
    createdAt: new Date().toISOString(),
    entryCount: current.length,
    ...meta,
  };

  await fs.mkdir(versionsDir(companyId), { recursive: true });
  await fs.writeFile(
    versionSnapshotPath(companyId, nextVersion),
    JSON.stringify(current, null, 2),
    "utf-8"
  );

  versions.push(snapshot);
  await writeVersionsIndex(companyId, versions);
  return snapshot;
}

export async function restoreIrisVersion(
  companyId: string,
  version: number
): Promise<{ restored: IrisSkillEntry[]; snapshot: SkillBaseVersion | null }> {
  const snapshotPath = versionSnapshotPath(companyId, version);
  let restored: IrisSkillEntry[];
  try {
    const raw = await fs.readFile(snapshotPath, "utf-8");
    restored = JSON.parse(raw) as IrisSkillEntry[];
  } catch {
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
  const versions = await readVersionsIndex(companyId);
  const versionNum = nextVersionNumber(versions);

  await fs.mkdir(versionsDir(companyId), { recursive: true });

  if (current.length > 0) {
    await fs.writeFile(
      versionSnapshotPath(companyId, versionNum),
      JSON.stringify(current, null, 2),
      "utf-8"
    );
  }

  await writeCompanyKnowledgeBase(companyId, "iris", entries);

  const recordVersion = current.length > 0 ? versionNum + 1 : versionNum;
  await fs.writeFile(
    versionSnapshotPath(companyId, recordVersion),
    JSON.stringify(entries, null, 2),
    "utf-8"
  );

  const record: SkillBaseVersion = {
    version: recordVersion,
    createdAt: new Date().toISOString(),
    entryCount: entries.length,
    source: meta.source,
    fileName: meta.fileName,
    mergeStats: meta.mergeStats,
  };

  versions.push(record);
  await writeVersionsIndex(companyId, versions);
  return record;
}

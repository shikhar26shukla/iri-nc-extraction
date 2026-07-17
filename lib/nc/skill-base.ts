import { normalizeDetails } from "@/lib/normalization/text";
import type { NcCodeStat, NcSkillEntry } from "@/types";

export function mergeNcCodes(...codes: (string | null | undefined)[]): string {
  const unique: string[] = [];
  const seen = new Set<string>();

  for (const code of codes) {
    if (!code) continue;
    for (const part of String(code).split("/")) {
      const trimmed = part.trim();
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        unique.push(trimmed);
      }
    }
  }

  return unique.join("/");
}

export function normalizeNcCodeStats(entry: NcSkillEntry): NcCodeStat[] {
  if (entry.ncCodes && entry.ncCodes.length > 0) {
    return [...entry.ncCodes].sort((a, b) => b.count - a.count);
  }
  if (entry.nc) {
    return entry.nc.split("/").filter(Boolean).map((code) => ({
      code: code.trim(),
      count: 1,
    }));
  }
  return [];
}

export function mergeNcCodeStats(a: NcCodeStat[], b: NcCodeStat[]): NcCodeStat[] {
  const map = new Map<string, number>();
  for (const stat of [...a, ...b]) {
    map.set(stat.code, (map.get(stat.code) || 0) + stat.count);
  }
  return Array.from(map.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((x, y) => y.count - x.count);
}

export function formatNcCodeDisplay(stats: NcCodeStat[]): string {
  return stats.map((s) => s.code).join("/");
}

export function getPrimaryNcCode(entry: NcSkillEntry): string {
  const stats = normalizeNcCodeStats(entry);
  return stats[0]?.code || entry.nc || "";
}

export function finalizeNcSkillEntry(
  details: string,
  stats: NcCodeStat[]
): NcSkillEntry {
  const sorted = [...stats].sort((a, b) => b.count - a.count);
  return {
    details,
    ncCodes: sorted,
    nc: formatNcCodeDisplay(sorted),
  };
}

export function upsertNcSkillEntry(
  map: Map<string, NcSkillEntry>,
  entry: NcSkillEntry
): void {
  const key = normalizeDetails(entry.details);
  if (!key) return;

  const incomingStats = normalizeNcCodeStats(entry);
  const existing = map.get(key);

  if (!existing) {
    map.set(key, finalizeNcSkillEntry(entry.details, incomingStats));
    return;
  }

  const mergedStats = mergeNcCodeStats(
    normalizeNcCodeStats(existing),
    incomingStats
  );

  map.set(key, finalizeNcSkillEntry(existing.details, mergedStats));
}

export function buildNcSkillBaseMap(
  entries: NcSkillEntry[]
): Map<string, NcSkillEntry> {
  const map = new Map<string, NcSkillEntry>();
  for (const entry of entries) {
    upsertNcSkillEntry(map, entry);
  }
  return map;
}

export function countUniqueNcCodes(entries: NcSkillEntry[]): number {
  const codes = new Set<string>();
  for (const entry of entries) {
    for (const stat of normalizeNcCodeStats(entry)) {
      codes.add(stat.code);
    }
  }
  return codes.size;
}

export function detailsKey(details: string, supplier?: string): string {
  return normalizeDetails(details, supplier);
}

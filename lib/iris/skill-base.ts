import { normalizeParticular } from "@/lib/normalization/text";
import type { IrisCodeStat, IrisSkillEntry } from "@/types";

/** Combine IRIS codes with `/` when the same particular maps to more than one code. */
export function mergeIrisCodes(...codes: (string | null | undefined)[]): string {
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

export function normalizeIrisCodeStats(entry: IrisSkillEntry): IrisCodeStat[] {
  if (entry.irisCodes && entry.irisCodes.length > 0) {
    return [...entry.irisCodes].sort((a, b) => b.count - a.count);
  }
  if (entry.irisCode) {
    return entry.irisCode.split("/").filter(Boolean).map((code) => ({
      code: code.trim(),
      count: 1,
    }));
  }
  return [];
}

export function mergeIrisCodeStats(
  a: IrisCodeStat[],
  b: IrisCodeStat[]
): IrisCodeStat[] {
  const map = new Map<string, number>();
  for (const stat of [...a, ...b]) {
    map.set(stat.code, (map.get(stat.code) || 0) + stat.count);
  }
  return Array.from(map.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((x, y) => y.count - x.count);
}

export function formatIrisCodeDisplay(stats: IrisCodeStat[]): string {
  return stats.map((s) => s.code).join("/");
}

export function getPrimaryIrisCode(entry: IrisSkillEntry): string {
  const stats = normalizeIrisCodeStats(entry);
  return stats[0]?.code || entry.irisCode || "";
}

export function finalizeIrisSkillEntry(
  particular: string,
  stats: IrisCodeStat[],
  extras?: { type?: string; notes?: string }
): IrisSkillEntry {
  const sorted = [...stats].sort((a, b) => b.count - a.count);
  return {
    particular,
    irisCodes: sorted,
    irisCode: formatIrisCodeDisplay(sorted),
    type: extras?.type,
    notes: extras?.notes,
  };
}

export function upsertIrisSkillEntry(
  map: Map<string, IrisSkillEntry>,
  entry: IrisSkillEntry
): void {
  const key = normalizeParticular(entry.particular);
  if (!key) return;

  const incomingStats = normalizeIrisCodeStats(entry);
  const existing = map.get(key);

  if (!existing) {
    map.set(
      key,
      finalizeIrisSkillEntry(entry.particular, incomingStats, {
        type: entry.type,
        notes: entry.notes,
      })
    );
    return;
  }

  const mergedStats = mergeIrisCodeStats(
    normalizeIrisCodeStats(existing),
    incomingStats
  );

  map.set(
    key,
    finalizeIrisSkillEntry(existing.particular, mergedStats, {
      type: existing.type || entry.type,
      notes: existing.notes || entry.notes,
    })
  );
}

export function buildIrisSkillBaseMap(
  entries: IrisSkillEntry[]
): Map<string, IrisSkillEntry> {
  const map = new Map<string, IrisSkillEntry>();
  for (const entry of entries) {
    upsertIrisSkillEntry(map, entry);
  }
  return map;
}

export function countUniqueIrisCodes(entries: IrisSkillEntry[]): number {
  const codes = new Set<string>();
  for (const entry of entries) {
    for (const stat of normalizeIrisCodeStats(entry)) {
      codes.add(stat.code);
    }
  }
  return codes.size;
}

import Fuse from "fuse.js";
import type { IrisSkillEntry, MatchResult } from "@/types";
import {
  buildIrisSkillBaseMap,
  formatIrisCodeDisplay,
  getPrimaryIrisCode,
  normalizeIrisCodeStats,
} from "@/lib/iris/skill-base";
import { fuzzyScore, normalizeParticular } from "@/lib/normalization/text";

function matchCodeFromEntry(entry: IrisSkillEntry): string {
  const stats = normalizeIrisCodeStats(entry);
  if (stats.length <= 1) {
    return getPrimaryIrisCode(entry);
  }
  if (stats.length >= 2 && stats[0].count === stats[1].count) {
    return formatIrisCodeDisplay(stats);
  }
  return stats[0].code;
}

export class IrisMatcher {
  private exactMap = new Map<string, IrisSkillEntry>();
  private fuse: Fuse<IrisSkillEntry>;
  private threshold: number;

  constructor(entries: IrisSkillEntry[], threshold = 0.85) {
    this.threshold = threshold;
    this.exactMap = buildIrisSkillBaseMap(entries);
    this.fuse = new Fuse(Array.from(this.exactMap.values()), {
      keys: ["particular"],
      threshold: 0.4,
      includeScore: true,
    });
  }

  hasExactMatch(text: string): boolean {
    return this.exactMap.has(normalizeParticular(text));
  }

  getEntry(text: string): IrisSkillEntry | undefined {
    return this.exactMap.get(normalizeParticular(text));
  }

  match(text: string): MatchResult {
    const normalized = normalizeParticular(text);
    if (!normalized) {
      return { code: null, confidence: 0, source: "unresolved" };
    }

    const exact = this.exactMap.get(normalized);
    if (exact) {
      return {
        code: matchCodeFromEntry(exact),
        confidence: 1,
        source: "exact",
        type: exact.type,
        notes: exact.notes,
      };
    }

    let best: { entry: IrisSkillEntry; score: number } | null = null;
    for (const [key, entry] of this.exactMap) {
      const score = fuzzyScore(normalized, key);
      if (!best || score > best.score) {
        best = { entry, score };
      }
    }

    const fuseResults = this.fuse.search(text).slice(0, 3);
    for (const result of fuseResults) {
      const score = 1 - (result.score ?? 1);
      if (!best || score > best.score) {
        best = { entry: result.item, score };
      }
    }

    if (best && best.score >= this.threshold) {
      return {
        code: matchCodeFromEntry(best.entry),
        confidence: best.score,
        source: "fuzzy",
        type: best.entry.type,
        notes: best.entry.notes,
      };
    }

    return {
      code: null,
      confidence: best?.score ?? 0,
      source: "unresolved",
    };
  }

  getCandidates(text: string, limit = 5): IrisSkillEntry[] {
    return this.fuse.search(text).slice(0, limit).map((r) => r.item);
  }
}

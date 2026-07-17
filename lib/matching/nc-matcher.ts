import Fuse from "fuse.js";
import type { MatchResult, NcSkillEntry } from "@/types";
import { fuzzyScore, normalizeDetails } from "@/lib/normalization/text";

export class NcMatcher {
  private exactMap = new Map<string, NcSkillEntry>();
  private fuse: Fuse<NcSkillEntry>;
  private threshold: number;

  constructor(entries: NcSkillEntry[], threshold = 0.85) {
    this.threshold = threshold;
    for (const entry of entries) {
      const key = normalizeDetails(entry.details);
      if (key && !this.exactMap.has(key)) {
        this.exactMap.set(key, entry);
      }
    }
    this.fuse = new Fuse(entries, {
      keys: ["details"],
      threshold: 0.35,
      includeScore: true,
    });
  }

  match(text: string, fallbackSupplier?: string): MatchResult {
    const normalized = normalizeDetails(text, fallbackSupplier);
    if (!normalized) {
      return { code: null, confidence: 0, source: "unresolved" };
    }

    const exact = this.exactMap.get(normalized);
    if (exact) {
      return {
        code: String(exact.nc),
        confidence: 1,
        source: "exact",
      };
    }

    let best: { entry: NcSkillEntry; score: number } | null = null;
    for (const [key, entry] of this.exactMap) {
      const score = fuzzyScore(normalized, key);
      if (!best || score > best.score) {
        best = { entry, score };
      }
    }

    const fuseResults = this.fuse.search(normalized).slice(0, 3);
    for (const result of fuseResults) {
      const score = 1 - (result.score ?? 1);
      if (!best || score > best.score) {
        best = { entry: result.item, score };
      }
    }

    if (best && best.score >= this.threshold) {
      return {
        code: String(best.entry.nc),
        confidence: best.score,
        source: "fuzzy",
      };
    }

    return {
      code: null,
      confidence: best?.score ?? 0,
      source: "unresolved",
    };
  }

  getCandidates(text: string, fallbackSupplier?: string, limit = 5): NcSkillEntry[] {
    const query = normalizeDetails(text, fallbackSupplier);
    return this.fuse.search(query).slice(0, limit).map((r) => r.item);
  }
}

import type { IrisSkillEntry } from "@/types";

export const IRIS_SYSTEM_PROMPT = `You are an IRIS code assignment assistant for UK accounting bank statements.
You ONLY assign IRIS codes for bank transaction particulars.
Return strict JSON only — no markdown, no explanation outside JSON.
If uncertain, return code as null and low confidence.`;

export function buildIrisUserPrompt(
  rows: { id: number; particular: string }[],
  candidates: Record<number, IrisSkillEntry[]>
): string {
  const payload = rows.map((row) => ({
    id: row.id,
    particular: row.particular,
    candidates: (candidates[row.id] || []).map((c) => ({
      particular: c.particular,
      irisCode: c.irisCode,
      type: c.type,
    })),
  }));

  return `Assign IRIS codes for these uncertain bank particulars.
Use candidates when appropriate. Prefer exact semantic matches.

Return JSON array:
[{ "id": number, "code": string|null, "confidence": number, "reason": string }]

Rows:
${JSON.stringify(payload, null, 2)}`;
}

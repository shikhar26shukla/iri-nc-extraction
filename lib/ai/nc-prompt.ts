import type { NcSkillEntry } from "@/types";

export const NC_SYSTEM_PROMPT = `You are a Nominal Code (N/C) assignment assistant for UK purchase day books and expense sheets.
You ONLY assign nominal codes based on supplier/details text.
Return strict JSON only — no markdown, no explanation outside JSON.
If uncertain, return code as null and low confidence.`;

export function buildNcUserPrompt(
  rows: { id: number; details: string; supplier?: string }[],
  candidates: Record<number, NcSkillEntry[]>
): string {
  const payload = rows.map((row) => ({
    id: row.id,
    details: row.details,
    supplier: row.supplier,
    candidates: (candidates[row.id] || []).map((c) => ({
      details: c.details,
      nc: c.nc,
    })),
  }));

  return `Assign Nominal Codes for these uncertain expense rows.
Use candidates when appropriate. Supplier name is authoritative when Details is empty.

Return JSON array:
[{ "id": number, "code": string|null, "confidence": number, "reason": string }]

Rows:
${JSON.stringify(payload, null, 2)}`;
}

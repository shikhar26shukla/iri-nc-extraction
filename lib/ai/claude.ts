import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.includes("your-key-here")) return null;
  if (!client) {
    client = new Anthropic({ apiKey });
  }
  return client;
}

export function isApiKeyConfigured(): boolean {
  return getAnthropicClient() !== null;
}

export function getClaudeModel(): string {
  return process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
}

export function getConfidenceThreshold(): number {
  const val = parseFloat(process.env.MATCH_CONFIDENCE_THRESHOLD || "0.85");
  return Number.isFinite(val) ? val : 0.85;
}

export function getMaxAiBatchSize(): number {
  const val = parseInt(process.env.MAX_AI_BATCH_SIZE || "25", 10);
  return Number.isFinite(val) ? val : 25;
}

export async function callClaudeJson<T>(
  systemPrompt: string,
  userPrompt: string
): Promise<T | null> {
  const anthropic = getAnthropicClient();
  if (!anthropic) return null;

  const response = await anthropic.messages.create({
    model: getClaudeModel(),
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  const jsonMatch = textBlock.text.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    return null;
  }
}

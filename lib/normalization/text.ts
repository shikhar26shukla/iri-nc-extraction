export function normalizeText(raw: string): string {
  return raw
    .replace(/\t/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function normalizeParticular(raw: string): string {
  return normalizeText(raw);
}

export function normalizeDetails(
  raw: string | null | undefined,
  fallbackSupplier?: string | null
): string {
  const primary = raw ? normalizeText(String(raw)) : "";
  if (primary) return primary;
  if (fallbackSupplier) return normalizeText(String(fallbackSupplier));
  return "";
}

export function tokenOverlapScore(a: string, b: string): number {
  const tokensA = new Set(a.split(" ").filter(Boolean));
  const tokensB = new Set(b.split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let overlap = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) overlap += 1;
  }

  return overlap / Math.max(tokensA.size, tokensB.size);
}

export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

export function fuzzyScore(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshteinDistance(a, b);
  const levenshteinSim = 1 - distance / maxLen;
  const tokenSim = tokenOverlapScore(a, b);

  return Math.max(levenshteinSim, tokenSim);
}

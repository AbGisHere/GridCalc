import type { ErrorCode } from './values';

/**
 * A formula problem found before evaluation (syntax, unknown function, wrong arity, bad reference).
 * Positions index into the raw formula text, including the leading '='.
 */
export interface Diagnostic {
  code: ErrorCode;
  message: string;
  start: number;
  end: number;
  /** Human readable advice, e.g. "Add ')' at the end of the formula." */
  suggestion?: string;
  /** A complete corrected formula, verified to parse, that the UI can offer as a one-click fix. */
  fix?: string;
  /** A secondary location, e.g. the '(' that was never closed. */
  related?: { start: number; end: number; label: string };
}

/** Builds the "   ^~~~" line that sits under a formula to point at the problem. */
export function caretLine(start: number, end: number): string {
  const width = Math.max(1, end - start);
  return ' '.repeat(Math.max(0, start)) + '^' + '~'.repeat(width - 1);
}

/** Plain-text rendering, matching the format in the problem statement. */
export function formatDiagnostic(formula: string, d: Pick<Diagnostic, 'message' | 'start' | 'end' | 'suggestion'>): string {
  const lines = [`Formula: ${formula}`, `Error: ${d.message}`, formula, caretLine(d.start, d.end)];
  if (d.suggestion) lines.push(`Suggestion: ${d.suggestion}`);
  return lines.join('\n');
}

/** Levenshtein distance, used for "Did you mean …?" suggestions. */
function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}

export function closestName(name: string, candidates: Iterable<string>): string | undefined {
  const upper = name.toUpperCase();
  const limit = upper.length <= 3 ? 1 : upper.length <= 6 ? 2 : 3;
  let best: string | undefined;
  let bestDist = Infinity;
  for (const c of candidates) {
    const d = editDistance(upper, c);
    if (d < bestDist || (d === bestDist && best && c.length < best.length)) {
      best = c;
      bestDist = d;
    }
  }
  return bestDist <= limit ? best : undefined;
}

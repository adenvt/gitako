/**
 * Intra-line word diff for paired edit rows. Tokenizes each line into words
 * (whitespace kept as separate tokens, punctuation rides with the adjacent
 * word) and finds the LCS so only the genuinely changed tokens light up.
 *
 * Lives in the diff feature because only the diff view uses it.
 */

export interface DiffSegment {
  text: string;
  /** True when this run is part of the change (removed on old, added on new). */
  changed: boolean;
}

export interface WordDiffResult {
  /** Segments for the old line; changed = removed words. */
  oldSegs: DiffSegment[];
  /** Segments for the new line; changed = added words. */
  newSegs: DiffSegment[];
}

/** Split into tokens, keeping the whitespace separators as tokens. */
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

/** Merge adjacent runs with the same changed flag. */
function mergeSegs(tokens: string[], changed: boolean[]): DiffSegment[] {
  const segs: DiffSegment[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const last = segs[segs.length - 1];
    if (last && last.changed === changed[i]) {
      last.text += tokens[i];
    } else {
      segs.push({ text: tokens[i], changed: changed[i] });
    }
  }
  return segs;
}

/**
 * Classic O(n·m) LCS DP over token arrays. Returns for each token of `a`
 * whether it participates in the LCS (and therefore is unchanged).
 */
function lcsMatches(a: string[], b: string[]): boolean[] {
  const n = a.length;
  const m = b.length;
  // dp[i][j] = LCS length of a[i..] and b[j..].
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] =
        a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  // Walk the table to recover which tokens of `a` are in the LCS.
  const inLcs = new Array<boolean>(n).fill(false);
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      inLcs[i] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i++;
    } else {
      j++;
    }
  }
  return inLcs;
}

export function diffWords(oldText: string, newText: string): WordDiffResult {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  const oldInLcs = lcsMatches(oldTokens, newTokens);
  const newInLcs = lcsMatches(newTokens, oldTokens);
  return {
    oldSegs: mergeSegs(oldTokens, oldInLcs.map((v) => !v)),
    newSegs: mergeSegs(newTokens, newInLcs.map((v) => !v)),
  };
}

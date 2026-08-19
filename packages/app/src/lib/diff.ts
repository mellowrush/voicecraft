export type DiffSegment = { type: "same" | "add" | "del"; text: string };

// Word-level diff (whitespace-preserving tokens) via a classic LCS backtrace —
// good enough for showing what changed between an original and a rewrite,
// not a general-purpose diffing library.
// The LCS table below is O(n*m); past this many cells, fall back to a
// coarse whole-block diff rather than freezing the UI thread on long pastes.
const MAX_LCS_CELLS = 4_000_000;

export function wordDiff(before: string, after: string): DiffSegment[] {
  const a = before.split(/(\s+)/).filter((t) => t.length > 0);
  const b = after.split(/(\s+)/).filter((t) => t.length > 0);
  const n = a.length;
  const m = b.length;

  if (n * m > MAX_LCS_CELLS) {
    const segments: DiffSegment[] = [];
    if (before) segments.push({ type: "del", text: before });
    if (after) segments.push({ type: "add", text: after });
    return segments;
  }

  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const segments: DiffSegment[] = [];
  const push = (type: DiffSegment["type"], text: string) => {
    const last = segments[segments.length - 1];
    if (last && last.type === type) {
      last.text += text;
    } else {
      segments.push({ type, text });
    }
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push("same", a[i]);
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push("del", a[i]);
      i++;
    } else {
      push("add", b[j]);
      j++;
    }
  }
  while (i < n) push("del", a[i++]);
  while (j < m) push("add", b[j++]);

  return segments;
}

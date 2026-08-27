/** Human label for a `git show --name-status` status letter. */
const STATUS_LABELS: Record<string, string> = {
  A: "Added",
  M: "Modified",
  D: "Deleted",
  R: "Renamed",
  C: "Copied",
  T: "Type changed",
  U: "Unmerged",
  X: "Unknown",
  B: "Broken",
};

/** Resolve a status letter (possibly with a score, e.g. "R100") to a label. */
export function statusLabel(status: string): string {
  return STATUS_LABELS[status[0]] ?? status;
}

/** A single file in the working tree, parsed from `git status --porcelain=v1`. */
export interface StatusEntry {
  /** Index status letter (staged), or "." when unchanged in the index. */
  index: string;
  /** Worktree status letter, or "." when unchanged in the worktree. */
  worktree: string;
  /** Path relative to the repo root. */
  path: string;
  /** For renames/copies: the original path. */
  oldPath: string | null;
}

/** Normalize a porcelain status char: space = unchanged, ? = untracked (added). */
function norm(c: string): string {
  if (c === " " || c === ".") return ".";
  if (c === "?") return "A";
  return c;
}

/**
 * Parse `git status --porcelain=v1` output. Format per line:
 * `<XY> <path>` or `<XY> <old> -> <new>` for renames.
 *
 * Spaces (unchanged) are normalized to ".", and untracked `?` to "A", so
 * callers can rely on `.` meaning unchanged and a real letter otherwise.
 */
export function parsePorcelain(stdout: string): StatusEntry[] {
  const entries: StatusEntry[] = [];
  for (const line of stdout.split("\n")) {
    if (line.length < 4) continue;
    const xy = line.slice(0, 2);
    const rest = line.slice(3);
    const arrow = rest.indexOf(" -> ");
    if (arrow !== -1) {
      const oldPath = rest.slice(0, arrow);
      const path = rest.slice(arrow + 4);
      entries.push({
        index: norm(xy[0]),
        worktree: norm(xy[1]),
        path,
        oldPath,
      });
    } else {
      entries.push({
        index: norm(xy[0]),
        worktree: norm(xy[1]),
        path: rest,
        oldPath: null,
      });
    }
  }
  return entries;
}

/** Count of files with any change (staged or unstaged). */
export function countChanges(entries: StatusEntry[]): number {
  return entries.filter(
    (e) => e.index !== "." || e.worktree !== ".",
  ).length;
}

/** Counts of working-tree changes grouped by kind. */
export interface WorkingCounts {
  added: number;
  deleted: number;
  modified: number;
}

/**
 * Group working-tree entries by kind. Staged wins when both statuses differ
 * (e.g. "AM" counts as added).
 */
export function countByKind(entries: StatusEntry[]): WorkingCounts {
  const counts: WorkingCounts = { added: 0, deleted: 0, modified: 0 };
  for (const e of entries) {
    const st = e.index !== "." ? e.index : e.worktree;
    if (st === "A") counts.added++;
    else if (st === "D") counts.deleted++;
    else counts.modified++;
  }
  return counts;
}

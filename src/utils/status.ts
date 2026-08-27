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

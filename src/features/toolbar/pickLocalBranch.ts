/**
 * Pick the local branch name to show in the toolbar from a list of ref
 * strings. The first ref that does NOT contain a `/` is treated as the
 * local branch (remote branches are always `remote/name`); when none
 * qualify, the user is in detached-HEAD state and we show a placeholder.
 *
 * NOTE: This helper is for string refs from a commit's `refs` field, not
 * the structured `RefInfo[]` that `BranchSwitcher` consumes. The UI now
 * uses `RefInfo.isHead` instead; this helper remains for legacy tests.
 */
export function pickLocalBranch(refs: string[]): string {
  return refs.find((r) => !r.includes("/")) ?? "detached HEAD";
}

/** Mirrors the Rust structs returned by Tauri commands. */

export interface Commit {
  hash: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  authorTime: number;
  subject: string;
  refs: string[];
  /** True for stash entries ("On <branch>: WIP on <branch>: ..."). Set in the
   * store on fetch; used by the graph renderer to draw an outline + dashed
   * edges instead of the default filled dot. */
  isStash?: boolean;
}

/** A file changed by a commit, from `git show --name-status`. */
export interface ChangedFile {
  status: string;
  path: string;
  oldPath: string | null;
}

export type RefKind = "branch" | "remoteBranch" | "tag" | "head" | "other";

export interface RefInfo {
  name: string;
  fullName: string;
  kind: RefKind;
  target: string;
  commit: string;
  /** Remote name for remote branches; null otherwise. */
  remote: string | null;
  /** First remote URL from `git remote get-url`; null when unavailable. */
  remoteUrl: string | null;
}

export interface GitErrorPayload {
  kind: "notFound" | "notARepo" | "conflict" | "other";
  message: string;
  code: number | null;
}

/** Mirrors the Rust `PushResult` returned by `git_push`. */
export interface PushResult {
  remote: string;
  branch: string;
  summary: string;
}

/** Pull strategy, mirrors the Rust `PullMode` enum. */
export type PullMode = "ff" | "ffOnly" | "rebase";

/** Mirrors the Rust `PullResult` returned by `git_fetch` / `git_pull`. */
export interface PullResult {
  remote: string;
  branch: string;
  summary: string;
}

/** Mirrors the Rust git::diff structs. */
export type DiffLineKind = "context" | "add" | "remove";

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  status: string;
  binary: boolean;
  tooLarge: boolean;
  oldLines: string[];
  newLines: string[];
  hunks: DiffHunk[];
  /** Present only when the diff command failed. */
  error?: string;
}

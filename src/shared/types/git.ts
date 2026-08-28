/** Mirrors the Rust structs returned by Tauri commands. */

export interface Commit {
  hash: string;
  parents: string[];
  authorName: string;
  authorEmail: string;
  authorTime: number;
  subject: string;
  refs: string[];
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

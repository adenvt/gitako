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
}

export interface GitErrorPayload {
  kind: "notFound" | "notARepo" | "conflict" | "other";
  message: string;
  code: number | null;
}

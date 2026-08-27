import { invoke } from "@tauri-apps/api/core";
import type { ChangedFile, Commit, RefInfo } from "../types/git";
import { toGitError } from "../utils/error";

/** Typed wrapper around the Tauri invoke layer. All backend calls go through here. */

export async function fetchLog(repoPath: string): Promise<Commit[]> {
  try {
    return await invoke<Commit[]>("git_log", { repoPath });
  } catch (e) {
    throw toGitError(e);
  }
}

export async function fetchRefs(repoPath: string): Promise<RefInfo[]> {
  try {
    return await invoke<RefInfo[]>("git_refs", { repoPath });
  } catch (e) {
    throw toGitError(e);
  }
}

export async function resolveRev(repoPath: string, rev: string): Promise<string> {
  try {
    return await invoke<string>("git_rev_parse", { repoPath, rev });
  } catch (e) {
    throw toGitError(e);
  }
}

export async function repoRoot(path: string): Promise<string> {
  try {
    return await invoke<string>("git_repo_root", { path });
  } catch (e) {
    throw toGitError(e);
  }
}

export async function fetchStatus(repoPath: string): Promise<string> {
  try {
    return await invoke<string>("git_status", { repoPath });
  } catch (e) {
    throw toGitError(e);
  }
}

export async function fetchShowFiles(
  repoPath: string,
  rev: string,
): Promise<ChangedFile[]> {
  try {
    return await invoke<ChangedFile[]>("git_show_files", { repoPath, rev });
  } catch (e) {
    throw toGitError(e);
  }
}

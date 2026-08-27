import { invoke } from "@tauri-apps/api/core";
import type { ChangedFile, Commit, RefInfo } from "@/shared/types/git";
import { toGitError } from "@/shared/utils/error";

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

/** Stage (`staged: true`) or unstage (`staged: false`) the given paths. */
export async function stageFiles(
  repoPath: string,
  paths: string[],
  staged: boolean,
): Promise<void> {
  try {
    await invoke("git_stage", { repoPath, paths, staged });
  } catch (e) {
    throw toGitError(e);
  }
}

/** Commit the staged changes; resolves to the new HEAD hash. */
export async function commitChanges(
  repoPath: string,
  subject: string,
  description: string,
): Promise<string> {
  try {
    return await invoke<string>("git_commit", {
      repoPath,
      subject,
      description,
    });
  } catch (e) {
    throw toGitError(e);
  }
}

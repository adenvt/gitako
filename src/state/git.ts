import { invoke } from "@tauri-apps/api/core";
import type { ChangedFile, Commit, DiffFile, RefInfo } from "@/shared/types/git";
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

export async function fetchShowFiles(repoPath: string, rev: string): Promise<ChangedFile[]> {
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

/** Fetch a full-file diff. `rev` empty means the working tree (staged = index vs HEAD). */
export async function fetchDiff(
  repoPath: string,
  rev: string,
  path: string,
  staged = false,
): Promise<DiffFile> {
  try {
    return await invoke<DiffFile>("git_diff", { repoPath, rev, path, staged });
  } catch (e) {
    throw toGitError(e);
  }
}

/** Switch HEAD to a local branch. Resolves to the new HEAD hash. */
export async function checkoutBranch(repoPath: string, branch: string): Promise<string> {
  try {
    return await invoke<string>("git_checkout", { repoPath, branch });
  } catch (e) {
    throw toGitError(e);
  }
}

/** `git stash push -u -m <message>`. Returns the new stash ref, or empty
 *  string if the worktree is clean. */
export async function stashSave(
  repoPath: string,
  message: string,
): Promise<string> {
  try {
    return await invoke<string>("git_stash_save", { repoPath, message });
  } catch (e) {
    throw toGitError(e);
  }
}

/** `git stash pop <ref>`. Pass empty string to no-op. Errors on conflict. */
export async function stashPop(repoPath: string, stashRef: string): Promise<void> {
  try {
    await invoke("git_stash_pop", { repoPath, stashRef });
  } catch (e) {
    throw toGitError(e);
  }
}

/**
 * Return the local branch name HEAD is on, or a short hash for detached
 * HEAD. Authoritative — don't infer from the log because topo order
 * doesn't guarantee HEAD is the first commit shown.
 */
export async function fetchHeadBranch(repoPath: string): Promise<string> {
  try {
    return await invoke<string>("git_head_branch", { repoPath });
  } catch (e) {
    throw toGitError(e);
  }
}

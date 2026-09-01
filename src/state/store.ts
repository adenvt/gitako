import { create } from "zustand";
import type { ChangedFile, Commit, DiffFile, RefInfo } from "@/shared/types/git";
import { layout, type LayoutResult } from "@/features/commit-graph/layout";
import {
  fetchLog,
  fetchRefs,
  fetchShowFiles,
  fetchStatus,
  fetchDiff,
  stageFiles,
  commitChanges,
  checkoutBranch,
  checkoutTrack,
  stashSave,
  stashPop,
  fetchHeadBranch,
} from "./git";
import { parsePorcelain, type StatusEntry } from "@/shared/utils/status";
import { errorMessage } from "@/shared/utils/error";
import { toastError } from "@/shared/components/Toaster";

const isStaged = (e: StatusEntry) =>
  e.index !== "." && !(e.index === "A" && e.worktree === "A");

interface RepoState {
  /** Root path of the open repository. */
  repoPath: string | null;
  /** Raw commits from the backend, newest first. */
  commits: Commit[];
  /** Refs joined to commits for badge display. */
  refs: RefInfo[];
  /** Full ref info per commit hash (for badge icons/kinds). */
  refsByCommit: Record<string, RefInfo[]>;
  /** Layout computed from commits. */
  layout: LayoutResult | null;
  /** Hash of the selected commit. */
  selectedHash: string | null;
  /** Changed files per commit hash, lazily fetched. */
  filesByCommit: Record<string, ChangedFile[]>;
  /** Parsed working-tree status (uncommitted changes). */
  statusEntries: StatusEntry[];
  /** True while the commit composer is open (right pane). */
  composerOpen: boolean;
  /** Paths the user has staged in the composer. */
  stagedPaths: Set<string>;
  /** Error from a failed stage/commit, shown in the composer. */
  composerError: string | null;
  /** Currently open diff (replaces the graph panel). */
  activeDiff: { hash: string; path: string; staged: boolean } | null;
  /** True when the working-directory (WIP) row is selected. */
  workingSelected: boolean;
  /** User-resizable width of the graph band (0 = auto from lane count). */
  graphWidth: number;
  /** Cached diffs, keyed by `${hash}|${path}`. */
  diffCache: Record<string, DiffFile>;
  /** True while a refresh is in flight. */
  loading: boolean;
  /** Local branch name HEAD is on, or short hash for detached HEAD.
   *  Authoritative — the log's first commit is not guaranteed to be HEAD. */
  headBranch: string | null;
  error: string | null;

  openRepo: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
  /**
   * Switch HEAD to a branch. For local branches, passes the name
   * straight to `git checkout`. For remote-tracking refs (`origin/feature`),
   * creates a local branch with the same name tracking the upstream
   * (smart switch + stash pop still apply, since the resulting checkout
   * may need to move HEAD).
   */
  checkout: (branch: string, kind?: "branch" | "remoteBranch") => Promise<void>;
  refreshStatus: () => Promise<void>;
  select: (hash: string | null) => void;
  loadCommitFiles: (hash: string) => Promise<void>;
  openComposer: () => void;
  closeComposer: () => void;
  setWorkingSelected: (v: boolean) => void;
  toggleStage: (path: string, staged: boolean) => Promise<void>;
  stageAll: () => Promise<void>;
  unstageAll: () => Promise<void>;
  commit: (subject: string, description: string) => Promise<void>;
  openDiff: (hash: string, path: string, staged?: boolean) => Promise<void>;
  closeDiff: () => void;
  setGraphWidth: (w: number) => void;
}

function computeLayout(commits: Commit[]): LayoutResult {
  return layout(commits.map((c) => ({ hash: c.hash, parents: c.parents })));
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repoPath: null,
  commits: [],
  refs: [],
  refsByCommit: {},
  layout: null,
  selectedHash: null,
  filesByCommit: {},
  statusEntries: [],
  composerOpen: false,
  stagedPaths: new Set(),
  composerError: null,
  activeDiff: null,
  workingSelected: false,
  graphWidth: 0, // 0 = auto (fits lane count)
  diffCache: {},
  loading: false,
  headBranch: null,
  error: null,

  async openRepo(path) {
    set({ loading: true, error: null, repoPath: path });
    try {
      await get().refresh();
    } finally {
      set({ loading: false });
    }
  },

  async refresh() {
    const { repoPath } = get();
    if (!repoPath) return;
    set({ loading: true, error: null });
    try {
      const [commits, refs, status, headBranch] = await Promise.all([
        fetchLog(repoPath),
        fetchRefs(repoPath),
        fetchStatus(repoPath).catch(() => ""),
        fetchHeadBranch(repoPath).catch(() => null),
      ]);
      // Join refs onto commits for badge display.
      const refByCommit = new Map<string, RefInfo[]>();
      for (const r of refs) {
        const list = refByCommit.get(r.commit) ?? [];
        list.push(r);
        refByCommit.set(r.commit, list);
      }
      const refsByCommit: Record<string, RefInfo[]> = {};
      for (const [hash, list] of refByCommit) refsByCommit[hash] = list;
      const withRefs = commits.map((c) => ({
        ...c,
        refs: (refByCommit.get(c.hash) ?? []).map((r) => r.name),
      }));
      const statusEntries = parsePorcelain(status);
      set({
        commits: withRefs,
        refs,
        refsByCommit,
        layout: computeLayout(withRefs),
        statusEntries,
        headBranch,
        // A repo can open with files already staged (e.g. staged in a
        // terminal before launching the app) — mirror the real index so the
        // composer's staged/unstaged split is correct from the start.
        stagedPaths: new Set(statusEntries.filter(isStaged).map((e) => e.path)),
      });
    } catch (e) {
      const message = errorMessage(e);
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  /**
   * Switch HEAD to a local branch. **Smart switch**: if the worktree is
   * dirty, stash push -u -> checkout -> stash pop so the user never sees
   * a "would overwrite" error. On pop conflict the stash is preserved
   * and the user is notified via toast; the checkout itself is still
   * considered successful.
   */
  async checkout(branch: string, kind: "branch" | "remoteBranch" = "branch") {
    const { repoPath, statusEntries } = get();
    if (!repoPath) return;
    const dirty = statusEntries.length > 0;
    set({ loading: true, error: null });
    let stashedRef = "";
    try {
      if (dirty) {
        stashedRef = await stashSave(repoPath, `auto: pre-checkout ${branch}`);
      }
      if (kind === "remoteBranch") {
        // Create the local branch tracking the remote; HEAD moves to it
        // implicitly (just like `git checkout`).
        await checkoutTrack(repoPath, branch);
      } else {
        await checkoutBranch(repoPath, branch);
      }
      if (stashedRef) {
        try {
          await stashPop(repoPath, stashedRef);
        } catch (popErr) {
          // Pop conflict — stash is preserved; surface to the user.
          toastError(
            `Stash pop conflict on ${branch}`,
            `Your changes are safe in ${stashedRef}`,
          );
        }
      }
      await get().refresh();
    } catch (e) {
      set({ error: errorMessage(e) });
      throw e;
    } finally {
      set({ loading: false });
    }
  },

  /** Re-fetch just the working-tree status (used after stage/unstage). */
  async refreshStatus() {
    const { repoPath } = get();
    if (!repoPath) return;
    try {
      const status = await fetchStatus(repoPath);
      const entries = parsePorcelain(status);
      // Rebuild the optimistic overlay from the real index: a path is
      // "staged" when the index marks it, regardless of how it got there.
      set({
        statusEntries: entries,
        stagedPaths: new Set(entries.filter(isStaged).map((e) => e.path)),
      });
    } catch (e) {
      const message = errorMessage(e);
      console.error("refreshStatus", message);
    }
  },

  select(hash) {
    // Selecting a commit closes the composer and deselects the WIP row.
    set({
      selectedHash: hash,
      composerOpen: false,
      activeDiff: null,
      workingSelected: false,
    });
  },

  async loadCommitFiles(hash) {
    const { repoPath, filesByCommit } = get();
    if (!repoPath || filesByCommit[hash]) return;
    try {
      const files = await fetchShowFiles(repoPath, hash);
      set({
        filesByCommit: { ...filesByCommit, [hash]: files },
      });
    } catch (e) {
      // File list is a nice-to-have; don't fail the whole selection.
      const message = errorMessage(e);
      console.error("loadCommitFiles", message);
    }
  },

  openComposer() {
    set({ composerOpen: true, composerError: null, activeDiff: null });
  },

  closeComposer() {
    set({ composerOpen: false, activeDiff: null });
  },

  setWorkingSelected(v) {
    // Selecting the WIP row deselects any commit.
    set({
      workingSelected: v,
      ...(v ? { selectedHash: null } : {}),
    });
  },

  async toggleStage(path, staged) {
    const { repoPath, stagedPaths } = get();
    if (!repoPath) return;
    // Optimistic update.
    const next = new Set(stagedPaths);
    if (staged) next.add(path);
    else next.delete(path);
    set({ stagedPaths: next, composerError: null });
    try {
      await stageFiles(repoPath, [path], staged);
      // Re-sync from git so the split reflects the real index, including
      // changes made outside the app (e.g. staging via the CLI).
      await get().refreshStatus();
    } catch (e) {
      // Revert on failure.
      const rollback = new Set(get().stagedPaths);
      if (staged) rollback.delete(path);
      else rollback.add(path);
      const message = errorMessage(e);
      set({ stagedPaths: rollback, composerError: message });
      toastError(staged ? "Stage failed" : "Unstage failed", message);
    }
  },

  async stageAll() {
    const { repoPath, statusEntries, stagedPaths } = get();
    if (!repoPath) return;
    const unstaged = statusEntries.filter((s) => !stagedPaths.has(s.path)).map((s) => s.path);
    if (unstaged.length === 0) return;
    const next = new Set(stagedPaths);
    unstaged.forEach((p) => next.add(p));
    set({ stagedPaths: next, composerError: null });
    try {
      await stageFiles(repoPath, unstaged, true);
      await get().refreshStatus();
    } catch (e) {
      const message = errorMessage(e);
      set({ stagedPaths: get().stagedPaths, composerError: message });
      toastError("Stage all failed", message);
    }
  },

  async unstageAll() {
    const { repoPath, stagedPaths } = get();
    if (!repoPath || stagedPaths.size === 0) return;
    const paths = [...stagedPaths];
    set({ stagedPaths: new Set(), composerError: null });
    try {
      await stageFiles(repoPath, paths, false);
      await get().refreshStatus();
    } catch (e) {
      const message = errorMessage(e);
      set({ stagedPaths: new Set(paths), composerError: message });
      toastError("Unstage all failed", message);
    }
  },

  async commit(subject, description) {
    const { repoPath, stagedPaths } = get();
    if (!repoPath || stagedPaths.size === 0) return;
    set({ composerError: null });
    try {
      await commitChanges(repoPath, subject.trim(), description);
      set({ composerOpen: false, stagedPaths: new Set(), activeDiff: null });
      await get().refresh();
    } catch (e) {
      const message = errorMessage(e);
      set({ composerError: message });
      toastError("Commit failed", message);
    }
  },

  async openDiff(hash, path, staged = false) {
    const { repoPath, diffCache } = get();
    if (!repoPath) return;
    const key = `${hash}|${path}|${staged ? "s" : "w"}`;
    set({ activeDiff: { hash, path, staged } });
    if (diffCache[key]) return;
    try {
      const diff = await fetchDiff(repoPath, hash, path, staged);
      set({ diffCache: { ...diffCache, [key]: diff } });
    } catch (e) {
      const message = errorMessage(e);
      console.error("openDiff failed:", { hash, path, staged, message });
      // Surface the error in the diff view instead of silent failure.
      set({
        diffCache: {
          ...diffCache,
          [key]: {
            oldPath: path,
            newPath: path,
            status: "M",
            binary: false,
            tooLarge: false,
            oldLines: [],
            newLines: [],
            hunks: [],
            error: message,
          } as DiffFile & { error: string },
        },
      });
    }
  },

  closeDiff() {
    set({ activeDiff: null });
  },

  setGraphWidth(w) {
    set({ graphWidth: w });
  },
}));

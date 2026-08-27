import { create } from "zustand";
import type { ChangedFile, Commit, RefInfo } from "../types/git";
import { layout, type LayoutResult } from "../graph/layout";
import { fetchLog, fetchRefs, fetchShowFiles } from "./git";

interface RepoState {
  /** Root path of the open repository. */
  repoPath: string | null;
  /** Raw commits from the backend, newest first. */
  commits: Commit[];
  /** Refs joined to commits for badge display. */
  refs: RefInfo[];
  /** Layout computed from commits. */
  layout: LayoutResult | null;
  /** Hash of the selected commit. */
  selectedHash: string | null;
  /** Changed files per commit hash, lazily fetched. */
  filesByCommit: Record<string, ChangedFile[]>;
  /** True while a refresh is in flight. */
  loading: boolean;
  error: string | null;

  openRepo: (path: string) => Promise<void>;
  refresh: () => Promise<void>;
  select: (hash: string | null) => void;
  loadCommitFiles: (hash: string) => Promise<void>;
}

function computeLayout(commits: Commit[]): LayoutResult {
  return layout(
    commits.map((c) => ({ hash: c.hash, parents: c.parents })),
  );
}

export const useRepoStore = create<RepoState>((set, get) => ({
  repoPath: null,
  commits: [],
  refs: [],
  layout: null,
  selectedHash: null,
  filesByCommit: {},
  loading: false,
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
      const [commits, refs] = await Promise.all([
        fetchLog(repoPath),
        fetchRefs(repoPath),
      ]);
      // Join refs onto commits for badge display.
      const refByCommit = new Map<string, RefInfo[]>();
      for (const r of refs) {
        const list = refByCommit.get(r.commit) ?? [];
        list.push(r);
        refByCommit.set(r.commit, list);
      }
      const withRefs = commits.map((c) => ({
        ...c,
        refs: (refByCommit.get(c.hash) ?? []).map((r) => r.name),
      }));
      set({
        commits: withRefs,
        refs,
        layout: computeLayout(withRefs),
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  select(hash) {
    set({ selectedHash: hash });
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
      const message = e instanceof Error ? e.message : String(e);
      console.error("loadCommitFiles", message);
    }
  },
}));

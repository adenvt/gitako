/**
 * Render helpers for component tests. Components reach for the zustand
 * store directly via `useRepoStore`, so they don't need a Provider. The
 * helpers here just:
 *  - reset the store to its initial shape between tests, and
 *  - let tests mutate state via the same API the components use.
 */
import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { useRepoStore } from "@/state/store";

export function resetStore(): void {
  useRepoStore.setState({
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
    graphWidth: 0,
    diffCache: {},
    loading: false,
    error: null,
  });
}

export function renderWithStore(ui: ReactElement, options?: RenderOptions) {
  resetStore();
  return render(ui, options);
}

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toolbar } from "./Toolbar";
import { useRepoStore } from "@/state/store";

// Mock the backend layer so the (mocked) store actions don't try to invoke
// over the real Tauri bridge when the user clicks "Pull".
vi.mock("@/state/git", () => ({
  fetchLog: vi.fn().mockResolvedValue([]),
  fetchRefs: vi.fn().mockResolvedValue([]),
  fetchStatus: vi.fn().mockResolvedValue(""),
  fetchShowFiles: vi.fn().mockResolvedValue([]),
  fetchDiff: vi.fn(),
  stageFiles: vi.fn().mockResolvedValue(undefined),
  commitChanges: vi.fn(),
  checkoutBranch: vi.fn().mockResolvedValue(""),
  stashSave: vi.fn().mockResolvedValue(""),
  stashPop: vi.fn().mockResolvedValue(undefined),
  fetchHeadBranch: vi.fn().mockResolvedValue("main"),
}));

import type { Commit, RefInfo } from "@/shared/types/git";
import type { StatusEntry } from "@/shared/utils/status";

function commit(overrides: Partial<Commit> = {}): Commit {
  return {
    hash: "abcdef0123456789",
    parents: [],
    authorName: "Test",
    authorEmail: "t@e",
    authorTime: 0,
    subject: "subject",
    refs: ["main", "origin/main"],
    ...overrides,
  };
}

function makeRefs(headHash = "abcdef0123456789"): RefInfo[] {
  return [
    { name: "main", fullName: "main", kind: "branch", commit: headHash, target: headHash, remote: null, remoteUrl: null },
    { name: "feature", fullName: "feature", kind: "branch", commit: "deadbeef00000000", target: "deadbeef00000000", remote: null, remoteUrl: null },
    { name: "origin/main", fullName: "origin/main", kind: "remoteBranch", commit: "1111111111111111", target: "1111111111111111", remote: "origin", remoteUrl: null },
  ];
}

function setStore(updates: Partial<ReturnType<typeof useRepoStore.getState>>): void {
  useRepoStore.setState(updates);
}

describe("Toolbar", () => {
  it("shows the local branch and short hash for the HEAD commit", () => {
    setStore({
      repoPath: "/home/user/projects/myrepo",
      commits: [commit({ hash: "abcdef0123456789", refs: ["main", "origin/main"] })],
      refs: makeRefs(),
      headBranch: "main",
    });
    render(<Toolbar />);
    expect(screen.getByText("myrepo")).toBeInTheDocument();
    // The BranchSwitcher trigger exposes the current branch via aria-label.
    expect(screen.getByLabelText(/current branch: main/i)).toBeInTheDocument();
    // Short hash: first 7 chars of "abcdef0123456789" -> "abcdef0".
    expect(screen.getByText("abcdef0")).toBeInTheDocument();
  });

  it("falls back to 'detached HEAD' when headBranch is null", () => {
    setStore({
      repoPath: "/repo",
      commits: [commit({ refs: ["origin/main", "upstream/main"] })],
      refs: [{ name: "origin/main", fullName: "origin/main", kind: "remoteBranch", commit: "xxxxxxxxxxxxxxxx", target: "xxxxxxxxxxxxxxxx", remote: "origin", remoteUrl: null }],
      headBranch: null,
    });
    render(<Toolbar />);
    expect(screen.getByText(/detached/)).toBeInTheDocument();
  });

  it("does not render the hash span when there are no commits", () => {
    setStore({ repoPath: "/repo", commits: [], refs: [] });
    render(<Toolbar />);
    expect(screen.queryByText("abcdef0")).toBeNull();
  });

  it("shows the dirty marker when status entries have any change", () => {
    const statusEntries: StatusEntry[] = [
      { index: ".", worktree: "M", path: "a.ts", oldPath: null },
    ];
    setStore({
      repoPath: "/repo",
      commits: [commit()],
      statusEntries,
      refs: makeRefs(),
    });
    render(<Toolbar />);
    expect(screen.getByTitle("Uncommitted changes")).toBeInTheDocument();
  });

  it("hides the dirty marker when status is clean", () => {
    setStore({
      repoPath: "/repo",
      commits: [commit()],
      statusEntries: [{ index: ".", worktree: ".", path: "clean.ts", oldPath: null }],
      refs: makeRefs(),
    });
    render(<Toolbar />);
    expect(screen.queryByTitle("Uncommitted changes")).toBeNull();
  });

  it("shows the full repo path in the right-side pill (hover title)", () => {
    setStore({ repoPath: "/home/user/projects/myrepo", commits: [commit()], refs: makeRefs() });
    render(<Toolbar />);
    expect(screen.getByTitle("/home/user/projects/myrepo")).toBeInTheDocument();
  });

  it("hides the right-side path pill when no repo is open", () => {
    setStore({ repoPath: null, commits: [], refs: [] });
    render(<Toolbar />);
    expect(screen.queryByTitle("/home/user/projects/myrepo")).toBeNull();
  });

  it("shows a transient notice when Push is clicked, then auto-clears", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      setStore({ repoPath: "/r", commits: [commit()], refs: makeRefs() });
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<Toolbar />);
      await user.click(screen.getByRole("button", { name: /push/i }));
      expect(screen.getByText(/not yet implemented/i)).toBeInTheDocument();
      await vi.advanceTimersByTimeAsync(2600);
      expect(screen.queryByText(/not yet implemented/i)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("calls refresh() when the Pull button is clicked", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    setStore({ repoPath: "/r", commits: [commit()], refresh, refs: makeRefs() });
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: /pull/i }));
    expect(refresh).toHaveBeenCalled();
  });

  it("disables the Pull button while loading", () => {
    setStore({ repoPath: "/r", commits: [commit()], loading: true, refs: makeRefs() });
    render(<Toolbar />);
    expect(screen.getByRole("button", { name: /pull…/i })).toBeDisabled();
  });

  it("shows a Stash notice when the Stash button is clicked", async () => {
    setStore({ repoPath: "/r", commits: [commit()], refs: makeRefs() });
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: /stash/i }));
    expect(screen.getByText(/stash.*not yet implemented/i)).toBeInTheDocument();
  });

  it("shows a Settings notice when the Settings button is clicked", async () => {
    setStore({ repoPath: "/r", commits: [commit()], refs: makeRefs() });
    const user = userEvent.setup();
    render(<Toolbar />);
    await user.click(screen.getByRole("button", { name: /settings/i }));
    expect(screen.getByText(/settings.*not yet implemented/i)).toBeInTheDocument();
  });
});

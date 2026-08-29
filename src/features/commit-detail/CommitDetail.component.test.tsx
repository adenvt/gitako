import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitDetail } from "./CommitDetail";
import { useRepoStore } from "@/state/store";
import { layout } from "@/features/commit-graph/layout";
import type { Commit, RefInfo } from "@/shared/types/git";

vi.mock("@/state/git", () => ({
  fetchLog: vi.fn(),
  fetchRefs: vi.fn(),
  fetchStatus: vi.fn(),
  fetchShowFiles: vi.fn().mockResolvedValue([]),
  fetchDiff: vi.fn(),
  stageFiles: vi.fn(),
  commitChanges: vi.fn(),
}));

function commit(overrides: Partial<Commit> = {}): Commit {
  return {
    hash: "abcdef0123456789",
    parents: ["parent1"],
    authorName: "Ada",
    authorEmail: "ada@example.com",
    authorTime: 0,
    subject: "Fix something",
    refs: [],
    ...overrides,
  };
}

function refInfo(overrides: Partial<RefInfo>): RefInfo {
  return {
    name: "main",
    fullName: "main",
    kind: "branch",
    target: "abcdef0123456789",
    commit: "abcdef0123456789",
    remote: null,
    remoteUrl: null,
    ...overrides,
  };
}

function setStoreWith(commitObj: Commit, refs: RefInfo[] = []) {
  useRepoStore.setState({
    commits: [commitObj],
    selectedHash: commitObj.hash,
    filesByCommit: { [commitObj.hash]: [] },
    layout: layout([{ hash: commitObj.hash, parents: commitObj.parents }]),
    refsByCommit: { [commitObj.hash]: refs },
  });
}

describe("CommitDetail", () => {
  it("shows the placeholder when no commit is selected", () => {
    useRepoStore.setState({ commits: [], selectedHash: null });
    render(<CommitDetail />);
    expect(screen.getByText(/select a commit to see its details/i)).toBeInTheDocument();
  });

  it("shows the commit subject, author, date, short hash, and parent", () => {
    // Use a real-shape parent hash so shortHash produces a useful preview.
    setStoreWith(commit({ parents: ["1234567890abcdef"] }));
    render(<CommitDetail />);
    expect(screen.getByText("Fix something")).toBeInTheDocument();
    expect(screen.getByText(/Ada/)).toBeInTheDocument();
    expect(screen.getByText(/ada@example\.com/)).toBeInTheDocument();
    // Short hash.
    expect(screen.getByText("abcdef0")).toBeInTheDocument();
    // Parent short hash is the first 7 chars of "1234567890abcdef" -> "1234567".
    expect(screen.getByText("1234567")).toBeInTheDocument();
  });

  it("hides the Parents row for a root commit (no parents)", () => {
    setStoreWith(commit({ parents: [] }));
    render(<CommitDetail />);
    expect(screen.queryByText("Parents")).toBeNull();
  });

  it("shows the Refs row when the commit has refs joined onto it", () => {
    // The component reads `commit.refs` (the string array joined by the
    // store on refresh), not refsByCommit — pin that contract.
    setStoreWith(
      commit({ refs: ["main", "origin/main"] }),
      [refInfo({ name: "main", fullName: "main", kind: "branch" })],
    );
    render(<CommitDetail />);
    expect(screen.getByText("Refs")).toBeInTheDocument();
    expect(screen.getByText("main")).toBeInTheDocument();
    expect(screen.getByText("origin/main")).toBeInTheDocument();
  });

  it("renders file stats (status icon + count + label) when files are loaded", () => {
    setStoreWith(commit(), []);
    useRepoStore.setState({
      filesByCommit: {
        [commit().hash]: [
          { status: "M", path: "a.ts", oldPath: null },
          { status: "M", path: "b.ts", oldPath: null },
          { status: "A", path: "c.ts", oldPath: null },
        ],
      },
    });
    render(<CommitDetail />);
    // 2 modified, 1 added.
    expect(screen.getByText(/2 modified/)).toBeInTheDocument();
    expect(screen.getByText(/1 added/)).toBeInTheDocument();
  });

  it("shows the Loading placeholder while files are still being fetched", () => {
    setStoreWith(commit());
    useRepoStore.setState({
      filesByCommit: { [commit().hash]: undefined as unknown as [] },
    });
    render(<CommitDetail />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("calls openDiff with the commit hash and file path when a file is clicked", async () => {
    const openDiff = vi.fn();
    useRepoStore.setState({ openDiff });
    setStoreWith(commit());
    useRepoStore.setState({
      filesByCommit: {
        [commit().hash]: [{ status: "M", path: "src/index.ts", oldPath: null }],
      },
    });
    const user = userEvent.setup();
    render(<CommitDetail />);
    await user.click(screen.getByText("index.ts"));
    expect(openDiff).toHaveBeenCalledWith(commit().hash, "src/index.ts");
  });

  it("triggers loadCommitFiles for the selected hash on mount", () => {
    const loadCommitFiles = vi.fn();
    useRepoStore.setState({ loadCommitFiles });
    setStoreWith(commit());
    render(<CommitDetail />);
    expect(loadCommitFiles).toHaveBeenCalledWith(commit().hash);
  });

  it("renders refs without a badge color when the layout doesn't include the commit", () => {
    // Layout has no matching commit -> idx === -1 -> badgeColor is undefined.
    // The refs still render (refs are on the commit, not the layout) but
    // the badge has no inline --badge-color style.
    const c = commit({ refs: ["main"] });
    useRepoStore.setState({
      commits: [c],
      selectedHash: c.hash,
      filesByCommit: { [c.hash]: [] },
      layout: layout([{ hash: "OTHER", parents: [] }]), // different hash
      refsByCommit: { [c.hash]: [refInfo({ name: "main", fullName: "main", kind: "branch" })] },
    });
    const { container } = render(<CommitDetail />);
    // The badge exists, but it has no inline --badge-color style.
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement | null;
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("style") ?? "").not.toMatch(/badge-color/);
  });

  it("renders refs without a badge color when there is no layout at all", () => {
    const c = commit({ refs: ["main"] });
    useRepoStore.setState({
      commits: [c],
      selectedHash: c.hash,
      filesByCommit: { [c.hash]: [] },
      layout: null,
      refsByCommit: { [c.hash]: [refInfo({ name: "main", fullName: "main", kind: "branch" })] },
    });
    const { container } = render(<CommitDetail />);
    const badge = container.querySelector("[class*='commitRefBadge']") as HTMLElement | null;
    expect(badge).not.toBeNull();
    expect(badge?.getAttribute("style") ?? "").not.toMatch(/badge-color/);
  });

  it("shows 'No files changed.' when the file list is empty", () => {
    setStoreWith(commit());
    useRepoStore.setState({
      filesByCommit: { [commit().hash]: [] },
    });
    render(<CommitDetail />);
    expect(screen.getByText(/no files changed/i)).toBeInTheDocument();
  });
});

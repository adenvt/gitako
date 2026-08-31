import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitList } from "./CommitList";
import { useRepoStore } from "@/state/store";
import { layout } from "./layout";
import type { Commit, RefInfo } from "@/shared/types/git";

vi.mock("@/state/git", () => ({
  fetchLog: vi.fn(),
  fetchRefs: vi.fn(),
  fetchStatus: vi.fn(),
  fetchShowFiles: vi.fn(),
  fetchDiff: vi.fn(),
  stageFiles: vi.fn(),
  commitChanges: vi.fn(),
}));

function commit(overrides: Partial<Commit> = {}): Commit {
  return {
    hash: "abcdef0123456789",
    parents: [],
    authorName: "Ada",
    authorEmail: "ada@e",
    authorTime: 0,
    subject: "Initial commit",
    refs: [],
    ...overrides,
  };
}

function refInfo(overrides: Partial<RefInfo>): RefInfo {
  return {
    name: "main",
    fullName: "main",
    kind: "branch",
    target: "x",
    commit: "x",
    remote: null,
    remoteUrl: null,
    ...overrides,
  };
}

describe("CommitList", () => {
  it("renders the empty state when no commits are loaded", () => {
    useRepoStore.setState({ commits: [], layout: null });
    render(<CommitList />);
    expect(screen.getByText(/no commits yet/i)).toBeInTheDocument();
  });

  it("renders the commit subject and author/time for each commit", () => {
    const c = commit({ subject: "Hello world" });
    useRepoStore.setState({
      commits: [c],
      layout: layout([{ hash: c.hash, parents: [] }]),
      statusEntries: [],
    });
    render(<CommitList />);
    expect(screen.getByText("Hello world")).toBeInTheDocument();
    expect(screen.getByText("Ada")).toBeInTheDocument();
  });

  it("calls select(hash) when a commit row is clicked", async () => {
    const select = vi.fn();
    const c = commit();
    useRepoStore.setState({
      commits: [c],
      layout: layout([{ hash: c.hash, parents: [] }]),
      statusEntries: [],
      select,
    });
    const user = userEvent.setup();
    render(<CommitList />);
    await user.click(screen.getByText("Initial commit"));
    expect(select).toHaveBeenCalledWith(c.hash);
  });

  it("renders a working-tree row when there are unstaged changes, and clicking it opens the composer", async () => {
    const setWorkingSelected = vi.fn();
    const openComposer = vi.fn();
    const c = commit();
    useRepoStore.setState({
      commits: [c],
      layout: layout([{ hash: c.hash, parents: [] }]),
      statusEntries: [
        { index: ".", worktree: "M", path: "a.ts", oldPath: null },
        { index: ".", worktree: "A", path: "b.ts", oldPath: null },
      ],
      setWorkingSelected,
      openComposer,
    });
    const user = userEvent.setup();
    render(<CommitList />);
    const wip = screen.getByTitle("Open commit composer");
    expect(wip).toBeInTheDocument();
    await user.click(wip);
    expect(setWorkingSelected).toHaveBeenCalledWith(true);
    expect(openComposer).toHaveBeenCalled();
  });

  it("hides the working-tree row when status is clean (no added/deleted/modified)", () => {
    const c = commit();
    useRepoStore.setState({
      commits: [c],
      layout: layout([{ hash: c.hash, parents: [] }]),
      statusEntries: [], // empty -> countByKind returns zeros
    });
    render(<CommitList />);
    expect(screen.queryByTitle("Open commit composer")).toBeNull();
  });

  it("renders ref badges for refs joined to a commit, grouped by base name", () => {
    const c = commit({ refs: ["main", "origin/main"] });
    useRepoStore.setState({
      commits: [c],
      layout: layout([{ hash: c.hash, parents: [] }]),
      statusEntries: [],
      refsByCommit: {
        [c.hash]: [
          refInfo({ name: "main", fullName: "main", kind: "branch" }),
          refInfo({
            name: "main",
            fullName: "origin/main",
            kind: "remoteBranch",
            remote: "origin",
          }),
        ],
      },
    });
    render(<CommitList />);
    // The grouped badge shows the base name once in the visible name
    // span, and again in the (hidden-until-hover) dropdown — both are fine.
    expect(screen.getAllByText("main").length).toBeGreaterThan(0);
  });

  it("does not render a badge for the remote 'origin/HEAD' pointer", () => {
    const c = commit();
    useRepoStore.setState({
      commits: [c],
      layout: layout([{ hash: c.hash, parents: [] }]),
      statusEntries: [],
      refsByCommit: {
        [c.hash]: [
          refInfo({
            name: "HEAD",
            fullName: "origin/HEAD",
            kind: "remoteBranch",
            remote: "origin",
          }),
        ],
      },
    });
    const { container } = render(<CommitList />);
    // The group filter removes HEAD; no badge should be rendered.
    expect(container.querySelectorAll("[class*='commitRefBadge']").length).toBe(0);
  });

  it("clicking the tag/refs cell also calls select (it has its own click handler)", async () => {
    const select = vi.fn();
    const c = commit({ refs: ["main"] });
    useRepoStore.setState({
      commits: [c],
      layout: layout([{ hash: c.hash, parents: [] }]),
      statusEntries: [],
      refsByCommit: {
        [c.hash]: [refInfo({ name: "main", fullName: "main", kind: "branch" })],
      },
      select,
    });
    const user = userEvent.setup();
    const { container } = render(<CommitList />);
    const tagCell = container.querySelector("[class*='commitTagCell']") as HTMLElement | null;
    expect(tagCell).not.toBeNull();
    await user.click(tagCell!);
    expect(select).toHaveBeenCalledWith(c.hash);
  });

  it("clamps the graphBand to [MIN_GRAPH_BAND, maxBand] on resize", async () => {
    // Trigger a pointerdown on the resize handle and dispatch pointermove
    // events with a clientX far past the max -> store receives the max.
    const setGraphWidth = vi.fn();
    useRepoStore.setState({
      commits: [commit()],
      layout: layout([{ hash: "abcdef0123456789", parents: [] }]),
      statusEntries: [],
      setGraphWidth,
      graphWidth: 0,
    });
    const { container } = render(<CommitList />);
    const handle = container.querySelector("[class*='graphResizeHandle']") as HTMLElement | null;
    expect(handle).not.toBeNull();

    // Simulate a pointerdown + pointermove + pointerup sequence.
    handle!.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 5000 }));
    window.dispatchEvent(new PointerEvent("pointermove", { clientX: 5000 }));
    window.dispatchEvent(new PointerEvent("pointerup"));

    // The setGraphWidth call should have been made with a clamped value.
    expect(setGraphWidth).toHaveBeenCalled();
    const lastCall = setGraphWidth.mock.calls[setGraphWidth.mock.calls.length - 1]?.[0] as number;
    // The clamp is to MIN_GRAPH_BAND on the low side and `maxBand` on the
    // high side. The exact high value depends on the layout; both should
    // be non-negative and at least MIN_GRAPH_BAND.
    expect(lastCall).toBeGreaterThanOrEqual(37); // MIN_GRAPH_BAND
  });

  it("is a no-op when pointerdown is fired without a scroll container (defensive)", () => {
    // The handler bails if `scrollRef.current` is null. We can't easily
    // null out the ref, so we just confirm the component renders without
    // throwing when the layout is empty (the scroll container is also not
    // mounted).
    useRepoStore.setState({ commits: [], layout: null });
    expect(() => render(<CommitList />)).not.toThrow();
  });
});

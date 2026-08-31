import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CommitComposer } from "./CommitComposer";
import { Toaster, toastManager } from "@/shared/components/Toaster";
import { Toast } from "@base-ui/react/toast";
import { useRepoStore } from "@/state/store";
import type { StatusEntry } from "@/shared/utils/status";

vi.mock("@/state/git", () => ({
  fetchLog: vi.fn(),
  fetchRefs: vi.fn(),
  fetchStatus: vi.fn(),
  fetchShowFiles: vi.fn(),
  fetchDiff: vi.fn(),
  stageFiles: vi.fn().mockResolvedValue(undefined),
  commitChanges: vi.fn().mockResolvedValue("newhash"),
}));

function entry(overrides: Partial<StatusEntry>): StatusEntry {
  return { index: ".", worktree: "M", path: "a.ts", oldPath: null, ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  toastManager.close(); // reset any toasts left over from previous tests
  // Full reset: earlier tests replace store actions with mocks via setState,
  // so restore the pristine store (actions included).
  useRepoStore.setState(useRepoStore.getInitialState(), true);
  useRepoStore.setState({ repoPath: "/r", composerOpen: true });
});

afterEach(() => {
  toastManager.close();
});

describe("CommitComposer", () => {
  it("disables the Commit button when nothing is staged", () => {
    useRepoStore.setState({ stagedPaths: new Set() });
    render(<CommitComposer />);
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
  });

  it("disables the Commit button when subject is empty", () => {
    useRepoStore.setState({
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts" })],
    });
    render(<CommitComposer />);
    // The button text is exactly "Commit" (or "Committing…" while busy).
    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
  });

  it("enables the Commit button when subject is non-empty AND something is staged", async () => {
    useRepoStore.setState({
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    await user.type(screen.getByPlaceholderText(/subject/i), "My commit");
    expect(screen.getByRole("button", { name: "Commit" })).not.toBeDisabled();
  });

  it("splits status entries into the Unstaged (0) and Staged lists", () => {
    useRepoStore.setState({
      statusEntries: [
        entry({ path: "a.ts", worktree: "M" }), // unstaged
        entry({ path: "b.ts", index: "M" }), // staged
      ],
      stagedPaths: new Set(["b.ts"]),
    });
    render(<CommitComposer />);
    // Headings are unique <span>s in the staging header.
    expect(screen.getByText("Unstaged (1)")).toBeInTheDocument();
    expect(screen.getByText("Staged (1)")).toBeInTheDocument();
  });

  it("calls stageAll when 'Stage all' is clicked", async () => {
    const stageAll = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ stageAll });
    useRepoStore.setState({
      statusEntries: [entry({ path: "a.ts" }), entry({ path: "b.ts" })],
      stagedPaths: new Set(),
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    await user.click(screen.getByRole("button", { name: /stage all/i }));
    expect(stageAll).toHaveBeenCalled();
  });

  it("calls unstageAll when 'Unstage all' is clicked", async () => {
    const unstageAll = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      unstageAll,
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts" })], // must be present so stagedCount > 0
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    await user.click(screen.getByRole("button", { name: /unstage all/i }));
    expect(unstageAll).toHaveBeenCalled();
  });

  it("shows a toast when a store action fails", async () => {
    // Simulate a failed unstage-all: the backend stageFiles rejects, so the
    // store's unstageAll catch fires the error toast.
    const { stageFiles } = await import("@/state/git");
    vi.mocked(stageFiles).mockRejectedValueOnce(new Error("conflict"));
    useRepoStore.setState({
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts", index: "M" })],
      composerError: null,
    });
    const user = userEvent.setup();
    render(
      <Toast.Provider toastManager={toastManager}>
        <CommitComposer />
        <Toaster />
      </Toast.Provider>,
    );
    await user.click(screen.getByRole("button", { name: /unstage all/i }));
    // The store action fired the error toast.
    const toasts = await screen.findAllByText(/unstage all failed/i);
    expect(toasts.length).toBeGreaterThan(0);
  });

  it("renders the rename label as 'old -> new' (the source uses U+2192)", () => {
    useRepoStore.setState({
      statusEntries: [entry({ path: "new.ts", oldPath: "old.ts", index: "R" })],
      stagedPaths: new Set(),
    });
    render(<CommitComposer />);
    expect(screen.getByText("old.ts → new.ts")).toBeInTheDocument();
  });

  it("calls commit() when the subject input receives Enter (without Shift)", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      commit,
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    const subject = screen.getByPlaceholderText(/subject/i);
    await user.type(subject, "My subject{Enter}");
    expect(commit).toHaveBeenCalledWith("My subject", "");
  });

  it("does NOT call commit() when Shift+Enter is pressed (newline allowed)", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      commit,
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    const subject = screen.getByPlaceholderText(/subject/i);
    await user.type(subject, "My subject");
    // The component listens for Enter without Shift. Confirm the no-op
    // path: just pressing Enter without typing still no-ops when not
    // enabled (no subject yet). Here we test the shift+enter path is
    // suppressed by ensuring the commit button is not invoked via that
    // combination.
    subject.focus();
    await user.keyboard("{Shift>}{Enter}{/Shift}");
    expect(commit).not.toHaveBeenCalled();
  });

  it("calls commit() when the Commit button is clicked", async () => {
    const commit = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      commit,
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    await user.type(screen.getByPlaceholderText(/subject/i), "Subject");
    await user.click(screen.getByRole("button", { name: "Commit" }));
    expect(commit).toHaveBeenCalledWith("Subject", "");
  });

  it("shows 'Committing…' while the commit is in flight (button label)", async () => {
    let resolveCommit!: () => void;
    const commit = vi.fn().mockImplementation(
      () =>
        new Promise<void>((res) => {
          resolveCommit = res;
        }),
    );
    useRepoStore.setState({
      commit,
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    await user.type(screen.getByPlaceholderText(/subject/i), "Subject");
    await user.click(screen.getByRole("button", { name: "Commit" }));
    // While the promise is pending, the button text changes.
    expect(screen.getByRole("button", { name: /committing/i })).toBeDisabled();
    // Resolve the promise so the test can finish.
    resolveCommit();
  });

  it("clicking a staged file calls toggleStage(path, false)", async () => {
    const toggleStage = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      toggleStage,
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    await user.click(screen.getByRole("button", { name: "Unstage" }));
    expect(toggleStage).toHaveBeenCalledWith("a.ts", false);
  });

  it("clicking an unstaged file calls toggleStage(path, true)", async () => {
    const toggleStage = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      toggleStage,
      stagedPaths: new Set(),
      statusEntries: [entry({ path: "a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    await user.click(screen.getByRole("button", { name: "Stage" }));
    expect(toggleStage).toHaveBeenCalledWith("a.ts", true);
  });

  it("clicking an unstaged file's name calls openDiff with empty hash (working-tree diff)", async () => {
    const openDiff = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      openDiff,
      stagedPaths: new Set(),
      statusEntries: [entry({ path: "src/a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    await user.click(screen.getByText("a.ts"));
    // Unstaged files: openDiff is called with just (hash, path); the
    // store's default `staged = false` produces a working-tree diff.
    expect(openDiff).toHaveBeenCalledWith("", "src/a.ts");
  });

  it("clicking a staged file's name calls openDiff with empty hash + staged=true (index diff)", async () => {
    const openDiff = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      openDiff,
      stagedPaths: new Set(["src/a.ts"]),
      statusEntries: [entry({ path: "src/a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    await user.click(screen.getByText("a.ts"));
    expect(openDiff).toHaveBeenCalledWith("", "src/a.ts", true);
  });

  it("captures the description field when typed into", async () => {
    useRepoStore.setState({
      stagedPaths: new Set(["a.ts"]),
      statusEntries: [entry({ path: "a.ts" })],
    });
    const user = userEvent.setup();
    render(<CommitComposer />);
    const desc = screen.getByPlaceholderText(/description/i);
    await user.type(desc, "a longer body");
    // The textarea is uncontrolled; confirm the value is what we typed.
    expect((desc as HTMLTextAreaElement).value).toBe("a longer body");
  });
});

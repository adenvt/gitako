import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchSwitcher } from "./BranchSwitcher";
import { useRepoStore } from "@/state/store";
import type { RefInfo, Commit } from "@/shared/types/git";

const HEAD_HASH = "abcdef0123456789";

function ref(name: string, kind: RefInfo["kind"], commitHash = ""): RefInfo {
  return { name, kind, fullName: name, commit: commitHash, target: commitHash, remote: null, remoteUrl: null };
}

function headCommit(): Commit {
  return {
    hash: HEAD_HASH,
    parents: [],
    authorName: "Test",
    authorEmail: "t@e",
    authorTime: 0,
    subject: "subject",
    refs: ["main"],
  };
}

function seed(refs: RefInfo[], commits: Commit[] = [headCommit()]) {
  useRepoStore.setState({ refs, commits });
}

beforeEach(() => {
  useRepoStore.setState({ refs: [], commits: [] });
  vi.clearAllMocks();
});

describe("BranchSwitcher", () => {
  it("renders the current branch from refs", () => {
    seed([
      ref("main", "branch", HEAD_HASH),
      ref("origin/main", "remoteBranch"),
      ref("feature", "branch"),
    ]);
    render(<BranchSwitcher />);
    expect(screen.getByText(/^on main$/)).toBeInTheDocument();
  });

  it("shows 'detached HEAD' when no branch ref points at HEAD", () => {
    seed([ref("origin/main", "remoteBranch")]);
    render(<BranchSwitcher />);
    expect(screen.getByText(/^on detached HEAD$/)).toBeInTheDocument();
  });

  it("opens the menu and lists only local branches", async () => {
    seed([
      ref("main", "branch", HEAD_HASH),
      ref("feature", "branch"),
      ref("origin/main", "remoteBranch"),
      ref("v1.0.0", "tag"),
    ]);
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("button", { name: /current branch: main/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "main" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "feature" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "origin/main" })).toBeNull();
    expect(screen.queryByRole("option", { name: "v1.0.0" })).toBeNull();
  });

  it("shows 'No local branches' when only remote branches exist", async () => {
    seed([ref("origin/main", "remoteBranch")]);
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("button", { name: /detached HEAD/i }));
    expect(screen.getByText(/No local branches/i)).toBeInTheDocument();
  });

  it("selects a branch: calls checkout and closes the menu", async () => {
    const checkout = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      refs: [ref("main", "branch", HEAD_HASH), ref("feature", "branch")],
      commits: [headCommit()],
    });
    (useRepoStore.getState() as unknown as { checkout: typeof checkout }).checkout = checkout;
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("button", { name: /current branch: main/i }));
    await user.click(screen.getByRole("option", { name: "feature" }));
    await waitFor(() => expect(checkout).toHaveBeenCalledWith("feature"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not call checkout when picking the current branch", async () => {
    const checkout = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      refs: [ref("main", "branch", HEAD_HASH), ref("feature", "branch")],
      commits: [headCommit()],
    });
    (useRepoStore.getState() as unknown as { checkout: typeof checkout }).checkout = checkout;
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("button", { name: /current branch: main/i }));
    await user.click(screen.getByRole("option", { name: "main" }));
    expect(checkout).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape", async () => {
    seed([ref("main", "branch", HEAD_HASH), ref("feature", "branch")]);
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("button", { name: /current branch: main/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on click outside", async () => {
    seed([ref("main", "branch", HEAD_HASH), ref("feature", "branch")]);
    const user = userEvent.setup();
    render(
      <div>
        <BranchSwitcher />
        <button data-testid="outside">outside</button>
      </div>,
    );
    await user.click(screen.getByRole("button", { name: /current branch: main/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByTestId("outside"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

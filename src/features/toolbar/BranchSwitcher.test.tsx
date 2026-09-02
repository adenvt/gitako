import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BranchSwitcher } from "./BranchSwitcher";
import { useRepoStore } from "@/state/store";
import type { RefInfo, Commit } from "@/shared/types/git";

const HEAD_HASH = "abcdef0123456789";

function ref(name: string, kind: RefInfo["kind"], commitHash = ""): RefInfo {
  return {
    name,
    kind,
    fullName: name,
    commit: commitHash,
    target: commitHash,
    remote: null,
    remoteUrl: null,
  };
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

function seed(
  refs: RefInfo[],
  headBranch: string | null = "main",
  commits: Commit[] = [headCommit()],
) {
  useRepoStore.setState({ refs, commits, headBranch });
}

beforeEach(() => {
  useRepoStore.setState({ refs: [], commits: [], headBranch: null });
  vi.clearAllMocks();
});

describe("BranchSwitcher", () => {
  it("renders the current branch from the store's headBranch", () => {
    // Refs can be anything — the switcher trusts `headBranch` over the log
    // position. Pins the fix for the topo-order-vs-HEAD bug.
    seed(
      [
        ref("chore/playground-showcase", "branch", HEAD_HASH),
        ref("origin/chore/playground-showcase", "remoteBranch"),
        ref("feature", "branch"),
      ],
      "chore/playground-showcase",
    );
    render(<BranchSwitcher />);
    expect(screen.getByText(/^on chore\/playground-showcase$/)).toBeInTheDocument();
  });

  it("shows 'detached HEAD' when headBranch is null (before first refresh)", () => {
    seed([ref("origin/main", "remoteBranch")], null);
    render(<BranchSwitcher />);
    expect(screen.getByText(/^on detached HEAD$/)).toBeInTheDocument();
  });

  it("opens the popup and lists only local branches", async () => {
    // Realistic backend shape: the current branch is `kind: "head"`, not
    // `kind: "branch"`. The non-current ones stay as `"branch"`.
    seed(
      [
        ref("main", "head", HEAD_HASH),
        ref("feature", "branch"),
        ref("origin/main", "remoteBranch"),
        ref("v1.0.0", "tag"),
      ],
      "main",
    );
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("combobox", { name: /current branch: main/i }));
    // Listbox is rendered into a portal.
    const listbox = await screen.findByRole("listbox");
    expect(listbox).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "main" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "feature" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "origin/main" })).toBeNull();
    expect(screen.queryByRole("option", { name: "v1.0.0" })).toBeNull();
  });

  it("includes the current branch in the list even though it has kind='head'", async () => {
    // Regression: backend upgrades the current branch's kind from "branch"
    // to "head". The list must still show it so the ItemIndicator's check
    // icon has a matching item to render against.
    seed([ref("main", "head", HEAD_HASH), ref("feature", "branch")], "main");
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("combobox", { name: /current branch: main/i }));
    expect(await screen.findByRole("option", { name: "main" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "feature" })).toBeInTheDocument();
    // The current item carries data-selected so the check icon shows.
    const mainItem = screen.getByRole("option", { name: "main" });
    expect(mainItem.getAttribute("data-selected")).not.toBeNull();
  });

  it("shows 'No local branches' when only remote branches exist", async () => {
    seed([ref("origin/main", "remoteBranch")], null);
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("combobox", { name: /detached HEAD/i }));
    expect(await screen.findByText(/No local branches/i)).toBeInTheDocument();
  });

  it("selects a branch: calls checkout and closes the popup", async () => {
    const checkout = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      refs: [ref("main", "branch", HEAD_HASH), ref("feature", "branch")],
      commits: [headCommit()],
      headBranch: "main",
    });
    (useRepoStore.getState() as unknown as { checkout: typeof checkout }).checkout = checkout;
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("combobox", { name: /current branch: main/i }));
    await user.click(await screen.findByRole("option", { name: "feature" }));
    await waitFor(() => expect(checkout).toHaveBeenCalledWith("feature"));
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("does not call checkout when picking the current branch", async () => {
    const checkout = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      refs: [ref("main", "branch", HEAD_HASH), ref("feature", "branch")],
      commits: [headCommit()],
      headBranch: "main",
    });
    (useRepoStore.getState() as unknown as { checkout: typeof checkout }).checkout = checkout;
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("combobox", { name: /current branch: main/i }));
    await user.click(await screen.findByRole("option", { name: "main" }));
    expect(checkout).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("filters branches by typed text", async () => {
    seed(
      [
        ref("main", "branch", HEAD_HASH),
        ref("feature/awesome", "branch"),
        ref("fix-bug", "branch"),
      ],
      "main",
    );
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("combobox", { name: /current branch: main/i }));
    // Wait for the popup to open and the input to be in the document.
    const input = await screen.findByPlaceholderText(/filter/i);
    await user.type(input, "feat");
    // Only feature/awesome should match.
    expect(screen.getByRole("option", { name: "feature/awesome" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "fix-bug" })).toBeNull();
    expect(screen.queryByRole("option", { name: "main" })).toBeNull();
  });

  it("selects a branch on Enter after filtering", async () => {
    const checkout = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({
      refs: [ref("main", "branch", HEAD_HASH), ref("feature", "branch")],
      commits: [headCommit()],
      headBranch: "main",
    });
    (useRepoStore.getState() as unknown as { checkout: typeof checkout }).checkout = checkout;
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("combobox", { name: /current branch: main/i }));
    const input = await screen.findByPlaceholderText(/filter/i);
    await user.type(input, "feat");
    // ArrowDown moves highlight to the first match; Enter selects it.
    await user.keyboard("{ArrowDown}{Enter}");
    await waitFor(() => expect(checkout).toHaveBeenCalledWith("feature"));
  });

  it("closes on Escape", async () => {
    seed([ref("main", "branch", HEAD_HASH), ref("feature", "branch")], "main");
    const user = userEvent.setup();
    render(<BranchSwitcher />);
    await user.click(screen.getByRole("combobox", { name: /current branch: main/i }));
    // The input is focused on open; Escape from there closes the popup.
    const input = await screen.findByPlaceholderText(/filter/i);
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });

  it("closes on click outside", async () => {
    seed([ref("main", "branch", HEAD_HASH), ref("feature", "branch")], "main");
    const user = userEvent.setup();
    render(
      <div>
        <BranchSwitcher />
        <button data-testid="outside">outside</button>
      </div>,
    );
    await user.click(screen.getByRole("combobox", { name: /current branch: main/i }));
    expect(await screen.findByRole("listbox")).toBeInTheDocument();
    await user.click(screen.getByTestId("outside"));
    await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
  });
});

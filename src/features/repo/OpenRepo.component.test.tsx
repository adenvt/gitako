import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OpenRepo } from "./OpenRepo";
import { useRepoStore } from "@/state/store";
import { open } from "@tauri-apps/plugin-dialog";
import { repoRoot } from "@/state/git";

vi.mock("@tauri-apps/api/path", () => ({ homeDir: vi.fn().mockResolvedValue("/home/user") }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@/state/git", () => ({
  fetchLog: vi.fn().mockResolvedValue([]),
  fetchRefs: vi.fn().mockResolvedValue([]),
  fetchStatus: vi.fn().mockResolvedValue(""),
  fetchShowFiles: vi.fn(),
  fetchDiff: vi.fn(),
  stageFiles: vi.fn(),
  commitChanges: vi.fn(),
  fetchHeadBranch: vi.fn().mockResolvedValue("main"),
  repoRoot: vi.fn().mockResolvedValue("/r"),
}));

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  useRepoStore.setState({
    repoPath: null,
    commits: [],
    error: null,
  });
});

describe("OpenRepo", () => {
  it("renders the welcome brand and header", () => {
    render(<OpenRepo />);
    expect(screen.getByText("GiTako")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /open/i })).toBeInTheDocument();
  });

  it("renders the empty state with an Open button when there are no recents", () => {
    render(<OpenRepo />);
    expect(screen.getByText(/no repositories yet/i)).toBeInTheDocument();
    // Multiple "Open" buttons in the empty state; at least one must exist.
    expect(screen.getAllByRole("button", { name: /open/i }).length).toBeGreaterThan(0);
  });

  it("shows recent repos loaded from localStorage", () => {
    localStorage.setItem(
      "gitako.recentRepos",
      JSON.stringify([{ path: "/p/myrepo", name: "myrepo", lastOpened: 1 }]),
    );
    render(<OpenRepo />);
    expect(screen.getByText("myrepo")).toBeInTheDocument();
  });

  it("filters the recents list by the search query (case-insensitive)", async () => {
    localStorage.setItem(
      "gitako.recentRepos",
      JSON.stringify([
        { path: "/p/myrepo", name: "myrepo", lastOpened: 1 },
        { path: "/p/other", name: "other", lastOpened: 2 },
      ]),
    );
    const user = userEvent.setup();
    render(<OpenRepo />);
    const input = screen.getByPlaceholderText(/search repositories/i);
    await user.type(input, "MYR");
    expect(screen.getByText("myrepo")).toBeInTheDocument();
    expect(screen.queryByText("other")).toBeNull();
  });

  it("clears the search query when the X button is clicked", async () => {
    localStorage.setItem(
      "gitako.recentRepos",
      JSON.stringify([{ path: "/p/myrepo", name: "myrepo", lastOpened: 1 }]),
    );
    const user = userEvent.setup();
    render(<OpenRepo />);
    const input = screen.getByPlaceholderText(/search repositories/i) as HTMLInputElement;
    await user.type(input, "zzz");
    expect(input.value).toBe("zzz");
    await user.click(screen.getByRole("button", { name: /clear search/i }));
    expect(input.value).toBe("");
  });

  it("renders the error from the store in a banner with role=alert", () => {
    useRepoStore.setState({ error: "Failed to open" });
    render(<OpenRepo />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Failed to open");
  });

  it("removes a recent repo when the X button is clicked (stopPropagation prevents the open)", async () => {
    localStorage.setItem(
      "gitako.recentRepos",
      JSON.stringify([{ path: "/p/myrepo", name: "myrepo", lastOpened: 1 }]),
    );
    const user = userEvent.setup();
    render(<OpenRepo />);
    await user.click(screen.getByRole("button", { name: /remove myrepo from recent/i }));
    // Recent list reloaded from storage; the item is gone.
    expect(screen.queryByText("myrepo")).toBeNull();
  });

  it("clicking a recent calls repoRoot + addRecentRepo + openRepo", async () => {
    const openRepo = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ openRepo });
    vi.mocked(repoRoot).mockResolvedValueOnce("/resolved");

    localStorage.setItem(
      "gitako.recentRepos",
      JSON.stringify([{ path: "/p/myrepo", name: "myrepo", lastOpened: 1 }]),
    );
    const user = userEvent.setup();
    render(<OpenRepo />);
    await user.click(screen.getByText("myrepo"));

    await waitFor(() => {
      expect(repoRoot).toHaveBeenCalledWith("/p/myrepo");
      expect(openRepo).toHaveBeenCalledWith("/resolved");
    });
    // addRecentRepo persisted the (now-resolved) path as the most recent.
    const recents = JSON.parse(localStorage.getItem("gitako.recentRepos") ?? "[]");
    expect(recents[0]?.path).toBe("/resolved");
  });

  it("shows a banner when handleOpenPath fails (repoRoot throws)", async () => {
    vi.mocked(repoRoot).mockRejectedValueOnce(new Error("not a git repo"));
    localStorage.setItem(
      "gitako.recentRepos",
      JSON.stringify([{ path: "/bad", name: "bad", lastOpened: 1 }]),
    );
    const user = userEvent.setup();
    render(<OpenRepo />);
    await user.click(screen.getByText("bad"));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/cannot open repository: not a git repo/i);
  });

  it("handleBrowse: opens the dialog and opens the selected path", async () => {
    const openRepo = vi.fn().mockResolvedValue(undefined);
    useRepoStore.setState({ openRepo });
    vi.mocked(open).mockResolvedValueOnce("/picked");
    vi.mocked(repoRoot).mockResolvedValueOnce("/picked-root");

    const user = userEvent.setup();
    render(<OpenRepo />);
    // Click the header's "Open" button (in the welcome header, not the
    // empty-state CTA which won't render when recents are populated).
    const openButtons = screen.getAllByRole("button", { name: /^open$/i });
    await user.click(openButtons[0]!);

    await waitFor(() => {
      expect(open).toHaveBeenCalled();
      expect(repoRoot).toHaveBeenCalledWith("/picked");
      expect(openRepo).toHaveBeenCalledWith("/picked-root");
    });
  });

  it("handleBrowse: no-op when the user cancels the dialog (returns null)", async () => {
    vi.mocked(open).mockResolvedValueOnce(null);
    const user = userEvent.setup();
    render(<OpenRepo />);
    const openButtons = screen.getAllByRole("button", { name: /^open$/i });
    await user.click(openButtons[0]!);
    // Give the promise chain a tick.
    await new Promise((r) => setTimeout(r, 0));
    expect(repoRoot).not.toHaveBeenCalled();
  });

  it("handleBrowse: shows a banner when the dialog plugin itself throws", async () => {
    vi.mocked(open).mockRejectedValueOnce(new Error("plugin crashed"));
    const user = userEvent.setup();
    render(<OpenRepo />);
    const openButtons = screen.getAllByRole("button", { name: /^open$/i });
    await user.click(openButtons[0]!);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/failed to open picker: plugin crashed/i);
  });
});

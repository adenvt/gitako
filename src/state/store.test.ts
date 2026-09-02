import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ChangedFile, Commit, DiffFile, RefInfo } from "@/shared/types/git";
import type { StatusEntry } from "@/shared/utils/status";

// Hoisted mocks for the backend invoke wrappers. The store is the unit under
// test; the backend is a network boundary we want to control fully.
vi.mock("./git", () => ({
  fetchLog: vi.fn(),
  fetchRefs: vi.fn(),
  fetchStatus: vi.fn(),
  fetchShowFiles: vi.fn(),
  fetchDiff: vi.fn(),
  stageFiles: vi.fn(),
  commitChanges: vi.fn(),
  fetchHeadBranch: vi.fn().mockResolvedValue("main"),
  checkoutBranch: vi.fn().mockResolvedValue(""),
  checkoutTrack: vi.fn().mockResolvedValue(""),
  stashSave: vi.fn().mockResolvedValue(""),
  stashPop: vi.fn().mockResolvedValue(undefined),
  fetchAll: vi.fn().mockResolvedValue({ remote: "origin", branch: "main", summary: "" }),
  pullBranch: vi.fn().mockResolvedValue({ remote: "origin", branch: "main", summary: "" }),
}));

// Importing the store AFTER vi.mock so the mock is in place. `act` is
// unused in some cases but kept available for future async-action patterns.
import { useRepoStore } from "./store";
import {
  commitChanges,
  checkoutBranch,
  fetchDiff,
  fetchHeadBranch,
  fetchLog,
  fetchRefs,
  fetchShowFiles,
  fetchStatus,
  pullBranch,
  stageFiles,
  stashPop,
  stashSave,
} from "./git";

const mockFetchLog = vi.mocked(fetchLog);
const mockFetchRefs = vi.mocked(fetchRefs);
const mockFetchStatus = vi.mocked(fetchStatus);
const mockFetchShowFiles = vi.mocked(fetchShowFiles);
const mockFetchDiff = vi.mocked(fetchDiff);
const mockStageFiles = vi.mocked(stageFiles);
const mockCommitChanges = vi.mocked(commitChanges);
const mockFetchHeadBranch = vi.mocked(fetchHeadBranch);
const mockCheckoutBranch = vi.mocked(checkoutBranch);
const mockStashSave = vi.mocked(stashSave);
const mockStashPop = vi.mocked(stashPop);
const mockPullBranch = vi.mocked(pullBranch);

function makeCommit(hash: string, parents: string[] = [], subject = "x"): Commit {
  return {
    hash,
    parents,
    authorName: "Test",
    authorEmail: "t@e",
    authorTime: 0,
    subject,
    refs: [],
  };
}

function makeRef(name: string, commit: string, kind: RefInfo["kind"] = "branch"): RefInfo {
  return {
    name,
    fullName: name,
    kind,
    target: commit,
    commit,
    remote: null,
    remoteUrl: null,
  };
}

function makeFile(path: string, status = "M"): ChangedFile {
  return { status, path, oldPath: null };
}

function makeStatusEntry(path: string, index = "M", worktree = " "): StatusEntry {
  return { index, worktree, path, oldPath: null };
}

function makeDiff(path: string): DiffFile {
  return {
    oldPath: path,
    newPath: path,
    status: "M",
    binary: false,
    tooLarge: false,
    oldLines: [],
    newLines: [],
    hunks: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the store between tests so state doesn't leak.
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
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openRepo", () => {
  it("sets the repo path, fetches log/refs/status, and joins refs to commits", async () => {
    mockFetchLog.mockResolvedValueOnce([makeCommit("c1"), makeCommit("c0")]);
    mockFetchRefs.mockResolvedValueOnce([makeRef("main", "c0")]);
    mockFetchStatus.mockResolvedValueOnce(" M a.ts");

    await useRepoStore.getState().openRepo("/repo");

    const s = useRepoStore.getState();
    expect(s.repoPath).toBe("/repo");
    expect(s.commits).toHaveLength(2);
    // c0 has the `main` ref joined onto it; c1 does not.
    expect(s.commits[0]?.refs).toEqual([]);
    expect(s.commits[1]?.refs).toEqual(["main"]);
    expect(s.refsByCommit["c0"]?.[0]?.name).toBe("main");
    // Layout is computed (lanes are non-negative integers).
    expect(s.layout).not.toBeNull();
    expect(s.layout?.commits.every((c) => c.lane >= 0)).toBe(true);
    // Status was parsed into entries.
    expect(s.statusEntries).toEqual([{ index: ".", worktree: "M", path: "a.ts", oldPath: null }]);
    // Final loading is false even on success.
    expect(s.loading).toBe(false);
    // headBranch is set from the backend (default mock returns "main").
    expect(s.headBranch).toBe("main");
  });

  it("surfaces the error message and clears loading on failure", async () => {
    mockFetchLog.mockRejectedValueOnce(new Error("not a git repo"));
    // refresh also calls fetchStatus; queue a successful response so the
    // .catch(() => "") chain doesn't blow up before the .all rejects.
    mockFetchStatus.mockResolvedValueOnce("");

    await useRepoStore.getState().openRepo("/bad");

    const s = useRepoStore.getState();
    expect(s.error).toBe("not a git repo");
    expect(s.loading).toBe(false);
  });

  it("treats a failing fetchStatus as a non-fatal refresh", async () => {
    // Common case in a fresh repo: `git status` exits 128 if not in a repo.
    // The store swallows the status error so commits/refs still load.
    mockFetchLog.mockResolvedValueOnce([makeCommit("c0")]);
    mockFetchRefs.mockResolvedValueOnce([]);
    mockFetchStatus.mockRejectedValueOnce(new Error("not a repo"));

    await useRepoStore.getState().openRepo("/repo");

    const s = useRepoStore.getState();
    expect(s.error).toBeNull();
    expect(s.commits).toHaveLength(1);
    expect(s.statusEntries).toEqual([]);
  });

  it("stores the HEAD branch name from the backend (authoritative, not commits[0])", async () => {
    // Reproduces the original bug: topo order can place HEAD below another
    // branch's tip, so inferring HEAD from `commits[0]` is wrong. The store
    // trusts `fetchHeadBranch` instead.
    mockFetchLog.mockResolvedValueOnce([makeCommit("c1"), makeCommit("c0")]);
    mockFetchRefs.mockResolvedValueOnce([makeRef("main", "c0"), makeRef("feature", "c1")]);
    mockFetchStatus.mockResolvedValueOnce("");
    mockFetchHeadBranch.mockResolvedValueOnce("feature");

    await useRepoStore.getState().openRepo("/repo");

    const s = useRepoStore.getState();
    expect(s.headBranch).toBe("feature");
  });
});

describe("refresh", () => {
  it("does nothing when there is no open repo", async () => {
    await useRepoStore.getState().refresh();
    expect(mockFetchLog).not.toHaveBeenCalled();
  });

  it("runs the three fetches in parallel", async () => {
    useRepoStore.setState({ repoPath: "/r" });
    mockFetchLog.mockResolvedValueOnce([]);
    mockFetchRefs.mockResolvedValueOnce([]);
    mockFetchStatus.mockResolvedValueOnce("");

    await useRepoStore.getState().refresh();

    expect(mockFetchLog).toHaveBeenCalledWith("/r");
    expect(mockFetchRefs).toHaveBeenCalledWith("/r");
    expect(mockFetchStatus).toHaveBeenCalledWith("/r");
  });

  it("populates stagedPaths from pre-staged files in the status", async () => {
    useRepoStore.setState({ repoPath: "/r" });
    mockFetchLog.mockResolvedValueOnce([]);
    mockFetchRefs.mockResolvedValueOnce([]);
    // Files staged before the app opened (index column non-".").
    mockFetchStatus.mockResolvedValueOnce("A  new.ts\nM  mod.ts\n M work.ts\n?? untracked.ts\n");

    await useRepoStore.getState().refresh();

    const s = useRepoStore.getState();
    expect([...s.stagedPaths].sort()).toEqual(["mod.ts", "new.ts"]);
  });

  it("tags commits pointed at by refs/stash with isStash", async () => {
    useRepoStore.setState({ repoPath: "/r" });
    // Simulate a git log output that includes the WIP stash commit. The
    // `index on` pseudo-commit is filtered out by the backend, so it never
    // reaches the frontend.
    mockFetchLog.mockResolvedValueOnce([
      makeCommit("wip", ["tip"], "On main: WIP on main: abc1234 Save work"),
      makeCommit("tip", [], "feat: prior commit"),
    ]);
    mockFetchRefs.mockResolvedValueOnce([
      makeRef("main", "tip"),
      // The stash ref points at the WIP commit with fullName = "refs/stash".
      {
        name: "refs/stash",
        fullName: "refs/stash",
        kind: "other",
        target: "wip",
        commit: "wip",
        remote: null,
        remoteUrl: null,
      },
    ]);
    mockFetchStatus.mockResolvedValueOnce("");

    await useRepoStore.getState().refresh();

    const s = useRepoStore.getState();
    const wip = s.commits.find((c) => c.hash === "wip");
    const tip = s.commits.find((c) => c.hash === "tip");
    expect(wip?.isStash).toBe(true);
    expect(tip?.isStash).toBe(false);
    // isStash must flow through to the layout for the renderer to see it.
    const wipLayout = s.layout?.commits.find((c) => c.hash === "wip");
    expect(wipLayout?.isStash).toBe(true);
  });
});

describe("select", () => {
  beforeEach(() => {
    // Pre-populate so select has something to deselect.
    useRepoStore.setState({
      selectedHash: "old",
      composerOpen: true,
      activeDiff: { hash: "old", path: "x", staged: false },
      workingSelected: true,
    });
  });

  it("sets the selected hash, closes composer + diff, and clears WIP", () => {
    useRepoStore.getState().select("c1");
    const s = useRepoStore.getState();
    expect(s.selectedHash).toBe("c1");
    expect(s.composerOpen).toBe(false);
    expect(s.activeDiff).toBeNull();
    expect(s.workingSelected).toBe(false);
  });

  it("accepts null to deselect without re-opening anything", () => {
    useRepoStore.getState().select(null);
    expect(useRepoStore.getState().selectedHash).toBeNull();
  });
});

describe("pullLocalBranch", () => {
  // The "refresh this branch" gesture: dblclick on a ref-badge group
  // that has BOTH a local and a remote for the same name fires
  // `pullLocalBranch(branch)`, which must (1) checkout the local
  // branch, (2) run `git pull --ff-only`, (3) refresh, (4) toast.
  beforeEach(() => {
    // The checkout() call inside pullLocalBranch kicks off its own
    // refresh (mockFetchLog + mockFetchRefs). Queue responses so they
    // resolve to no-op values.
    mockFetchLog.mockResolvedValue([]);
    mockFetchRefs.mockResolvedValue([]);
    mockFetchStatus.mockResolvedValue("");
  });

  it("checks out the local branch and then pulls with --ff-only", async () => {
    useRepoStore.setState({ repoPath: "/r" });
    mockCheckoutBranch.mockResolvedValueOnce("");
    mockPullBranch.mockResolvedValueOnce({
      remote: "origin",
      branch: "main",
      summary: "Fast-forward",
    });

    await useRepoStore.getState().pullLocalBranch("main");

    expect(mockCheckoutBranch).toHaveBeenCalledWith("/r", "main");
    expect(mockPullBranch).toHaveBeenCalledWith("/r", "ffOnly");
    // pulling flag must be reset in finally.
    expect(useRepoStore.getState().pulling).toBe(false);
  });

  it("does not call gitStashSave when the working tree is clean", async () => {
    useRepoStore.setState({ repoPath: "/r", statusEntries: [] });
    mockCheckoutBranch.mockResolvedValueOnce("");
    mockPullBranch.mockResolvedValueOnce({ remote: "origin", branch: "main", summary: "" });

    await useRepoStore.getState().pullLocalBranch("main");

    expect(mockStashSave).not.toHaveBeenCalled();
  });

  it("stashes a dirty working tree before checkout, then pops after success", async () => {
    useRepoStore.setState({
      repoPath: "/r",
      statusEntries: [makeStatusEntry("a.ts")],
    });
    mockStashSave.mockResolvedValueOnce("stash@{0}");
    mockCheckoutBranch.mockResolvedValueOnce("");
    mockPullBranch.mockResolvedValueOnce({ remote: "origin", branch: "main", summary: "" });

    await useRepoStore.getState().pullLocalBranch("main");

    expect(mockStashSave).toHaveBeenCalledWith("/r", "auto: pre-checkout main");
    expect(mockCheckoutBranch).toHaveBeenCalled();
    expect(mockStashPop).toHaveBeenCalledWith("/r", "stash@{0}");
  });

  it("surfaces a diverged-branches error with a hint to use the toolbar pull menu", async () => {
    // The backend returns a typed `GitErrorPayload` with kind: "conflict"
    // for non-fast-forward rejections. The store must surface that
    // distinctly from a generic failure.
    useRepoStore.setState({ repoPath: "/r" });
    mockCheckoutBranch.mockResolvedValueOnce("");
    mockPullBranch.mockRejectedValueOnce({
      kind: "conflict",
      message: "Not possible to fast-forward, aborting.",
      code: null,
    });

    await expect(useRepoStore.getState().pullLocalBranch("main")).rejects.toMatchObject({
      kind: "conflict",
    });
    // pulling flag still reset.
    expect(useRepoStore.getState().pulling).toBe(false);
  });

  it("does nothing without a repo path", async () => {
    await useRepoStore.getState().pullLocalBranch("main");
    expect(mockCheckoutBranch).not.toHaveBeenCalled();
    expect(mockPullBranch).not.toHaveBeenCalled();
  });
});

describe("loadCommitFiles", () => {
  it("caches the file list per hash and skips subsequent fetches", async () => {
    useRepoStore.setState({ repoPath: "/r" });
    mockFetchShowFiles.mockResolvedValueOnce([makeFile("a.ts")]);

    await useRepoStore.getState().loadCommitFiles("c1");
    expect(mockFetchShowFiles).toHaveBeenCalledTimes(1);
    expect(useRepoStore.getState().filesByCommit["c1"]).toHaveLength(1);

    // Second call: cache hit, no second fetch.
    await useRepoStore.getState().loadCommitFiles("c1");
    expect(mockFetchShowFiles).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a repo path", async () => {
    await useRepoStore.getState().loadCommitFiles("c1");
    expect(mockFetchShowFiles).not.toHaveBeenCalled();
  });

  it("swallows errors (file list is a nice-to-have)", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    useRepoStore.setState({ repoPath: "/r" });
    mockFetchShowFiles.mockRejectedValueOnce(new Error("boom"));

    await useRepoStore.getState().loadCommitFiles("c1");
    expect(errSpy).toHaveBeenCalled();
    // No state corruption.
    expect(useRepoStore.getState().filesByCommit["c1"]).toBeUndefined();
  });
});

describe("composer open/close + WIP selection", () => {
  it("openComposer clears any active diff and any prior error", () => {
    useRepoStore.setState({
      composerError: "old",
      activeDiff: { hash: "x", path: "y", staged: false },
    });
    useRepoStore.getState().openComposer();
    const s = useRepoStore.getState();
    expect(s.composerOpen).toBe(true);
    expect(s.composerError).toBeNull();
    expect(s.activeDiff).toBeNull();
  });

  it("closeComposer hides the composer and any diff", () => {
    useRepoStore.setState({
      composerOpen: true,
      activeDiff: { hash: "x", path: "y", staged: true },
    });
    useRepoStore.getState().closeComposer();
    const s = useRepoStore.getState();
    expect(s.composerOpen).toBe(false);
    expect(s.activeDiff).toBeNull();
  });

  it("setWorkingSelected(true) also clears any selected commit", () => {
    useRepoStore.setState({ selectedHash: "c1" });
    useRepoStore.getState().setWorkingSelected(true);
    expect(useRepoStore.getState().workingSelected).toBe(true);
    expect(useRepoStore.getState().selectedHash).toBeNull();
  });

  it("setWorkingSelected(false) leaves the selected commit alone", () => {
    useRepoStore.setState({ selectedHash: "c1" });
    useRepoStore.getState().setWorkingSelected(false);
    expect(useRepoStore.getState().workingSelected).toBe(false);
    expect(useRepoStore.getState().selectedHash).toBe("c1");
  });
});

describe("toggleStage", () => {
  beforeEach(() => {
    useRepoStore.setState({ repoPath: "/r" });
  });

  it("optimistically adds a path when staging and calls stageFiles with staged=true", async () => {
    mockStageFiles.mockResolvedValueOnce();
    // After staging, git confirms the file as staged in the index.
    mockFetchStatus.mockResolvedValueOnce("A  a.ts\n");
    await useRepoStore.getState().toggleStage("a.ts", true);
    expect(useRepoStore.getState().stagedPaths.has("a.ts")).toBe(true);
    expect(mockStageFiles).toHaveBeenCalledWith("/r", ["a.ts"], true);
  });

  it("optimistically removes a path when unstaging and calls stageFiles with staged=false", async () => {
    useRepoStore.setState({ stagedPaths: new Set(["a.ts"]) });
    mockStageFiles.mockResolvedValueOnce();
    // After unstaging, git no longer marks the file in the index.
    mockFetchStatus.mockResolvedValueOnce(" M a.ts\n");
    await useRepoStore.getState().toggleStage("a.ts", false);
    expect(useRepoStore.getState().stagedPaths.has("a.ts")).toBe(false);
    expect(mockStageFiles).toHaveBeenCalledWith("/r", ["a.ts"], false);
  });

  it("rolls back the optimistic update and records the error on failure", async () => {
    mockStageFiles.mockRejectedValueOnce(new Error("conflict"));
    useRepoStore.setState({ stagedPaths: new Set() });
    await useRepoStore.getState().toggleStage("a.ts", true);
    const s = useRepoStore.getState();
    expect(s.stagedPaths.has("a.ts")).toBe(false); // rolled back
    expect(s.composerError).toBe("conflict");
  });

  it("does nothing without an open repo", async () => {
    useRepoStore.setState({ repoPath: null });
    await useRepoStore.getState().toggleStage("a.ts", true);
    expect(mockStageFiles).not.toHaveBeenCalled();
  });
});

describe("stageAll", () => {
  beforeEach(() => {
    useRepoStore.setState({
      repoPath: "/r",
      statusEntries: [
        { index: ".", worktree: "M", path: "a.ts", oldPath: null },
        { index: ".", worktree: "A", path: "b.ts", oldPath: null },
        { index: "A", worktree: ".", path: "c.ts", oldPath: null },
      ],
      stagedPaths: new Set(["c.ts"]), // c.ts is already staged
    });
  });

  it("stages every unstaged path and calls the backend once with the full list", async () => {
    mockStageFiles.mockResolvedValueOnce();
    // After stage-all, git confirms all three as staged in the index.
    mockFetchStatus.mockResolvedValueOnce("M  a.ts\nA  b.ts\nA  c.ts\n");
    await useRepoStore.getState().stageAll();
    const s = useRepoStore.getState();
    expect([...s.stagedPaths]).toEqual(expect.arrayContaining(["a.ts", "b.ts", "c.ts"]));
    expect(mockStageFiles).toHaveBeenCalledWith("/r", ["a.ts", "b.ts"], true);
  });

  it("is a no-op when nothing is unstaged", async () => {
    useRepoStore.setState({ stagedPaths: new Set(["a.ts", "b.ts", "c.ts"]) });
    await useRepoStore.getState().stageAll();
    expect(mockStageFiles).not.toHaveBeenCalled();
  });

  it("surfaces the error but does not auto-revert (staged paths stay where they were)", async () => {
    // The implementation re-uses the post-set stagedPaths on error, which
    // is a quirk we pin here: an error doesn't undo the optimistic update.
    useRepoStore.setState({ stagedPaths: new Set() });
    mockStageFiles.mockRejectedValueOnce(new Error("hook failed"));
    await useRepoStore.getState().stageAll();
    const s = useRepoStore.getState();
    expect(s.composerError).toBe("hook failed");
    // Optimistic add remains; this is the current behavior.
    expect(s.stagedPaths.has("a.ts")).toBe(true);
  });
});

describe("unstageAll", () => {
  it("clears the staged set and unstage every path", async () => {
    useRepoStore.setState({
      repoPath: "/r",
      stagedPaths: new Set(["a.ts", "b.ts"]),
    });
    mockStageFiles.mockResolvedValueOnce();
    // After unstage-all, git moves both back to the worktree.
    mockFetchStatus.mockResolvedValueOnce(" M a.ts\n M b.ts\n");
    await useRepoStore.getState().unstageAll();
    expect(useRepoStore.getState().stagedPaths.size).toBe(0);
    expect(mockStageFiles).toHaveBeenCalledWith("/r", ["a.ts", "b.ts"], false);
  });

  it("is a no-op when nothing is staged", async () => {
    useRepoStore.setState({ repoPath: "/r", stagedPaths: new Set() });
    await useRepoStore.getState().unstageAll();
    expect(mockStageFiles).not.toHaveBeenCalled();
  });

  it("restores the staged set on failure (the real intent of an unstage call)", async () => {
    useRepoStore.setState({
      repoPath: "/r",
      stagedPaths: new Set(["a.ts", "b.ts"]),
    });
    mockStageFiles.mockRejectedValueOnce(new Error("hook failed"));
    await useRepoStore.getState().unstageAll();
    const s = useRepoStore.getState();
    expect([...s.stagedPaths]).toEqual(["a.ts", "b.ts"]);
    expect(s.composerError).toBe("hook failed");
  });
});

describe("commit", () => {
  beforeEach(() => {
    useRepoStore.setState({
      repoPath: "/r",
      stagedPaths: new Set(["a.ts"]),
      composerOpen: true,
    });
  });

  it("trims the subject, calls commitChanges, resets staged, closes composer, and refreshes", async () => {
    mockCommitChanges.mockResolvedValueOnce("newhash");
    mockFetchLog.mockResolvedValueOnce([]);
    mockFetchRefs.mockResolvedValueOnce([]);
    mockFetchStatus.mockResolvedValueOnce("");

    await useRepoStore.getState().commit("  subject  ", "body");
    expect(mockCommitChanges).toHaveBeenCalledWith("/r", "subject", "body");
    const s = useRepoStore.getState();
    expect(s.composerOpen).toBe(false);
    expect(s.stagedPaths.size).toBe(0);
    expect(s.activeDiff).toBeNull();
    expect(mockFetchLog).toHaveBeenCalled(); // refresh ran
  });

  it("does nothing when nothing is staged", async () => {
    useRepoStore.setState({ stagedPaths: new Set() });
    await useRepoStore.getState().commit("s", "d");
    expect(mockCommitChanges).not.toHaveBeenCalled();
  });

  it("records the error and does not close the composer on failure", async () => {
    mockCommitChanges.mockRejectedValueOnce(new Error("pre-commit hook failed"));
    await useRepoStore.getState().commit("s", "d");
    const s = useRepoStore.getState();
    expect(s.composerError).toBe("pre-commit hook failed");
    expect(s.composerOpen).toBe(true);
  });
});

describe("openDiff / closeDiff", () => {
  beforeEach(() => {
    useRepoStore.setState({ repoPath: "/r", diffCache: {} });
  });

  it("fetches a diff and caches it under the working-tree key", async () => {
    mockFetchDiff.mockResolvedValueOnce(makeDiff("a.ts"));
    await useRepoStore.getState().openDiff("c1", "a.ts", false);
    const s = useRepoStore.getState();
    expect(s.activeDiff).toEqual({ hash: "c1", path: "a.ts", staged: false });
    const key = "c1|a.ts|w";
    expect(s.diffCache[key]).toBeDefined();
  });

  it("uses a different cache key for staged vs working-tree diffs", async () => {
    mockFetchDiff.mockResolvedValue(makeDiff("a.ts"));
    await useRepoStore.getState().openDiff("c1", "a.ts", false);
    await useRepoStore.getState().openDiff("c1", "a.ts", true);
    // Two different cache entries.
    const s = useRepoStore.getState();
    expect(s.diffCache["c1|a.ts|w"]).toBeDefined();
    expect(s.diffCache["c1|a.ts|s"]).toBeDefined();
    expect(mockFetchDiff).toHaveBeenCalledTimes(2);
  });

  it("reuses the cached diff without re-fetching", async () => {
    const cached = makeDiff("a.ts");
    useRepoStore.setState({ diffCache: { "c1|a.ts|w": cached } });
    await useRepoStore.getState().openDiff("c1", "a.ts", false);
    expect(mockFetchDiff).not.toHaveBeenCalled();
  });

  it("records a placeholder with .error when the diff fetch fails", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetchDiff.mockRejectedValueOnce(new Error("too big"));
    await useRepoStore.getState().openDiff("c1", "a.ts", false);
    const s = useRepoStore.getState();
    const key = "c1|a.ts|w";
    expect(s.diffCache[key]?.error).toBe("too big");
    expect(s.diffCache[key]?.oldLines).toEqual([]);
    expect(errSpy).toHaveBeenCalled();
  });

  it("closeDiff clears activeDiff but keeps the cache", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": makeDiff("a.ts") },
    });
    useRepoStore.getState().closeDiff();
    expect(useRepoStore.getState().activeDiff).toBeNull();
    expect(useRepoStore.getState().diffCache["c1|a.ts|w"]).toBeDefined();
  });

  it("defaults staged to false (working-tree diff) when omitted", async () => {
    mockFetchDiff.mockResolvedValueOnce(makeDiff("a.ts"));
    await useRepoStore.getState().openDiff("c1", "a.ts");
    expect(mockFetchDiff).toHaveBeenCalledWith("/r", "c1", "a.ts", false);
  });

  it("does nothing without an open repo", async () => {
    useRepoStore.setState({ repoPath: null });
    await useRepoStore.getState().openDiff("c1", "a.ts", false);
    expect(mockFetchDiff).not.toHaveBeenCalled();
  });
});

describe("setGraphWidth", () => {
  it("updates the graphWidth value (0 means auto from lane count)", () => {
    useRepoStore.getState().setGraphWidth(200);
    expect(useRepoStore.getState().graphWidth).toBe(200);
  });
});

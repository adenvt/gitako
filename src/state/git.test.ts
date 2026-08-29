import { describe, expect, it, vi } from "vitest";

// Mock the Tauri invoke layer so the wrappers under test are isolated
// from the actual backend.
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import {
  commitChanges,
  fetchDiff,
  fetchLog,
  fetchRefs,
  fetchShowFiles,
  fetchStatus,
  repoRoot,
  resolveRev,
  stageFiles,
} from "./git";

const mockInvoke = vi.mocked(invoke);

describe("state/git wrappers", () => {
  it("fetchLog invokes 'git_log' with the repoPath", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await fetchLog("/r");
    expect(mockInvoke).toHaveBeenCalledWith("git_log", { repoPath: "/r" });
  });

  it("fetchRefs invokes 'git_refs' with the repoPath", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await fetchRefs("/r");
    expect(mockInvoke).toHaveBeenCalledWith("git_refs", { repoPath: "/r" });
  });

  it("resolveRev invokes 'git_rev_parse' with repoPath + rev", async () => {
    mockInvoke.mockResolvedValueOnce("abc");
    await resolveRev("/r", "HEAD");
    expect(mockInvoke).toHaveBeenCalledWith("git_rev_parse", { repoPath: "/r", rev: "HEAD" });
  });

  it("repoRoot invokes 'git_repo_root' with `path` (NOT `repoPath`)", async () => {
    // The arg name differs from other calls — a regression guard.
    mockInvoke.mockResolvedValueOnce("/r");
    await repoRoot("/r");
    expect(mockInvoke).toHaveBeenCalledWith("git_repo_root", { path: "/r" });
  });

  it("fetchStatus invokes 'git_status' and returns the raw stdout string", async () => {
    mockInvoke.mockResolvedValueOnce(" M a.ts");
    const out = await fetchStatus("/r");
    expect(mockInvoke).toHaveBeenCalledWith("git_status", { repoPath: "/r" });
    expect(out).toBe(" M a.ts");
  });

  it("fetchShowFiles invokes 'git_show_files' with repoPath + rev", async () => {
    mockInvoke.mockResolvedValueOnce([]);
    await fetchShowFiles("/r", "abc");
    expect(mockInvoke).toHaveBeenCalledWith("git_show_files", { repoPath: "/r", rev: "abc" });
  });

  it("stageFiles invokes 'git_stage' with paths and the staged flag", async () => {
    mockInvoke.mockResolvedValueOnce(undefined);
    await stageFiles("/r", ["a.ts", "b.ts"], true);
    expect(mockInvoke).toHaveBeenCalledWith("git_stage", {
      repoPath: "/r",
      paths: ["a.ts", "b.ts"],
      staged: true,
    });
  });

  it("commitChanges invokes 'git_commit' with trimmed subject (the store does the trim)", async () => {
    // The store calls .trim() before invoking; the wrapper passes through.
    mockInvoke.mockResolvedValueOnce("newhash");
    await commitChanges("/r", "subject", "body");
    expect(mockInvoke).toHaveBeenCalledWith("git_commit", {
      repoPath: "/r",
      subject: "subject",
      description: "body",
    });
  });

  it("fetchDiff invokes 'git_diff' with the staged flag (default false)", async () => {
    mockInvoke.mockResolvedValueOnce({});
    await fetchDiff("/r", "abc", "p.ts");
    expect(mockInvoke).toHaveBeenCalledWith("git_diff", {
      repoPath: "/r",
      rev: "abc",
      path: "p.ts",
      staged: false,
    });
  });

  it("fetchDiff forwards staged=true when requested", async () => {
    mockInvoke.mockResolvedValueOnce({});
    await fetchDiff("/r", "abc", "p.ts", true);
    expect(mockInvoke).toHaveBeenCalledWith("git_diff", {
      repoPath: "/r",
      rev: "abc",
      path: "p.ts",
      staged: true,
    });
  });

  it("rethrows a typed GitErrorPayload on failure (via toGitError cast)", async () => {
    const payload = { kind: "notARepo", message: "fatal: not a git repo", code: 128 };
    mockInvoke.mockRejectedValueOnce(payload);
    await expect(fetchLog("/bad")).rejects.toEqual(payload);
  });

  it("rethrows errors from every wrapper (the try/catch on every method is exercised)", async () => {
    // For each wrapper, queue a rejected invoke and confirm the rethrow.
    // The wrappers share an identical try/catch shape, so a single test
    // covering one of them was enough — but a few additional calls
    // guarantee the catch path is reachable across the whole file.
    const boom = new Error("boom");
    mockInvoke.mockRejectedValueOnce(boom);
    await expect(fetchRefs("/r")).rejects.toBe(boom);
    mockInvoke.mockRejectedValueOnce(boom);
    await expect(resolveRev("/r", "HEAD")).rejects.toBe(boom);
    mockInvoke.mockRejectedValueOnce(boom);
    await expect(repoRoot("/bad")).rejects.toBe(boom);
    mockInvoke.mockRejectedValueOnce(boom);
    await expect(fetchStatus("/r")).rejects.toBe(boom);
    mockInvoke.mockRejectedValueOnce(boom);
    await expect(fetchShowFiles("/r", "x")).rejects.toBe(boom);
    mockInvoke.mockRejectedValueOnce(boom);
    await expect(stageFiles("/r", ["a"], true)).rejects.toBe(boom);
    mockInvoke.mockRejectedValueOnce(boom);
    await expect(commitChanges("/r", "s", "d")).rejects.toBe(boom);
    mockInvoke.mockRejectedValueOnce(boom);
    await expect(fetchDiff("/r", "x", "p")).rejects.toBe(boom);
  });
});

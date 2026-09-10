import { describe, expect, it } from "vitest";
import { groupRefsForBadging } from "./CommitList";
import type { RefInfo } from "@/shared/types/git";

function makeRef(overrides: Partial<RefInfo>): RefInfo {
  return {
    name: "main",
    fullName: "main",
    kind: "branch",
    target: "abc",
    commit: "abc",
    remote: null,
    remoteUrl: null,
    ...overrides,
  };
}

describe("groupRefsForBadging", () => {
  it("returns an empty array for an empty ref list", () => {
    expect(groupRefsForBadging([])).toEqual([]);
  });

  it("groups a local and remote branch with the same base name", () => {
    // `main` and `origin/main` should land in the same group so the UI
    // renders them as one badge with two icons.
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
    ];
    const groups = groupRefsForBadging(refs);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
    expect(groups[0]?.map((r) => r.fullName)).toEqual(["main", "origin/main"]);
  });

  it("keeps refs with distinct base names in separate groups", () => {
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
      makeRef({ name: "feat/x", fullName: "feat/x", kind: "branch" }),
      makeRef({ name: "v1.0.0", fullName: "v1.0.0", kind: "tag" }),
    ];
    const groups = groupRefsForBadging(refs);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.length)).toEqual([2, 1, 1]);
  });

  it("hides the remote convenience pointer (remoteBranch with name 'HEAD')", () => {
    // The `origin/HEAD` annotation is filtered out so it doesn't render
    // as its own badge — it would always clutter the list.
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
      makeRef({
        name: "HEAD",
        fullName: "origin/HEAD",
        kind: "remoteBranch",
        remote: "origin",
      }),
    ];
    const groups = groupRefsForBadging(refs);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.map((r) => r.name)).toEqual(["main"]);
  });

  it("hides the stash ref (fullName 'refs/stash') so stash commits don't show a badge", () => {
    // The stash entry is the only thing pointing at the WIP commit; we
    // don't want a "refs/stash" pill cluttering the row.
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
      makeRef({ name: "refs/stash", fullName: "refs/stash", kind: "other" }),
    ];
    const groups = groupRefsForBadging(refs);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.map((r) => r.name)).toEqual(["main"]);
  });

  it("does NOT hide a local HEAD (kind=head, name=HEAD)", () => {
    // Only the *remote* HEAD is filtered — the local HEAD ref should be
    // visible so detached-HEAD state is recognisable in the UI.
    const refs = [makeRef({ name: "HEAD", fullName: "HEAD", kind: "head" })];
    const groups = groupRefsForBadging(refs);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.[0]?.kind).toBe("head");
  });

  it("does NOT hide a non-remote ref that happens to be named HEAD", () => {
    // Defensive: if a tag or branch were ever called "HEAD", keep it.
    const refs = [makeRef({ name: "HEAD", fullName: "HEAD", kind: "tag" })];
    const groups = groupRefsForBadging(refs);
    expect(groups).toHaveLength(1);
  });

  it("preserves input order within a group", () => {
    // The component uses index 0 of the group as the badge key, so order
    // is part of the contract.
    const refs = [
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
    ];
    const groups = groupRefsForBadging(refs);
    expect(groups[0]?.map((r) => r.fullName)).toEqual(["origin/main", "main"]);
  });

  it("groups three refs sharing the same name (e.g. local + 2 remotes)", () => {
    const refs = [
      makeRef({ name: "main", fullName: "main", kind: "branch" }),
      makeRef({
        name: "main",
        fullName: "origin/main",
        kind: "remoteBranch",
        remote: "origin",
      }),
      makeRef({
        name: "main",
        fullName: "upstream/main",
        kind: "remoteBranch",
        remote: "upstream",
      }),
    ];
    const groups = groupRefsForBadging(refs);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(3);
  });
});

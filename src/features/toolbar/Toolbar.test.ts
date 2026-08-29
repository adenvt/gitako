import { describe, expect, it } from "vitest";
import { pickLocalBranch, repoNameFromPath } from "./Toolbar";

describe("pickLocalBranch", () => {
  it("returns the first ref without a '/' for a mixed list", () => {
    // Common case: a commit is pointed to by `main` (local) and `origin/main` (remote).
    expect(pickLocalBranch(["origin/main", "main"])).toBe("main");
    // Order matters — local refs typically come first in the ref listing.
    expect(pickLocalBranch(["main", "origin/main", "HEAD"])).toBe("main");
  });

  it("returns 'detached HEAD' when no ref lacks a slash", () => {
    // All refs are remote tracking branches; the user is in detached HEAD.
    expect(pickLocalBranch(["origin/main", "upstream/main"])).toBe("detached HEAD");
  });

  it("returns 'detached HEAD' for an empty ref list", () => {
    expect(pickLocalBranch([])).toBe("detached HEAD");
  });

  it("returns a tag name (which never has a slash) as a valid branch display", () => {
    // Tags are treated the same as branches here — the toolbar shows whatever
    // the first non-remote ref is. Documented behavior.
    expect(pickLocalBranch(["v1.0.0"])).toBe("v1.0.0");
  });
});

describe("repoNameFromPath", () => {
  it("returns the last path component of a normal repo path", () => {
    expect(repoNameFromPath("/home/user/projects/myrepo")).toBe("myrepo");
  });

  it("ignores trailing slashes", () => {
    expect(repoNameFromPath("/home/user/projects/myrepo/")).toBe("myrepo");
  });

  it("ignores empty segments from double slashes", () => {
    expect(repoNameFromPath("/home//user//repo")).toBe("repo");
  });

  it("returns undefined for null / undefined / empty input", () => {
    expect(repoNameFromPath(null)).toBeUndefined();
    expect(repoNameFromPath(undefined)).toBeUndefined();
    expect(repoNameFromPath("")).toBeUndefined();
  });

  it("returns undefined for a path with no non-empty segments (all slashes)", () => {
    expect(repoNameFromPath("///")).toBeUndefined();
  });
});

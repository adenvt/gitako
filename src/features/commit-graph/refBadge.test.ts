import { describe, expect, it } from "vitest";
import { providerFromUrl, refFullName } from "./refBadge";
import type { RefInfo } from "@/shared/types/git";

function makeRef(overrides: Partial<RefInfo>): RefInfo {
  return {
    name: "main",
    fullName: "main",
    kind: "branch",
    target: "abc123",
    commit: "abc123",
    remote: null,
    remoteUrl: null,
    ...overrides,
  };
}

describe("providerFromUrl", () => {
  it("returns null for empty / nullish URLs", () => {
    expect(providerFromUrl(null)).toBeNull();
    expect(providerFromUrl(undefined)).toBeNull();
    expect(providerFromUrl("")).toBeNull();
  });

  it("detects github.com on https URLs", () => {
    expect(providerFromUrl("https://github.com/foo/bar.git")).toBe("github");
  });

  it("detects gitlab.com on https URLs", () => {
    expect(providerFromUrl("https://gitlab.com/foo/bar.git")).toBe("gitlab");
  });

  it("detects bitbucket.org on https URLs", () => {
    expect(providerFromUrl("https://bitbucket.org/foo/bar.git")).toBe("bitbucket");
  });

  it("detects each provider from ssh-style URLs", () => {
    expect(providerFromUrl("git@github.com:foo/bar.git")).toBe("github");
    expect(providerFromUrl("git@gitlab.com:foo/bar.git")).toBe("gitlab");
    expect(providerFromUrl("git@bitbucket.org:foo/bar.git")).toBe("bitbucket");
  });

  it("handles self-hosted variants on the public domain suffixes", () => {
    // The matcher is intentionally lenient: any URL containing the provider
    // substring is attributed to that provider.
    expect(providerFromUrl("https://github.example.com/foo/bar.git")).toBe("github");
    expect(providerFromUrl("https://gitlab.example.com/foo/bar.git")).toBe("gitlab");
    expect(providerFromUrl("https://bitbucket.example.com/foo/bar.git")).toBe("bitbucket");
  });

  it("returns null for non-hosted remotes (local / generic hosts)", () => {
    expect(providerFromUrl("/var/repos/local.git")).toBeNull();
    expect(providerFromUrl("https://git.example.org/foo/bar.git")).toBeNull();
    expect(providerFromUrl("ssh://user@host/repo.git")).toBeNull();
  });
});

describe("refFullName", () => {
  it("returns just the name for local branches / tags / heads", () => {
    expect(refFullName(makeRef({ name: "main", kind: "branch" }))).toBe("main");
    expect(refFullName(makeRef({ name: "v1.0.0", kind: "tag" }))).toBe("v1.0.0");
    expect(
      refFullName(makeRef({ name: "HEAD", kind: "head", fullName: "HEAD" })),
    ).toBe("HEAD");
  });

  it("prefixes with the remote name for remote branches", () => {
    expect(
      refFullName(
        makeRef({
          name: "main",
          kind: "remoteBranch",
          remote: "origin",
          fullName: "origin/main",
        }),
      ),
    ).toBe("origin/main");
  });

  it("falls back to the bare name when a remote branch has no remote attribute", () => {
    // Defensive: shouldn't happen for real remote branches, but the function
    // must not produce "undefined/foo" in that case.
    expect(
      refFullName(
        makeRef({ name: "main", kind: "remoteBranch", remote: null, fullName: "origin/main" }),
      ),
    ).toBe("main");
  });
});

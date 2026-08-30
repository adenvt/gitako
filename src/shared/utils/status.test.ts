import { describe, expect, it } from "vitest";
import { countByKind, countChanges, parsePorcelain, statusLabel } from "./status";

describe("statusLabel", () => {
  it("maps known status letters to human labels", () => {
    expect(statusLabel("A")).toBe("Added");
    expect(statusLabel("M")).toBe("Modified");
    expect(statusLabel("D")).toBe("Deleted");
    expect(statusLabel("R")).toBe("Renamed");
    expect(statusLabel("C")).toBe("Copied");
    expect(statusLabel("T")).toBe("Type changed");
    expect(statusLabel("U")).toBe("Unmerged");
  });

  it("uses the first character for status strings with a score suffix", () => {
    // `git status --porcelain` produces strings like "R100" for renames.
    expect(statusLabel("R100")).toBe("Renamed");
    expect(statusLabel("C075")).toBe("Copied");
  });

  it("returns the input unchanged for unknown letters", () => {
    expect(statusLabel("Z")).toBe("Z");
    expect(statusLabel("")).toBe("");
  });
});

describe("parsePorcelain", () => {
  it("returns an empty list for empty input", () => {
    expect(parsePorcelain("")).toEqual([]);
  });

  it("ignores malformed lines that are too short", () => {
    // Each real line is at least 4 chars: `<XY> <path>` (2 + 1 + >=1).
    expect(parsePorcelain("M\nMM\nM  \n")).toEqual([]);
  });

  it("parses a simple modified file with no spaces in path", () => {
    const out = parsePorcelain(" M README.md");
    expect(out).toEqual([{ index: ".", worktree: "M", path: "README.md", oldPath: null }]);
  });

  it("normalizes spaces to '.' and untracked '?' to 'A' (on both slots)", () => {
    const out = parsePorcelain("?? new.ts");
    // `?` is the untracked marker; the parser normalizes it to `A` on
    // BOTH index and worktree slots, so a single untracked file shows up
    // as `added` (worktree wins when both index/worktree are the same).
    expect(out).toEqual([{ index: "A", worktree: "A", path: "new.ts", oldPath: null }]);
  });

  it("preserves a real status letter on the index side (staged add)", () => {
    const out = parsePorcelain("A  new.ts");
    expect(out).toEqual([{ index: "A", worktree: ".", path: "new.ts", oldPath: null }]);
  });

  it("parses renames with both old and new path", () => {
    const out = parsePorcelain("R  old.ts -> new.ts");
    expect(out).toEqual([{ index: "R", worktree: ".", path: "new.ts", oldPath: "old.ts" }]);
  });

  it("handles multiple lines in one pass", () => {
    const out = parsePorcelain([" M a.ts", "M  b.ts", "?? c.ts", "A  d.ts", "D  e.ts"].join("\n"));
    expect(out).toHaveLength(5);
    expect(out[0]).toMatchObject({ index: ".", worktree: "M", path: "a.ts" });
    expect(out[1]).toMatchObject({ index: "M", worktree: ".", path: "b.ts" });
    expect(out[2]).toMatchObject({ worktree: "A", path: "c.ts" });
    expect(out[3]).toMatchObject({ index: "A", path: "d.ts" });
    expect(out[4]).toMatchObject({ index: "D", path: "e.ts" });
  });

  it("tolerates paths with spaces (the path is everything from char 3 to end-of-line)", () => {
    const out = parsePorcelain(' M "weird name.ts"');
    // Note: the parser doesn't strip quotes; it stores the raw substring.
    // This test pins current behavior so any future change is intentional.
    expect(out).toEqual([{ index: ".", worktree: "M", path: '"weird name.ts"', oldPath: null }]);
  });
});

describe("countChanges", () => {
  it("returns 0 for an empty list", () => {
    expect(countChanges([])).toBe(0);
  });

  it("counts entries that have any non-dot status on either side", () => {
    const entries = [
      { index: ".", worktree: ".", path: "clean.ts", oldPath: null },
      { index: ".", worktree: "M", path: "modified.ts", oldPath: null },
      { index: "A", worktree: ".", path: "added.ts", oldPath: null },
      { index: "D", worktree: ".", path: "deleted.ts", oldPath: null },
    ];
    expect(countChanges(entries)).toBe(3);
  });
});

describe("countByKind", () => {
  it("returns zeros for an empty list", () => {
    expect(countByKind([])).toEqual({ added: 0, deleted: 0, modified: 0 });
  });

  it("prefers the index status when both sides differ (e.g. AM counts as added)", () => {
    // A file with `A` in the index and `M` in the worktree was added in the
    // index and then further modified in the worktree. The UI should treat
    // it as "added" (the staged status wins).
    const entries = [
      { index: "A", worktree: "M", path: "a.ts", oldPath: null },
      { index: "D", worktree: "M", path: "b.ts", oldPath: null },
    ];
    expect(countByKind(entries)).toEqual({ added: 1, deleted: 1, modified: 0 });
  });

  it("groups working-tree changes by their worktree status when the index is clean", () => {
    const entries = [
      { index: ".", worktree: "A", path: "a.ts", oldPath: null },
      { index: ".", worktree: "D", path: "b.ts", oldPath: null },
      { index: ".", worktree: "M", path: "c.ts", oldPath: null },
      { index: ".", worktree: "M", path: "d.ts", oldPath: null },
    ];
    expect(countByKind(entries)).toEqual({ added: 1, deleted: 1, modified: 2 });
  });

  it("counts untracked ('?' normalized to 'A') as added", () => {
    const entries = [
      { index: ".", worktree: "A", path: "u.ts", oldPath: null }, // from normalized `??`
    ];
    expect(countByKind(entries)).toEqual({ added: 1, deleted: 0, modified: 0 });
  });

  it("buckets unrecognised status letters as 'modified'", () => {
    // Anything not A/D falls into the modified bucket. This is the catch-all
    // the composer relies on for R/C/T/etc.
    const entries = [
      { index: ".", worktree: "R", path: "r.ts", oldPath: "old.ts" },
      { index: ".", worktree: "T", path: "t.ts", oldPath: null },
    ];
    expect(countByKind(entries)).toEqual({ added: 0, deleted: 0, modified: 2 });
  });
});

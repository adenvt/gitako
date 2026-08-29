import { describe, expect, it } from "vitest";
import { buildFileTree, collectDirPaths } from "./fileTree";

describe("buildFileTree", () => {
  it("returns an empty root for no entries", () => {
    const root = buildFileTree([]);
    expect(root.name).toBe("…");
    expect(root.path).toBe("");
    expect(root.children).toEqual([]);
    expect(root.isFile).toBe(false);
  });

  it("creates file nodes for top-level files (no directories)", () => {
    const root = buildFileTree([
      { path: "a.ts", status: "M" },
      { path: "b.ts", status: "A" },
    ]);
    expect(root.children).toHaveLength(2);
    expect(root.children.every((c) => c.isFile)).toBe(true);
    expect(root.children[0]?.name).toBe("a.ts");
    expect(root.children[0]?.path).toBe("a.ts");
    expect(root.children[0]?.status).toBe("M");
  });

  it("creates intermediate directory nodes for nested paths", () => {
    const root = buildFileTree([
      { path: "src/index.ts", status: "M" },
      { path: "src/lib/util.ts", status: "A" },
    ]);
    expect(root.children).toHaveLength(1);
    const src = root.children[0]!;
    expect(src.isFile).toBe(false);
    expect(src.name).toBe("src");
    expect(src.path).toBe("src");
    expect(src.status).toBe(""); // directories have no status
    // src has two children: the file `index.ts` and the dir `lib`.
    expect(src.children).toHaveLength(2);
    const lib = src.children.find((c) => c.name === "lib")!;
    expect(lib.isFile).toBe(false);
    expect(lib.children).toHaveLength(1);
    expect(lib.children[0]?.name).toBe("util.ts");
  });

  it("merges multiple files under the same directory into one node", () => {
    const root = buildFileTree([
      { path: "src/a.ts", status: "M" },
      { path: "src/b.ts", status: "M" },
      { path: "src/c.ts", status: "A" },
    ]);
    expect(root.children).toHaveLength(1);
    const src = root.children[0]!;
    expect(src.children).toHaveLength(3);
  });

  it("sorts directories before files, alphabetically within each group", () => {
    const root = buildFileTree([
      { path: "zebra.ts", status: "M" },
      { path: "alpha.ts", status: "M" },
      { path: "middle/file.ts", status: "M" },
    ]);
    // Expected top-level order: `middle` (dir) then alpha, zebra (files).
    expect(root.children.map((c) => c.name)).toEqual(["middle", "alpha.ts", "zebra.ts"]);
    // Inside `middle` (the only child), file sorts after any dirs (none here).
    const middle = root.children[0]!;
    expect(middle.children.map((c) => c.name)).toEqual(["file.ts"]);
  });

  it("attaches only the first status character to leaf nodes (score-suffix tolerance)", () => {
    // Real status strings may be "R100" for renames; the tree only stores
    // the kind letter, matching how icons are colored in the UI.
    const root = buildFileTree([{ path: "renamed.ts", status: "R100" }]);
    expect(root.children[0]?.status).toBe("R");
  });

  it("uses an empty string when a status has no first character", () => {
    // Defensive: empty status would be `""[0] ?? ""` -> `""`. Verify it
    // doesn't throw and yields the empty string.
    const root = buildFileTree([{ path: "x.ts", status: "" }]);
    expect(root.children[0]?.status).toBe("");
  });

  it("sorts recursively at every level", () => {
    const root = buildFileTree([
      { path: "src/z.ts", status: "M" },
      { path: "src/y/dir/file.ts", status: "M" },
      { path: "src/y/a.ts", status: "M" },
    ]);
    const src = root.children[0]!;
    // src has y (dir) and z.ts (file). Directories first.
    expect(src.children.map((c) => c.name)).toEqual(["y", "z.ts"]);
    const y = src.children[0]!;
    // y's children: `dir` (subdir) then `a.ts` (file) — directories first.
    expect(y.children.map((c) => c.name)).toEqual(["dir", "a.ts"]);
  });
});

describe("collectDirPaths", () => {
  it("returns an empty list when there are no directories", () => {
    const root = buildFileTree([
      { path: "a.ts", status: "M" },
      { path: "b.ts", status: "M" },
    ]);
    expect(collectDirPaths(root)).toEqual([]);
  });

  it("returns one path per directory, in DFS order", () => {
    const root = buildFileTree([
      { path: "src/a.ts", status: "M" },
      { path: "src/lib/b.ts", status: "M" },
    ]);
    expect(collectDirPaths(root)).toEqual(["src", "src/lib"]);
  });

  it("never includes the implicit root (empty path)", () => {
    // The root has path = "" — collectDirPaths must skip it.
    const root = buildFileTree([{ path: "a.ts", status: "M" }]);
    const dirs = collectDirPaths(root);
    expect(dirs).not.toContain("");
  });

  it("handles deeply nested directories", () => {
    const root = buildFileTree([{ path: "a/b/c/d/file.ts", status: "M" }]);
    expect(collectDirPaths(root)).toEqual(["a", "a/b", "a/b/c", "a/b/c/d"]);
  });
});

import { describe, expect, it } from "vitest";
import { buildRows } from "./DiffView";
import type { DiffFile, DiffHunk } from "@/shared/types/git";

/** Shorthand to build a hunk from a sequence of [kind, text] line tuples. */
function hunk(
  oldStart: number,
  newStart: number,
  lines: Array<["context" | "add" | "remove", string]>,
): DiffHunk {
  let oldLines = 0;
  let newLines = 0;
  const out = lines.map(([kind, text]) => {
    if (kind === "context") {
      oldLines++;
      newLines++;
    } else if (kind === "add") {
      newLines++;
    } else {
      oldLines++;
    }
    return { kind, text };
  });
  return { oldStart, newStart, oldLines, newLines, lines: out };
}

/** Build a minimal DiffFile carrying just what buildRows reads. */
function diff(
  oldLines: string[],
  newLines: string[],
  hunks: DiffHunk[],
  extra: Partial<DiffFile> = {},
): DiffFile {
  return {
    oldPath: "a",
    newPath: "b",
    status: "M",
    binary: false,
    tooLarge: false,
    oldLines,
    newLines,
    hunks,
    ...extra,
  };
}

describe("buildRows", () => {
  it("returns an empty row list when there are no hunks and no lines", () => {
    const rows = buildRows(diff([], [], []));
    expect(rows).toEqual([]);
  });

  it("renders a full-file context hunk (one paired row per line)", () => {
    // @@ -1,3 +1,3 @@ -> 3 context lines, lines 1..3 on both sides.
    const rows = buildRows(
      diff(
        ["a", "b", "c"],
        ["a", "b", "c"],
        [hunk(1, 1, [["context", "a"], ["context", "b"], ["context", "c"]])],
      ),
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      oldKind: null,
      oldLine: "a",
      oldNum: 1,
      newKind: null,
      newLine: "a",
      newNum: 1,
    });
    expect(rows[2]?.oldNum).toBe(3);
    expect(rows[2]?.newNum).toBe(3);
  });

  it("pairs a removal with the following addition as a single edit row", () => {
    // @@ -1,2 +1,2 @@: remove "x", add "y" -> one row, both sides populated.
    const rows = buildRows(
      diff(
        ["a", "x", "c"],
        ["a", "y", "c"],
        [hunk(1, 1, [["context", "a"], ["remove", "x"], ["add", "y"], ["context", "c"]])],
      ),
    );
    expect(rows).toHaveLength(3);
    const edit = rows[1]!;
    expect(edit.oldKind).toBe("remove");
    expect(edit.oldLine).toBe("x");
    expect(edit.oldNum).toBe(2);
    expect(edit.newKind).toBe("add");
    expect(edit.newLine).toBe("y");
    expect(edit.newNum).toBe(2);
  });

  it("renders unpaired removals as left-only rows flushed at the next context", () => {
    // @@ -1,3 +1,1 @@: remove two lines, then context. The two removals
    // can't be paired with any add -> they should be left-only.
    const rows = buildRows(
      diff(
        ["a", "b", "c", "d"],
        ["a", "d"],
        [hunk(1, 1, [["context", "a"], ["remove", "b"], ["remove", "c"], ["context", "d"]])],
      ),
    );
    // Expected: context(a), remove(b), remove(c), context(d) -> 4 rows.
    expect(rows).toHaveLength(4);
    const removedB = rows[1]!;
    const removedC = rows[2]!;
    expect(removedB.oldKind).toBe("remove");
    expect(removedB.oldLine).toBe("b");
    expect(removedB.newLine).toBeNull();
    expect(removedB.newNum).toBeNull();
    expect(removedC.oldLine).toBe("c");
    expect(removedC.newLine).toBeNull();
    // The trailing context still pairs correctly.
    expect(rows[3]?.oldNum).toBe(4);
    expect(rows[3]?.newNum).toBe(2);
  });

  it("renders unpaired additions as right-only standalone rows", () => {
    // @@ -1,1 +1,3 @@: one context + two adds.
    const rows = buildRows(
      diff(
        ["a"],
        ["a", "b", "c"],
        [hunk(1, 1, [["context", "a"], ["add", "b"], ["add", "c"]])],
      ),
    );
    expect(rows).toHaveLength(3);
    const addedB = rows[1]!;
    expect(addedB.oldLine).toBeNull();
    expect(addedB.oldNum).toBeNull();
    expect(addedB.newKind).toBe("add");
    expect(addedB.newLine).toBe("b");
    expect(addedB.newNum).toBe(2);
  });

  it("pairs consecutive edits one-to-one (remove,add,remove,add -> 2 edit rows)", () => {
    // @@ -1,3 +1,3 @@: keep a, swap b->B, swap c->C.
    const rows = buildRows(
      diff(
        ["a", "b", "c"],
        ["a", "B", "C"],
        [
          hunk(1, 1, [
            ["context", "a"],
            ["remove", "b"],
            ["add", "B"],
            ["remove", "c"],
            ["add", "C"],
          ]),
        ],
      ),
    );
    expect(rows).toHaveLength(3);
    expect(rows[1]).toMatchObject({ oldLine: "b", newLine: "B" });
    expect(rows[2]).toMatchObject({ oldLine: "c", newLine: "C" });
  });

  it("clamps the gap between two hunks to the shorter side, then drains overflow on its own side", () => {
    // old: 10 lines, new: 5 lines. Hunk 1 covers line 1 (both sides).
    // Hunk 2 starts at old 10 / new 5 — i.e. there's an 8-line / 3-line gap
    // between them. The function emits `min(8, 3) = 3` paired context rows,
    // then the overflow tail drains remaining old lines as left-only rows.
    const oldLines = ["L1", "L2", "L3", "L4", "L5", "L6", "L7", "L8", "L9", "L10"];
    const newLines = ["L1", "L2", "L3", "L4", "L5"];
    const rows = buildRows(
      diff(oldLines, newLines, [
        hunk(1, 1, [["context", "L1"]]),
        hunk(10, 5, [["context", "L10"]]),
      ]),
    );
    // Expected: L1 (hunk1) + L2/L3/L4 (3 paired gap) + L5 (hunk2) +
    // L6..L10 drained as overflow = 10 rows.
    expect(rows).toHaveLength(10);
    // First 5 rows are properly paired (oldLine === newLine).
    expect(rows[0]).toMatchObject({ oldLine: "L1", newLine: "L1", oldNum: 1, newNum: 1 });
    expect(rows[1]).toMatchObject({ oldLine: "L2", newLine: "L2" });
    expect(rows[2]).toMatchObject({ oldLine: "L3", newLine: "L3" });
    expect(rows[3]).toMatchObject({ oldLine: "L4", newLine: "L4" });
    expect(rows[4]).toMatchObject({ oldLine: "L5", newLine: "L5", oldNum: 5, newNum: 5 });
    // The remaining old lines (L6..L10) are dumped as left-only context
    // rows; new side is null. New-line numbers stay at 5 (no longer used).
    for (let i = 5; i < rows.length; i++) {
      const r = rows[i]!;
      expect(r.oldLine).toBe(oldLines[i]);
      expect(r.oldNum).toBe(i + 1);
      expect(r.newLine).toBeNull();
      expect(r.newNum).toBeNull();
    }
  });

  it("flushes pending removals at the end of every hunk (so they appear before the next hunk's gap)", () => {
    // Two hunks, valid line numbers. Hunk 1 ends with a remove; hunk 2 has
    // a context line that's far enough away to leave a gap on the new side
    // only (so we exercise the gap clamp AND the hunk-end flush).
    const oldLines = ["a", "b", "c", "d", "e"];
    const newLines = ["a", "c", "d", "e"];
    const rows = buildRows(
      diff(oldLines, newLines, [
        // Hunk 1: keep "a", remove "b". Valid: -1,2 +1,1.
        hunk(1, 1, [["context", "a"], ["remove", "b"]]),
        // Hunk 2: "c" is at new index 2 (after the deletion), old index 3.
        // -3,3 +2,3 with 3 context lines that line up.
        hunk(3, 2, [["context", "c"], ["context", "d"], ["context", "e"]]),
      ]),
    );
    // 1 (a) + 1 (remove b) + 3 (c, d, e) = 5 rows, all paired correctly
    // because the gap math has no new-side overflow.
    expect(rows).toHaveLength(5);
    expect(rows[0]).toMatchObject({ oldLine: "a", newLine: "a" });
    expect(rows[1]).toMatchObject({
      oldKind: "remove",
      oldLine: "b",
      oldNum: 2,
      newLine: null,
      newNum: null,
    });
    expect(rows[2]).toMatchObject({ oldLine: "c", newLine: "c", oldNum: 3, newNum: 2 });
    expect(rows[3]).toMatchObject({ oldLine: "d", newLine: "d", oldNum: 4, newNum: 3 });
    expect(rows[4]).toMatchObject({ oldLine: "e", newLine: "e", oldNum: 5, newNum: 4 });
  });

  it("emits trailing context after the last hunk", () => {
    // hunk only covers line 1, but the file has 3 lines on each side.
    const rows = buildRows(
      diff(
        ["a", "b", "c"],
        ["a", "b", "c"],
        [hunk(1, 1, [["context", "a"]])],
      ),
    );
    expect(rows).toHaveLength(3);
    expect(rows[1]?.oldLine).toBe("b");
    expect(rows[2]?.oldLine).toBe("c");
  });

  it("drains an asymmetric tail: context rows for the shorter side, then overflow rows for the longer side", () => {
    // After the hunk, old has 5 extra lines, new has 2. Function emits
    // 2 paired context rows (b, c), then drains the remaining 3 old lines
    // as left-only overflow rows (d, e, f).
    const oldLines = ["a", "b", "c", "d", "e", "f"];
    const newLines = ["a", "b", "c"];
    const rows = buildRows(
      diff(oldLines, newLines, [hunk(1, 1, [["context", "a"]])]),
    );
    expect(rows).toHaveLength(6);
    // First 3 rows are paired.
    expect(rows[0]).toMatchObject({ oldLine: "a", newLine: "a" });
    expect(rows[1]).toMatchObject({ oldLine: "b", newLine: "b" });
    expect(rows[2]).toMatchObject({ oldLine: "c", newLine: "c" });
    // Last 3 rows are old-only overflow.
    for (let i = 3; i < rows.length; i++) {
      const r = rows[i]!;
      expect(r.oldLine).toBe(oldLines[i]);
      expect(r.oldNum).toBe(i + 1);
      expect(r.newLine).toBeNull();
      expect(r.newNum).toBeNull();
    }
  });

  it("handles a hunk whose first line is a remove (pairs with a following add)", () => {
    // @@ -1,2 +1,2 @@: remove b, add B, plus trailing context c.
    const rows = buildRows(
      diff(
        ["b", "c"],
        ["B", "c"],
        [hunk(1, 1, [["remove", "b"], ["add", "B"], ["context", "c"]])],
      ),
    );
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ oldLine: "b", newLine: "B" });
    expect(rows[1]).toMatchObject({ oldLine: "c", newLine: "c" });
  });
});

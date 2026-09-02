import type { DiffFile } from "@/shared/types/git";

/** One aligned row in the side-by-side view. */
export interface DiffRow {
  /** Kind of the change at this row, or null when unchanged. */
  oldKind: "add" | "remove" | null;
  oldLine: string | null;
  oldNum: number | null;
  newKind: "add" | "remove" | null;
  newLine: string | null;
  newNum: number | null;
}

/**
 * Build aligned (old,new) rows from the full file contents + parsed hunks.
 *
 * Walk each hunk. Context lines pair up on both sides. Runs of removals are
 * buffered and then paired with the following additions one-to-one, so an
 * edit (`-foo` / `+bar`) renders as a single side-by-side row with the old
 * line on the left and the new line on the right. Leftover removals become
 * left-only rows; leftover additions become right-only rows.
 *
 * Context rows anchor to the hunk header's `oldStart`/`newStart` positions:
 * each context line is at `oldStart + oldCount` / `newStart + newCount` for
 * the lines consumed so far within this hunk. That keeps the two sides
 * aligned even when a run of standalone additions shifted one side's index
 * (adds only advance the new index).
 */
export function buildRows(diff: DiffFile): DiffRow[] {
  const oldLines = diff.oldLines;
  const newLines = diff.newLines;
  const rows: DiffRow[] = [];

  let oldIdx = 0;
  let newIdx = 0;

  const pushContext = (count: number) => {
    for (let i = 0; i < count; i++) {
      rows.push({
        oldKind: null,
        oldLine: oldLines[oldIdx] ?? "",
        oldNum: oldIdx + 1,
        newKind: null,
        newLine: newLines[newIdx] ?? "",
        newNum: newIdx + 1,
      });
      oldIdx++;
      newIdx++;
    }
  };

  // Removed lines seen so far, held back to pair with following additions.
  let pendingRemoves: { line: string; num: number }[] = [];

  const flushRemoves = () => {
    for (const r of pendingRemoves) {
      rows.push({
        oldKind: "remove",
        oldLine: r.line,
        oldNum: r.num,
        newKind: null,
        newLine: null,
        newNum: null,
      });
    }
    pendingRemoves = [];
  };

  const pushRemove = () => {
    pendingRemoves.push({ line: oldLines[oldIdx] ?? "", num: oldIdx + 1 });
    oldIdx++;
  };

  const pushStandaloneAdd = () => {
    rows.push({
      oldKind: null,
      oldLine: null,
      oldNum: null,
      newKind: "add",
      newLine: newLines[newIdx] ?? "",
      newNum: newIdx + 1,
    });
    newIdx++;
  };

  const pushPairedEdit = () => {
    const r = pendingRemoves.shift()!;
    rows.push({
      oldKind: "remove",
      oldLine: r.line,
      oldNum: r.num,
      newKind: "add",
      newLine: newLines[newIdx] ?? "",
      newNum: newIdx + 1,
    });
    newIdx++;
  };

  for (const hunk of diff.hunks) {
    // Context before this hunk (gap since the last hunk ended).
    const gapOld = hunk.oldStart - 1 - oldIdx;
    const gapNew = hunk.newStart - 1 - newIdx;
    pushContext(Math.max(0, Math.min(gapOld, gapNew)));

    // Lines consumed within this hunk on each side — used to anchor context
    // rows to the hunk's declared positions. `oldConsumed` counts old-side
    // lines (context + removals); `newConsumed` counts new-side lines
    // (context + additions). Standalone additions shift only the new side.
    let oldConsumed = 0;
    let newConsumed = 0;

    // Push the next context line, anchored to the hunk's start positions.
    const pushHunkContext = () => {
      const oldNum = hunk.oldStart + oldConsumed;
      const newNum = hunk.newStart + newConsumed;
      rows.push({
        oldKind: null,
        oldLine: oldLines[oldNum - 1] ?? "",
        oldNum,
        newKind: null,
        newLine: newLines[newNum - 1] ?? "",
        newNum,
      });
      // Sync the incremental indices to the anchored positions: a standalone
      // add run shifts NEW ahead of OLD, so jumping the old index past the
      // gap prevents the tail drain from re-emitting skipped old lines.
      oldIdx = oldNum;
      newIdx = newNum;
      oldConsumed++;
      newConsumed++;
    };

    for (const line of hunk.lines) {
      if (line.kind === "context") {
        // A context boundary ends any unpaired removal run.
        flushRemoves();
        pushHunkContext();
      } else if (line.kind === "remove") {
        pushRemove();
        oldConsumed++;
      } else {
        // add — pair with a pending removal when one exists (edit), else a
        // standalone insertion.
        if (pendingRemoves.length > 0) {
          pushPairedEdit();
          newConsumed++;
        } else {
          pushStandaloneAdd();
          newConsumed++;
        }
      }
    }
    flushRemoves();
  }

  // Remaining context after the last hunk.
  const remainingOld = oldLines.length - oldIdx;
  const remainingNew = newLines.length - newIdx;
  pushContext(Math.max(0, Math.min(remainingOld, remainingNew)));
  // Any overflow (shouldn't happen) — render remaining lines on their side.
  while (oldIdx < oldLines.length || newIdx < newLines.length) {
    const hasOld = oldIdx < oldLines.length;
    const hasNew = newIdx < newLines.length;
    rows.push({
      oldKind: null,
      oldLine: hasOld ? (oldLines[oldIdx] ?? "") : null,
      oldNum: hasOld ? oldIdx + 1 : null,
      newKind: null,
      newLine: hasNew ? (newLines[newIdx] ?? "") : null,
      newNum: hasNew ? newIdx + 1 : null,
    });
    if (hasOld) oldIdx++;
    if (hasNew) newIdx++;
  }

  return rows;
}

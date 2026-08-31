import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import { useRepoStore } from "@/state/store";
import type { DiffFile } from "@/shared/types/git";
import { highlightLines, langForPath, type Line } from "@/shared/utils/highlight";
import { diffWords } from "./wordDiff";
import { Button } from "@/shared/components/ui";
import s from "./diff.module.css";

/** One aligned row in the side-by-side view. */
interface DiffRow {
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

/** Async-highlight a code string into per-line token arrays. */
function useHighlightedLines(code: string, lang: string): Line[] | null {
  const [lines, setLines] = useState<Line[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    highlightLines(code, lang).then((l) => {
      if (!cancelled) setLines(l);
    });
    return () => {
      cancelled = true;
    };
  }, [code, lang]);
  return lines;
}

/** Render one cell's text, tokenized when highlight data is available. */
function Cell({ text, num, tokens }: { text: string; num: number | null; tokens: Line[] | null }) {
  const line = num != null && tokens ? tokens[num - 1] : undefined;
  return (
    <span className={s.diffCell}>
      {line && line.length > 0
        ? line.map((t, i) =>
            t.color ? (
              <span key={i} style={{ color: t.color }}>
                {t.text}
              </span>
            ) : (
              <span key={i}>{t.text}</span>
            ),
          )
        : text}
    </span>
  );
}

/**
 * Cell for a changed (added/removed) line that has a counterpart on the other
 * side (paired edit): the changed words get a stronger tint via diffWords,
 * merged with shiki syntax highlighting so both the token colors and the
 * change emphasis show together. Fully added/removed lines (no counterpart)
 * skip word diffing and get a left-edge bar marker instead.
 */
function ChangeCell({
  text,
  num,
  kind,
  other,
  tokens,
}: {
  text: string;
  num: number | null;
  kind: "add" | "remove";
  other: string;
  tokens: Line[] | null;
}) {
  const segments =
    kind === "add" ? diffWords(other, text).newSegs : diffWords(other, text).oldSegs;
  const line = num != null && tokens ? tokens[num - 1] : undefined;
  const colors = line ?? [{ text, color: undefined }];
  const out: { t: string; color?: string; changed: boolean }[] = [];
  // Merge the word-diff segments with the shiki token partition of the
  // same line. Both split the same string; walk them by character
  // position so each output span carries a token color AND a changed
  // flag.
  let si = 0; // offset within the current segment
  let ci = 0; // offset within the current color token
  let segIdx = 0;
  let colIdx = 0;
  while (segIdx < segments.length && colIdx < colors.length) {
    const seg = segments[segIdx];
    const col = colors[colIdx];
    const take = Math.min(seg.text.length - si, col.text.length - ci);
    const t = seg.text.slice(si, si + take);
    if (t.length > 0) out.push({ t, color: col.color, changed: seg.changed });
    si += take;
    ci += take;
    if (si >= seg.text.length) {
      segIdx++;
      si = 0;
    }
    if (ci >= col.text.length) {
      colIdx++;
      ci = 0;
    }
  }
  // Leftover (shouldn't happen — same source text), render defensively.
  if (segIdx < segments.length) {
    const seg = segments[segIdx];
    const rest = seg.text.slice(si);
    if (rest.length > 0) out.push({ t: rest, changed: seg.changed });
  }

  return (
    <span className={s.diffCell}>
      {out.map((part, i) => (
        <span
          key={i}
          className={part.changed ? clsx(s.diffWord, s[kind]) : undefined}
          style={part.color ? { color: part.color } : undefined}
        >
          {part.t}
        </span>
      ))}
    </span>
  );
}

/**
 * One side of the side-by-side diff. Each pane is its own scroll container so
 * long lines clip cleanly at the column edge and scroll horizontally on their
 * own; the parent syncs their vertical scroll to keep rows aligned.
 */
function DiffPane({
  side,
  rows,
  tokens,
  viewportRef,
  onScroll,
  minimap,
}: {
  side: "old" | "new";
  rows: DiffRow[];
  tokens: Line[] | null;
  viewportRef: React.RefObject<HTMLDivElement>;
  onScroll: (src: HTMLDivElement) => void;
  minimap?: React.ReactNode;
}) {
  return (
    <div className={s.diffPane}>
      <ScrollArea.Root className={s.diffPaneRoot}>
        <div className={s.diffColHeaders}>
          <div className={s.diffColHeader}>{side === "old" ? "OLD" : "NEW"}</div>
        </div>
        <ScrollArea.Viewport
          ref={viewportRef}
          className={s.diffTableViewport}
          onScroll={(e) => onScroll(e.currentTarget)}
        >
          <ScrollArea.Content className={s.diffContent}>
            <div className={s.diffCol}>
              {rows.map((r, i) => {
                const num = side === "old" ? r.oldNum : r.newNum;
                const kind = side === "old" ? r.oldKind : r.newKind;
                const text = (side === "old" ? r.oldLine : r.newLine) ?? "";
                const other =
                  side === "old"
                    ? r.newNum != null
                      ? (r.newLine ?? null)
                      : null
                    : r.oldNum != null
                      ? (r.oldLine ?? null)
                      : null;
                // A fully added/removed row has no counterpart line to word-diff
                // against — mark it with a left-edge bar instead of word emphasis.
                const isFull = kind != null && other == null;
                return (
                  <div key={i} className={clsx(s.diffLine, kind && s[kind], isFull && s.diffFull)}>
                    <span className={s.diffGutter}>
                      <span>{num ?? ""}</span>
                      <span
                        className={clsx(
                          s.diffSign,
                          kind === "remove" && s.remove,
                          kind === "add" && s.add,
                        )}
                      >
                        {kind === "remove" ? "-" : kind === "add" ? "+" : "\u00a0"}
                      </span>
                    </span>
                    {num != null ? (
                      kind && !isFull ? (
                        <ChangeCell
                          text={text}
                          num={num}
                          kind={kind}
                          other={other as string}
                          tokens={tokens}
                        />
                      ) : (
                        <Cell text={text} num={num} tokens={tokens} />
                      )
                    ) : (
                      <span className={clsx(s.diffCell, s.diffEmpty)} aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className={s.diffScrollTrack} keepMounted>
          {minimap}
          <ScrollArea.Thumb className={s.diffScrollThumb} />
        </ScrollArea.Scrollbar>
        <ScrollArea.Scrollbar orientation="horizontal" className="scrollbarTrack" keepMounted>
          <ScrollArea.Thumb className="scrollbarThumb" />
        </ScrollArea.Scrollbar>
        <ScrollArea.Corner />
      </ScrollArea.Root>
    </div>
  );
}

/**
 * Change markers drawn inside a pane's vertical scrollbar track (the
 * minimap). Each pane shows only the changes on its own side: the OLD pane
 * marks removals (red), the NEW pane marks additions (green); context rows
 * are dim. Rows that changed only on the other side leave a gap. Purely
 * passive — ScrollArea's own scrollbar (track + thumb) handles all scrolling
 * and shows the visible range. Renders nothing when the file fits without
 * scrolling.
 */
function DiffMinimap({
  side,
  rows,
  viewportRef,
}: {
  side: "old" | "new";
  rows: DiffRow[];
  viewportRef: React.RefObject<HTMLDivElement>;
}) {
  // One marker per aligned row, colored by what changed on THIS side.
  const bars = useMemo(() => {
    const out: { kind: "add" | "remove" | "context" }[] = [];
    for (const r of rows) {
      // Each pane shows only its own side's change kind: OLD marks removals
      // (red), NEW marks additions (green). Paired edits are a removal on
      // the OLD side and an addition on the NEW side — no accent override.
      const kind = (side === "old" ? r.oldKind : r.newKind) ?? "context";
      out.push({ kind });
    }
    return out;
  }, [rows, side]);

  const [metrics, setMetrics] = useState({ scrollHeight: 0, clientHeight: 0 });

  const readMetrics = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    setMetrics({ scrollHeight: vp.scrollHeight, clientHeight: vp.clientHeight });
  }, [viewportRef]);

  // Read the scroll metrics on mount, on viewport resize, on scroll (cheap
  // re-measure — scroll events accompany most content/viewport changes), and
  // when the rows (content height) change.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    readMetrics();
    const ro = new ResizeObserver(readMetrics);
    ro.observe(vp);
    const onScroll = () => readMetrics();
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      vp.removeEventListener("scroll", onScroll);
    };
  }, [viewportRef, readMetrics, rows]);

  // The content carries a 16px bottom padding so the last line can clear the
  // horizontal scroll track. Subtract it from the overflow check, otherwise a
  // fully-visible file would still look "scrollable" and show a phantom strip.
  const PADDING_BOTTOM = 16;
  const contentHeight = Math.max(0, metrics.scrollHeight - PADDING_BOTTOM);
  const noOverflow = contentHeight <= metrics.clientHeight;

  // Rows share one fixed line-height (19.5px); bar geometry is expressed in
  // percent of the scrollable content so the strip mirrors the file exactly.
  const ROW_HEIGHT = 19.5;
  const barPercent = contentHeight > 0 ? (ROW_HEIGHT / contentHeight) * 100 : 0;

  if (noOverflow) return null;

  return (
    <div className={s.diffMinimap} aria-hidden>
      {bars.map((b, i) => (
        <span
          key={i}
          className={s.diffMinimapBar}
          data-kind={b.kind}
          style={{
            top: `${(i * ROW_HEIGHT) / Math.max(1, contentHeight) * 100}%`,
            height: `${barPercent}%`,
          }}
        />
      ))}
    </div>
  );
}

export function DiffView() {
  const { activeDiff, diffCache, closeDiff } = useRepoStore();
  const diff = activeDiff
    ? diffCache[`${activeDiff.hash}|${activeDiff.path}|${activeDiff.staged ? "s" : "w"}`]
    : undefined;

  const path = activeDiff?.path ?? "";
  const lang = useMemo(() => langForPath(path), [path]);

  const oldCode = diff ? diff.oldLines.join("\n") : "";
  const newCode = diff ? diff.newLines.join("\n") : "";
  // Hooks must run unconditionally.
  const oldTokens = useHighlightedLines(oldCode, lang);
  const newTokens = useHighlightedLines(newCode, lang);

  const rows = useMemo(
    () => (diff && !diff.tooLarge && !diff.binary ? buildRows(diff) : []),
    [diff],
  );

  // Scroll is shared between the two panes on both axes so the rows stay
  // aligned and the horizontal offset matches; each pane still clips its own
  // overflow at the edge. Re-entrancy guard prevents an infinite loop when the
  // programmatic write to the sibling triggers its own onScroll.
  const oldViewportRef = useRef<HTMLDivElement>(null);
  const newViewportRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const syncScroll = useCallback((src: HTMLDivElement) => {
    if (syncingRef.current) return;
    const dst = src === oldViewportRef.current ? newViewportRef.current : oldViewportRef.current;
    if (!dst) return;
    if (dst.scrollTop === src.scrollTop && dst.scrollLeft === src.scrollLeft) return;
    syncingRef.current = true;
    dst.scrollTop = src.scrollTop;
    dst.scrollLeft = src.scrollLeft;
    syncingRef.current = false;
  }, []);

  if (!activeDiff) return null;

  return (
    <div className={s.diffView}>
      <div className={s.diffTopbar}>
        <span className={`${s.diffPath} mono`} title={path}>
          {path}
        </span>
        <Button variant="ghost" className={s.diffClose} onClick={closeDiff} aria-label="Close diff">
          <X size={16} aria-hidden />
        </Button>
      </div>

      {!diff ? (
        <div className={s.diffPlaceholder}>Loading…</div>
      ) : diff.error ? (
        <div className={s.diffPlaceholder}>Failed to load diff: {diff.error}</div>
      ) : diff.binary ? (
        <div className={s.diffPlaceholder}>Binary file — no diff preview.</div>
      ) : diff.tooLarge ? (
        <div className={s.diffPlaceholder}>File too large to display.</div>
      ) : (
        <div className={s.diffBody}>
          <DiffPane
            side="old"
            rows={rows}
            tokens={oldTokens}
            viewportRef={oldViewportRef}
            onScroll={syncScroll}
            minimap={<DiffMinimap side="old" rows={rows} viewportRef={oldViewportRef} />}
          />
          <DiffPane
            side="new"
            rows={rows}
            tokens={newTokens}
            viewportRef={newViewportRef}
            onScroll={syncScroll}
            minimap={<DiffMinimap side="new" rows={rows} viewportRef={newViewportRef} />}
          />
        </div>
      )}
    </div>
  );
}

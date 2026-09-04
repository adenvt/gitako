import { memo, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ScrollArea } from "@base-ui/react/scroll-area";
import type { Line } from "@/shared/utils/highlight";
import type { DiffRow } from "./align";
import { Cell, ChangeCell } from "./DiffCell";
import { ROW_HEIGHT } from "./DiffMinimap";
import s from "./diff.module.css";

/** Extra rows rendered above/below the visible window so a quick scroll
 *  doesn't pop in empty space before the next paint. The buffer is
 *  `max(MIN_OVERSCAN, visibleRowCount / 2)` — half the visible window on
 *  each side, with a small floor for tiny viewports. The 50% / 50% split
 *  means a tall viewport always has at least one full window of rows
 *  pre-rendered in each direction, so fast scrolls never reveal blank
 *  space before the next paint. */
const MIN_OVERSCAN = 4;

/** One side of the side-by-side diff. Each pane is its own scroll container so
 *  long lines clip cleanly at the column edge and scroll horizontally on their
 *  own; the parent syncs their vertical scroll to keep rows aligned.
 *  Only the visible window (plus overscan) of rows is mounted at a time, so
 *  opening a 1000-line diff doesn't paint 1000 row elements per pane. */
export function DiffPane({
  side,
  rows,
  tokens,
  viewportRef,
  onScroll,
  onPointerEnter,
  minimap,
  contentMinWidth,
}: {
  side: "old" | "new";
  rows: DiffRow[];
  tokens: Line[] | null;
  viewportRef: React.RefObject<HTMLDivElement>;
  onScroll: (src: HTMLDivElement) => void;
  onPointerEnter: (src: HTMLDivElement) => void;
  minimap?: React.ReactNode;
  /** Floor on the pane's content width in px. Set by the parent so both
   *  panes share the same horizontal scroll range — the wider pane keeps
   *  its natural `max-content` width, the narrower pane gets a `min-width`
   *  matching the wider one so its horizontal scrollbar appears with the
   *  same thumb width and range as the other side. */
  contentMinWidth?: number;
}) {
  const { start, end } = useVirtualRows(viewportRef, rows.length);
  const visibleRows = useMemo(() => rows.slice(start, end), [rows, start, end]);
  // Spacers preserve the scrollbar's true content height so the minimap
  // and scroll thumb track the full file, not just the mounted window.
  const topPad = start * ROW_HEIGHT;
  const botPad = Math.max(0, (rows.length - end) * ROW_HEIGHT);
  // `.diffContent` has `min-width: max-content` so the wider pane keeps its
  // natural longest-line width. An inline `min-width` here only constrains
  // the narrower pane up to the shared floor — both panes end up with the
  // same `scrollWidth`, so their horizontal scrollbar thumbs share width
  // and range. Inline style wins over the class rule without `!important`.
  const contentStyle = contentMinWidth ? { minWidth: contentMinWidth } : undefined;

  return (
    <div className={s.diffPane} onPointerEnter={(e) => onPointerEnter(e.currentTarget)}>
      <ScrollArea.Root className={s.diffPaneRoot}>
        <div className={s.diffColHeaders}>
          <div className={s.diffColHeader}>{side === "old" ? "OLD" : "NEW"}</div>
        </div>
        <ScrollArea.Viewport
          ref={viewportRef}
          className={s.diffTableViewport}
          onScroll={(e) => onScroll(e.currentTarget)}
        >
          <ScrollArea.Content className={s.diffContent} style={contentStyle}>
            <div className={s.diffCol}>
              {topPad > 0 && <div style={{ height: topPad }} aria-hidden />}
              {visibleRows.map((r, i) => (
                <DiffRow key={start + i} row={r} side={side} tokens={tokens} />
              ))}
              {botPad > 0 && <div style={{ height: botPad }} aria-hidden />}
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
 * Compute the visible row range `[start, end)` for a virtualized list.
 * The buffer on each side is `max(MIN_OVERSCAN, visibleRows / 2)` — half
 * the visible window — so a tall viewport always has a full extra window
 * of pre-rendered rows in each direction. Returns the full range when
 * the viewport hasn't laid out yet so the initial render still shows
 * content.
 */
function useVirtualRows(
  viewportRef: React.RefObject<HTMLDivElement>,
  rowCount: number,
): { start: number; end: number } {
  const [range, setRange] = useState({ start: 0, end: rowCount });
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      // Buffer = half the visible row count, with a small floor so a tiny
      // viewport still has rows on each side. The 50/50 split means a tall
      // viewport pre-renders a full extra window in each direction.
      const visibleRows = Math.max(1, Math.floor(el.clientHeight / ROW_HEIGHT));
      const overscan = Math.max(MIN_OVERSCAN, Math.floor(visibleRows / 2));
      const nextStart = Math.max(0, Math.floor(el.scrollTop / ROW_HEIGHT) - overscan);
      const nextEnd = Math.min(
        rowCount,
        Math.ceil((el.scrollTop + el.clientHeight) / ROW_HEIGHT) + overscan,
      );
      setRange((prev) =>
        prev.start === nextStart && prev.end === nextEnd
          ? prev
          : { start: nextStart, end: nextEnd },
      );
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [viewportRef, rowCount]);
  return range;
}

/**
 * One aligned row, rendered in one of the two panes. Extracted so the
 * parent `.map` over the visible window stays compact and the per-row
 * JSX is reusable for both sides.
 */
const DiffRow = memo(function DiffRow({
  row,
  side,
  tokens,
}: {
  row: DiffRow;
  side: "old" | "new";
  tokens: Line[] | null;
}) {
  const isOld = side === "old";
  const line = isOld ? row.oldLine : row.newLine;
  const numOut = isOld ? row.oldNum : row.newNum;
  const kind = isOld ? row.oldKind : row.newKind;
  const other =
    isOld && row.newNum != null
      ? (row.newLine ?? null)
      : !isOld && row.oldNum != null
        ? (row.oldLine ?? null)
        : null;
  // A fully added/removed row has no counterpart line to word-diff against —
  // mark it with a left-edge bar instead of word emphasis.
  const isFull = kind != null && other == null;
  const text = line ?? "";
  return (
    <div className={clsx(s.diffLine, kind && s[kind], isFull && s.diffFull)}>
      <span className={s.diffGutter}>
        <span>{numOut ?? ""}</span>
        <span className={clsx(s.diffSign, kind === "remove" && s.remove, kind === "add" && s.add)}>
          {kind === "remove" ? "-" : kind === "add" ? "+" : "\u00a0"}
        </span>
      </span>
      {numOut != null ? (
        kind && !isFull ? (
          <ChangeCell
            text={text}
            num={numOut}
            kind={kind}
            other={other as string}
            tokens={tokens}
          />
        ) : (
          <Cell text={text} num={numOut} tokens={tokens} />
        )
      ) : (
        <span className={clsx(s.diffCell, s.diffEmpty)} aria-hidden />
      )}
    </div>
  );
});

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DiffRow } from "./align";
import s from "./diff.module.css";

/**
 * Change markers drawn inside a pane's vertical scrollbar track (the
 * minimap). Each pane shows only the changes on its own side: the OLD pane
 * marks removals (red), the NEW pane marks additions (green); context rows
 * are dim. Rows that changed only on the other side leave a gap. Purely
 * passive — ScrollArea's own scrollbar (track + thumb) handles all scrolling
 * and shows the visible range. Renders nothing when the file fits without
 * scrolling.
 */
export function DiffMinimap({
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
            top: `${((i * ROW_HEIGHT) / Math.max(1, contentHeight)) * 100}%`,
            height: `${barPercent}%`,
          }}
        />
      ))}
    </div>
  );
}

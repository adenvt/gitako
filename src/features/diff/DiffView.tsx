import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { XIcon } from "@primer/octicons-react";
import { useRepoStore } from "@/state/store";
import { langForPath } from "@/shared/utils/highlight";
import { Button } from "@/shared/components/ui";
import { buildRows } from "./align";
import { DiffPane } from "./DiffPane";
import { DiffMinimap } from "./DiffMinimap";
import { useHighlightedLines } from "./highlightTokens";
import s from "./diff.module.css";

export function DiffView() {
  // Narrow selectors — bare `useRepoStore()` would re-render this tree
  // on every store change (status polling alone re-fires ~12 times/min),
  // and each re-render would re-render every cell in both panes.
  const activeDiff = useRepoStore((st) => st.activeDiff);
  const diffCache = useRepoStore((st) => st.diffCache);
  const closeDiff = useRepoStore((st) => st.closeDiff);
  const diff = activeDiff
    ? diffCache[`${activeDiff.hash}|${activeDiff.path}|${activeDiff.staged ? "s" : "w"}`]
    : undefined;

  const path = activeDiff?.path ?? "";
  const lang = useMemo(() => langForPath(path), [path]);

  // Joining the line arrays on every render would be O(n) for a 2000-line
  // file. Memoize so the highlighter hook only re-runs when the diff
  // itself changes.
  const { oldCode, newCode } = useMemo(() => {
    if (!diff) return { oldCode: "", newCode: "" };
    return { oldCode: diff.oldLines.join("\n"), newCode: diff.newLines.join("\n") };
  }, [diff]);
  // Hooks must run unconditionally.
  const oldTokens = useHighlightedLines(oldCode, lang);
  const newTokens = useHighlightedLines(newCode, lang);

  const rows = useMemo(
    () => (diff && !diff.tooLarge && !diff.binary ? buildRows(diff) : []),
    [diff],
  );

  // Scroll is shared between the two panes on both axes so the rows stay
  // aligned and the horizontal offset matches; each pane still clips its own
  // overflow at the edge. Pointer-enter marks the actively-scrolled pane, so
  // a programmatic write to the sibling doesn't trigger a feedback loop.
  const oldViewportRef = useRef<HTMLDivElement>(null);
  const newViewportRef = useRef<HTMLDivElement>(null);
  const activeViewportRef = useRef<HTMLDivElement | null>(null);

  // Track the max `scrollWidth` across both viewports so the narrower pane
  // gets a `min-width` matching the wider one. Without this, only the side
  // with the longest line shows a horizontal scrollbar — the other side
  // looks like it has no horizontal overflow at all, and the two thumbs
  // sit at different widths and ranges.
  const [sharedContentWidth, setSharedContentWidth] = useState(0);
  useEffect(() => {
    const measure = () => {
      const oldW = oldViewportRef.current?.scrollWidth ?? 0;
      const newW = newViewportRef.current?.scrollWidth ?? 0;
      const next = Math.max(oldW, newW);
      setSharedContentWidth((prev) => (prev === next ? prev : next));
    };
    measure();
    // scrollWidth can change as tokens arrive (shiki may widen a line) or
    // as the user resizes. ResizeObserver fires for layout changes;
    // we read scrollWidth (not clientWidth) so a wider inner content
    // triggers an update even if the viewport itself didn't resize.
    const ro1 = new ResizeObserver(measure);
    const ro2 = new ResizeObserver(measure);
    if (oldViewportRef.current) ro1.observe(oldViewportRef.current);
    if (newViewportRef.current) ro2.observe(newViewportRef.current);
    return () => {
      ro1.disconnect();
      ro2.disconnect();
    };
  }, [rows]);

  const setActiveViewport = useCallback((src: HTMLDivElement) => {
    activeViewportRef.current = src;
  }, []);

  const syncScroll = useCallback((src: HTMLDivElement) => {
    if (activeViewportRef.current && !activeViewportRef.current.contains(src)) return;
    const dst = src === oldViewportRef.current ? newViewportRef.current : oldViewportRef.current;
    if (!dst) return;
    if (dst.scrollTop === src.scrollTop && dst.scrollLeft === src.scrollLeft) return;
    // Write synchronously so the destination pane's virtualizer (which
    // listens for `scroll` on its own viewport) updates in the same frame
    // as the source. Deferring with rAF introduces a one-frame lag that's
    // visible at high scroll velocity. The active-viewport + equality
    // checks above are enough to prevent the feedback loop — the
    // destination's own scroll handler will see no change in scrollTop
    // and bail out before re-syncing back.
    dst.scrollTop = src.scrollTop;
    dst.scrollLeft = src.scrollLeft;
  }, []);

  if (!activeDiff) return null;

  return (
    <div className={s.diffView}>
      <div className={s.diffTopbar}>
        <span className={`${s.diffPath} mono`} title={path}>
          {path}
        </span>
        <Button variant="ghost" className={s.diffClose} onClick={closeDiff} aria-label="Close diff">
          <XIcon size={16} aria-hidden />
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
            onPointerEnter={setActiveViewport}
            onScroll={syncScroll}
            minimap={<DiffMinimap side="old" rows={rows} viewportRef={oldViewportRef} />}
            contentMinWidth={sharedContentWidth || undefined}
          />
          <DiffPane
            side="new"
            rows={rows}
            tokens={newTokens}
            viewportRef={newViewportRef}
            onPointerEnter={setActiveViewport}
            onScroll={syncScroll}
            minimap={<DiffMinimap side="new" rows={rows} viewportRef={newViewportRef} />}
            contentMinWidth={sharedContentWidth || undefined}
          />
        </div>
      )}
    </div>
  );
}

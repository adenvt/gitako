import { useCallback, useMemo, useRef } from "react";
import { X } from "lucide-react";
import { useRepoStore } from "@/state/store";
import { langForPath } from "@/shared/utils/highlight";
import { Button } from "@/shared/components/ui";
import { buildRows } from "./align";
import { DiffPane } from "./DiffPane";
import { DiffMinimap } from "./DiffMinimap";
import { useHighlightedLines } from "./highlightTokens";
import s from "./diff.module.css";

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
  // overflow at the edge. Pointer-enter marks the actively-scrolled pane, so
  // a programmatic write to the sibling doesn't trigger a feedback loop.
  const oldViewportRef = useRef<HTMLDivElement>(null);
  const newViewportRef = useRef<HTMLDivElement>(null);
  const activeViewportRef = useRef<HTMLDivElement | null>(null);

  const setActiveViewport = useCallback((src: HTMLDivElement) => {
    activeViewportRef.current = src;
  }, []);

  const syncScroll = useCallback((src: HTMLDivElement) => {
    if (activeViewportRef.current && activeViewportRef.current !== src) return;
    const dst = src === oldViewportRef.current ? newViewportRef.current : oldViewportRef.current;
    if (!dst) return;
    if (dst.scrollTop === src.scrollTop && dst.scrollLeft === src.scrollLeft) return;
    requestAnimationFrame(() => {
      dst.scrollTop = src.scrollTop;
      dst.scrollLeft = src.scrollLeft;
    });
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
            onPointerEnter={setActiveViewport}
            onScroll={syncScroll}
            minimap={<DiffMinimap side="old" rows={rows} viewportRef={oldViewportRef} />}
          />
          <DiffPane
            side="new"
            rows={rows}
            tokens={newTokens}
            viewportRef={newViewportRef}
            onPointerEnter={setActiveViewport}
            onScroll={syncScroll}
            minimap={<DiffMinimap side="new" rows={rows} viewportRef={newViewportRef} />}
          />
        </div>
      )}
    </div>
  );
}

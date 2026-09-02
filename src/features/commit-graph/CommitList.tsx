import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  FileAddedIcon,
  FileDiffIcon,
  FileRemovedIcon,
  GitBranchIcon,
} from "@primer/octicons-react";
import { ScrollArea } from "@base-ui/react/scroll-area";
import {
  GraphCanvas,
  ROW_HEIGHT,
  WORKING_ROW,
  graphGutter,
  TAG_WIDTH,
  MIN_GRAPH_BAND,
} from "./GraphCanvas";
import { laneColor } from "./colors";
import { RefBadge, RefBadgeGroup } from "./refBadge";
import { useRepoStore } from "@/state/store";
import { timeAgo } from "@/shared/utils/time";
import { countByKind } from "@/shared/utils/status";
import type { RefInfo } from "@/shared/types/git";
import s from "./commitList.module.css";

const OVERSCAN = 8;
/** Drag handle hit width around the boundary between graph and text. */
const HANDLE_HIT = 5;

/**
 * Group refs by their base `name` for badge rendering. The remote `HEAD`
 * pointer (e.g. `origin/HEAD`) is filtered out — it's a convenience
 * annotation, not a real ref to show.
 *
 * Example: refs `[main, origin/main, v1.0]` -> `[[main, origin/main], [v1.0]]`.
 */
export function groupRefsForBadging(refs: RefInfo[]): RefInfo[][] {
  const visible = refs.filter((r) => !(r.kind === "remoteBranch" && r.name === "HEAD"));
  const groups = new Map<string, RefInfo[]>();
  for (const r of visible) {
    const list = groups.get(r.name) ?? [];
    list.push(r);
    groups.set(r.name, list);
  }
  return [...groups.values()];
}

/** Virtualized commit list: canvas graph + DOM text labels, one scroll container. */
export function CommitList() {
  const {
    commits,
    layout,
    selectedHash,
    select,
    statusEntries,
    openComposer,
    workingSelected,
    setWorkingSelected,
    refsByCommit,
    graphWidth,
    setGraphWidth,
    checkout,
  } = useRepoStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 50 });
  /** True while the graph-band resize drag is in progress. */
  const draggingRef = useRef(false);
  /** Maximum graph band width: the auto gutter that fits all lanes statically. */
  const maxGraphBandRef = useRef(0);
  /** Selected index within the visual rows (WIP row = 0, then commits). */
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  // Drag the boundary between the graph band and the message column. Dragging
  // left shrinks the graph band (message grows); dragging right grows the graph
  // band (message shrinks). The boundary is always anchored inside the container.
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      draggingRef.current = true;
      const container = scrollRef.current;
      if (!container) {
        draggingRef.current = false;
        return;
      }
      const left = container.getBoundingClientRect().left;
      const maxBand = maxGraphBandRef.current;
      const onMove = (ev: PointerEvent) => {
        if (!draggingRef.current) return;
        const raw = ev.clientX - left - TAG_WIDTH;
        // Clamp to [min, max]. Max is the auto gutter (all lanes fit statically).
        const next = Math.min(maxBand, Math.max(MIN_GRAPH_BAND, raw));
        setGraphWidth(next);
      };
      const onUp = () => {
        draggingRef.current = false;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [setGraphWidth],
  );

  // Double-clicking a ref badge checks out the ref. The badge
  // component gates by `kind`, but remote-tracking refs also need to
  // resolve to their full name (`origin/feature`) so the store can
  // route them through `git checkout --track` instead of plain
  // `git checkout`.
  const onCheckout = useCallback(
    (name: string, kind: "branch" | "remoteBranch") => {
      void checkout(name, kind).catch(() => {
        // store already set `error`; nothing to do.
      });
    },
    [checkout],
  );

  const counts = countByKind(statusEntries);
  const hasWorkingRow = counts.added + counts.deleted + counts.modified > 0;
  const offset = hasWorkingRow ? 1 : 0;

  // Row indexing: the WIP row, when present, is visual index 0 and each
  // commit follows in graph order (newest first). Both selectors point at the
  // same visual row so keyboard navigation and click selection stay in sync.
  const commitIndex = useMemo(() => {
    const byHash = new Map(commits.map((c, i) => [c.hash, i]));
    return byHash;
  }, [commits]);
  const selectedIndex = useMemo(() => {
    if (workingSelected) return 0;
    if (selectedHash == null) return null;
    const i = commitIndex.get(selectedHash);
    return i == null ? null : i + offset;
  }, [workingSelected, selectedHash, commitIndex, offset]);
  const totalRows = commits.length + offset;

  // Update the visible row window on scroll/resize.
  const layoutNonNull = layout;
  useEffect(() => {
    if (!layoutNonNull) return;
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / ROW_HEIGHT) - OVERSCAN);
      const end = Math.min(
        layoutNonNull.commits.length + (hasWorkingRow ? 1 : 0),
        Math.ceil((el.scrollTop + el.clientHeight) / ROW_HEIGHT) + OVERSCAN,
      );
      setRange((prev) => (prev.start === start && prev.end === end ? prev : { start, end }));
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [layoutNonNull, hasWorkingRow]);

  // Keyboard focus follows whatever is selected (click or arrow). The list
  // itself carries the focus so arrow keys work from anywhere in the pane.
  useEffect(() => {
    setFocusIndex(selectedIndex);
  }, [selectedIndex]);

  // Give the scroll viewport focus on mount so arrow keys work immediately,
  // and refocus it whenever the working row is selected by keyboard (it holds
  // no focusable element of its own).
  useEffect(() => {
    const el = scrollRef.current;
    if (el && document.activeElement === document.body) el.focus();
  });
  useEffect(() => {
    if (workingSelected) scrollRef.current?.focus();
  }, [workingSelected]);

  // Navigate the selection with the keyboard. ArrowUp/Down move one visual
  // row; PageUp/PageDown move by a viewport; Home/End jump to the first/last
  // row. Moving up onto the WIP row selects it and opens the composer (same as
  // clicking it); moving down from it selects the newest commit.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.defaultPrevented || draggingRef.current) return;
      const el = scrollRef.current;
      if (!el || totalRows === 0) return;
      const current = focusIndex ?? selectedIndex;
      let next: number;
      switch (e.key) {
        case "ArrowDown":
          next = (current ?? -1) + 1;
          break;
        case "ArrowUp":
          next = (current ?? totalRows) - 1;
          break;
        case "PageDown": {
          const page = Math.max(1, Math.floor(el.clientHeight / ROW_HEIGHT) - 1);
          next = Math.min(totalRows - 1, (current ?? -1) + page);
          break;
        }
        case "PageUp": {
          const page = Math.max(1, Math.floor(el.clientHeight / ROW_HEIGHT) - 1);
          next = Math.max(0, (current ?? totalRows) - page);
          break;
        }
        case "Home":
          next = 0;
          break;
        case "End":
          next = totalRows - 1;
          break;
        default:
          return;
      }
      if (next < 0 || next >= totalRows) return;
      e.preventDefault();
      // Keep the highlighted row visible: scroll it to the top edge when it
      // moves above the viewport, or to the bottom edge when it moves below.
      const rowTop = next * ROW_HEIGHT;
      const rowBottom = rowTop + ROW_HEIGHT;
      const viewTop = el.scrollTop;
      const viewBottom = viewTop + el.clientHeight;
      if (rowTop < viewTop) {
        el.scrollTo({ top: rowTop, behavior: "auto" });
      } else if (rowBottom > viewBottom) {
        el.scrollTo({ top: rowBottom - el.clientHeight, behavior: "auto" });
      }
      setFocusIndex(next);
      if (next === 0 && hasWorkingRow) {
        setWorkingSelected(true);
        openComposer();
      } else {
        const c = commits[next - (hasWorkingRow ? 1 : 0)];
        if (c) select(c.hash);
      }
    },
    [
      totalRows,
      focusIndex,
      selectedIndex,
      hasWorkingRow,
      commits,
      select,
      setWorkingSelected,
      openComposer,
    ],
  );

  if (!layout || layout.commits.length === 0) {
    return (
      <div className={clsx(s.commitList, s.empty)}>
        <GitBranchIcon size={22} aria-hidden />
        <span>No commits yet</span>
        <span className="muted">Commits will appear here after your first commit.</span>
      </div>
    );
  }

  const totalHeight = (layout.commits.length + offset) * ROW_HEIGHT;
  // The graph band is resizable: use the user-set width, else the auto gutter.
  const gutter = graphGutter(layout.maxLane);
  maxGraphBandRef.current = gutter;
  const graphBand = Math.min(
    Math.max(graphWidth > 0 ? graphWidth : gutter, MIN_GRAPH_BAND),
    gutter,
  );
  const textLeft = TAG_WIDTH + graphBand;
  // Handle sits at the boundary between graph band and message column.
  const handleLeft = textLeft - HANDLE_HIT;

  return (
    <div className={s.commitList}>
      {/* Canvas pinned to the viewport (not the scroll content). */}
      <GraphCanvas
        layout={layout}
        selectedHash={selectedHash}
        hasWorkingRow={hasWorkingRow}
        workingSelected={workingSelected}
        scrollRef={scrollRef}
        graphBand={graphBand}
      />
      {/* Drag handle at the boundary between graph band and message column. */}
      <div
        className={s.graphResizeHandle}
        style={{ left: handleLeft }}
        onPointerDown={onPointerDown}
        title="Drag to resize the graph column"
      />
      <ScrollArea.Root className={s.commitScroll}>
        <ScrollArea.Viewport
          ref={scrollRef}
          className={s.commitScrollViewport}
          tabIndex={0}
          onKeyDown={onKeyDown}
        >
          <ScrollArea.Content>
            <div style={{ height: totalHeight, position: "relative" }}>
              <div className={s.commitRows}>
                {/* Working-directory row (row 0), only when there are changes. */}
                {hasWorkingRow && (
                  <div
                    className={clsx(s.commitRow, s.workingRow, workingSelected && s.selected)}
                    style={{
                      top: WORKING_ROW * ROW_HEIGHT,
                      height: ROW_HEIGHT,
                      left: textLeft,
                      ["--row-left" as string]: `${textLeft}px`,
                    }}
                    onClick={() => {
                      // Select the WIP row (deselects any commit) + open composer.
                      setWorkingSelected(true);
                      openComposer();
                    }}
                    title="Open commit composer"
                  >
                    <span className={clsx(s.commitSubject, s.wipLabel)}>
                      *
                      {counts.modified > 0 && (
                        <span className={s.wipCount}>
                          <FileDiffIcon size={11} className={s.wipModified} aria-hidden />
                          {counts.modified}
                        </span>
                      )}
                      {counts.added > 0 && (
                        <span className={s.wipCount}>
                          <FileAddedIcon size={11} className={s.wipAdded} aria-hidden />
                          {counts.added}
                        </span>
                      )}
                      {counts.deleted > 0 && (
                        <span className={s.wipCount}>
                          <FileRemovedIcon size={11} className={s.wipDeleted} aria-hidden />
                          {counts.deleted}
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {layout.commits.slice(range.start, range.end).map((_, offsetIdx) => {
                  const i = range.start + offsetIdx;
                  const c = commits[i];
                  if (!c) return null;
                  const isSelected = c.hash === selectedHash;
                  // Hide remote convenience pointers like origin/HEAD and group
                  // refs by base name so `main` + `origin/main` share one badge.
                  const refInfos = refsByCommit[c.hash] ?? [];
                  const groups = groupRefsForBadging(refInfos);
                  const hasVisibleRefs = groups.length > 0;
                  const top = (i + offset) * ROW_HEIGHT;
                  const lane = layout.commits[i]?.lane ?? 0;
                  const badgeColor = laneColor(lane);
                  return (
                    <div key={c.hash}>
                      {hasVisibleRefs && (
                        <div
                          className={clsx(s.commitTagCell, isSelected && s.selected)}
                          style={{ top, height: ROW_HEIGHT, width: TAG_WIDTH }}
                          onClick={() => select(c.hash)}
                        >
                          {groups.map((group) =>
                            group.length > 1 ? (
                              <RefBadgeGroup
                                key={group[0].fullName}
                                refs={group}
                                color={badgeColor}
                                onCheckout={onCheckout}
                              />
                            ) : (
                              <RefBadge
                                key={group[0].fullName}
                                refInfo={group[0]}
                                color={badgeColor}
                                onCheckout={onCheckout}
                              />
                            ),
                          )}
                        </div>
                      )}
                      <div
                        className={clsx(s.commitRow, isSelected && s.selected)}
                        style={{
                          top,
                          height: ROW_HEIGHT,
                          left: textLeft,
                          ["--row-left" as string]: `${textLeft}px`,
                        }}
                        onClick={() => select(c.hash)}
                      >
                        <span className={s.commitSubject} title={c.subject}>
                          {c.subject}
                        </span>
                        <span className={s.commitMeta}>
                          <span>{c.authorName}</span>
                          <span className={s.commitMetaSep}>·</span>
                          <span>{timeAgo(c.authorTime)}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="scrollbarTrack" keepMounted>
          <ScrollArea.Thumb className="scrollbarThumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}

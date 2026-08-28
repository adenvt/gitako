import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { FilePenLine, FilePlus, FileX } from "lucide-react";
import { GraphCanvas, ROW_HEIGHT, WORKING_ROW } from "./GraphCanvas";
import { useRepoStore } from "@/state/store";
import { timeAgo } from "@/shared/utils/time";
import { countByKind } from "@/shared/utils/status";

const OVERSCAN = 8;

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
  } = useRepoStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 50 });

  const counts = countByKind(statusEntries);
  const hasWorkingRow = counts.added + counts.deleted + counts.modified > 0;
  const offset = hasWorkingRow ? 1 : 0;

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

  if (!layout || layout.commits.length === 0) {
    return <div className="commit-list empty">No commits yet</div>;
  }

  const totalHeight = (layout.commits.length + offset) * ROW_HEIGHT;

  return (
    <div className="commit-list">
      {/* Canvas pinned to the viewport (not the scroll content). */}
      <GraphCanvas
        layout={layout}
        selectedHash={selectedHash}
        hasWorkingRow={hasWorkingRow}
        workingSelected={workingSelected}
        scrollRef={scrollRef}
      />
      <div className="commit-scroll" ref={scrollRef}>
        <div style={{ height: totalHeight, position: "relative" }}>
          <div className="commit-rows">
            {/* Working-directory row (row 0), only when there are changes. */}
            {hasWorkingRow && (
              <div
                className={clsx("commit-row working-row", workingSelected && "selected")}
                style={{ top: WORKING_ROW * ROW_HEIGHT, height: ROW_HEIGHT }}
                onClick={() => {
                  // Select the WIP row (deselects any commit) + open composer.
                  setWorkingSelected(true);
                  openComposer();
                }}
                title="Open commit composer"
              >
                <span className="commit-subject wip-label">
                  WIP
                  {counts.modified > 0 && (
                    <span className="wip-count">
                      <FilePenLine size={13} className="wip-icon modified" aria-hidden />
                      {counts.modified}
                    </span>
                  )}
                  {counts.added > 0 && (
                    <span className="wip-count">
                      <FilePlus size={13} className="wip-icon added" aria-hidden />
                      {counts.added}
                    </span>
                  )}
                  {counts.deleted > 0 && (
                    <span className="wip-count">
                      <FileX size={13} className="wip-icon deleted" aria-hidden />
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
              return (
                <div
                  key={c.hash}
                  className={clsx("commit-row", isSelected && "selected")}
                  style={{
                    top: (i + offset) * ROW_HEIGHT,
                    height: ROW_HEIGHT,
                  }}
                  onClick={() => select(c.hash)}
                >
                  <span className="commit-subject" title={c.subject}>
                    {c.subject}
                  </span>
                  <span className="commit-meta">
                    <span className="commit-author">{c.authorName}</span>
                    <span className="commit-time">{timeAgo(c.authorTime)}</span>
                  </span>
                  <span className="commit-refs">
                    {c.refs.map((r) => (
                      <span key={r} className="commit-ref-badge">
                        {r}
                      </span>
                    ))}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

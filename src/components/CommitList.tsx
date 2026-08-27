import { useEffect, useRef, useState } from "react";
import { GraphCanvas, ROW_HEIGHT } from "../graph/GraphCanvas";
import { useRepoStore } from "../state/store";
import { timeAgo } from "../utils/time";

const OVERSCAN = 8;

/** Virtualized commit list: canvas graph + DOM text labels, one scroll container. */
export function CommitList() {
  const { commits, layout, selectedHash, select } = useRepoStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: 50 });

  // Update the visible row window on scroll/resize.
  const layoutNonNull = layout;
  useEffect(() => {
    if (!layoutNonNull) return;
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const start = Math.max(0, Math.floor(el.scrollTop / ROW_HEIGHT) - OVERSCAN);
      const end = Math.min(
        layoutNonNull.commits.length,
        Math.ceil((el.scrollTop + el.clientHeight) / ROW_HEIGHT) + OVERSCAN,
      );
      setRange((prev) =>
        prev.start === start && prev.end === end ? prev : { start, end },
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
  }, [layoutNonNull]);

  if (!layout || layout.commits.length === 0) {
    return <div className="commit-list empty">No commits yet</div>;
  }

  const totalHeight = layout.commits.length * ROW_HEIGHT;

  return (
    <div className="commit-list">
      {/* Canvas pinned to the viewport (not the scroll content). */}
      <GraphCanvas
        layout={layout}
        selectedHash={selectedHash}
        scrollRef={scrollRef}
      />
      <div className="commit-scroll" ref={scrollRef}>
        <div style={{ height: totalHeight, position: "relative" }}>
          <div className="commit-rows">
            {layout.commits.slice(range.start, range.end).map((_, offset) => {
              const i = range.start + offset;
              const c = commits[i];
              if (!c) return null;
              const isSelected = c.hash === selectedHash;
              return (
                <div
                  key={c.hash}
                  className={`commit-row${isSelected ? " selected" : ""}`}
                  style={{ top: i * ROW_HEIGHT, height: ROW_HEIGHT }}
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

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { useRepoStore } from "@/state/store";
import type { DiffFile } from "@/shared/types/git";
import {
  highlightLines,
  langForPath,
  type Line,
} from "@/shared/utils/highlight";

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
 * Walk each hunk: context lines pair up on both sides; a remove line occupies
 * the left alone (right blank), an add line the right alone (left blank). Rows
 * before the first hunk / between hunks are untouched context.
 */
function buildRows(diff: DiffFile): DiffRow[] {
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

  for (const hunk of diff.hunks) {
    // Context before this hunk (gap since the last hunk ended).
    const gapOld = hunk.oldStart - 1 - oldIdx;
    const gapNew = hunk.newStart - 1 - newIdx;
    pushContext(Math.max(0, Math.min(gapOld, gapNew)));

    let contextOld = 0;
    let contextNew = 0;
    const lines = hunk.lines;

    // First pass: count context lines so we can flush them in order.
    const flushContext = () => {
      const n = Math.max(contextOld, contextNew);
      for (let i = 0; i < n; i++) {
        const hasOld = i < contextOld;
        const hasNew = i < contextNew;
        rows.push({
          oldKind: null,
          oldLine: hasOld ? oldLines[oldIdx] ?? "" : "",
          oldNum: hasOld ? oldIdx + 1 : null,
          newKind: null,
          newLine: hasNew ? newLines[newIdx] ?? "" : "",
          newNum: hasNew ? newIdx + 1 : null,
        });
        if (hasOld) oldIdx++;
        if (hasNew) newIdx++;
      }
      contextOld = 0;
      contextNew = 0;
    };

    for (const line of lines) {
      if (line.kind === "context") {
        contextOld++;
        contextNew++;
        flushContext();
      } else if (line.kind === "remove") {
        flushContext();
        rows.push({
          oldKind: "remove",
          oldLine: oldLines[oldIdx] ?? "",
          oldNum: oldIdx + 1,
          newKind: null,
          newLine: null,
          newNum: null,
        });
        oldIdx++;
      } else {
        // add
        flushContext();
        rows.push({
          oldKind: null,
          oldLine: null,
          oldNum: null,
          newKind: "add",
          newLine: newLines[newIdx] ?? "",
          newNum: newIdx + 1,
        });
        newIdx++;
      }
    }
    flushContext();
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
      oldLine: hasOld ? oldLines[oldIdx] ?? "" : null,
      oldNum: hasOld ? oldIdx + 1 : null,
      newKind: null,
      newLine: hasNew ? newLines[newIdx] ?? "" : null,
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
function Cell({
  text,
  num,
  tokens,
}: {
  text: string;
  num: number | null;
  tokens: Line[] | null;
}) {
  const line = num != null && tokens ? tokens[num - 1] : undefined;
  return (
    <span className="diff-cell">
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

export function DiffView() {
  const { activeDiff, diffCache, closeDiff } = useRepoStore();

  const diff = activeDiff
    ? diffCache[
        `${activeDiff.hash}|${activeDiff.path}|${activeDiff.staged ? "s" : "w"}`
      ]
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

  const oldColRef = useRef<HTMLDivElement>(null);
  const newColRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  // Measure the wider of the two columns so the bottom scrollbar matches.
  useEffect(() => {
    const oldEl = oldColRef.current;
    const newEl = newColRef.current;
    if (!oldEl || !newEl) return;
    const w = Math.max(oldEl.scrollWidth, newEl.scrollWidth);
    setContentWidth((prev) => (prev === w ? prev : w));
  }, [rows, oldTokens, newTokens]);

  // Sync horizontal scroll: strip <-> columns, columns <-> each other.
  const syncingRef = useRef(false);
  const syncScroll = (from: "old" | "new" | "bar") => {
    if (syncingRef.current) return;
    const oldEl = oldColRef.current;
    const newEl = newColRef.current;
    const barEl = scrollbarRef.current;
    if (!oldEl || !newEl) return;
    let left: number;
    if (from === "old") left = oldEl.scrollLeft;
    else if (from === "new") left = newEl.scrollLeft;
    else left = barEl?.scrollLeft ?? 0;
    syncingRef.current = true;
    oldEl.scrollLeft = left;
    newEl.scrollLeft = left;
    if (barEl) barEl.scrollLeft = left;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

  if (!activeDiff) return null;

  return (
    <div className="diff-view">
      <div className="diff-topbar">
        <span className="diff-path mono" title={path}>
          {path}
        </span>
        <button
          className="diff-close"
          onClick={closeDiff}
          aria-label="Close diff"
        >
          <X size={16} aria-hidden />
        </button>
      </div>

      {!diff ? (
        <div className="diff-placeholder">Loading…</div>
      ) : diff.error ? (
        <div className="diff-placeholder">
          Failed to load diff: {diff.error}
        </div>
      ) : diff.binary ? (
        <div className="diff-placeholder">Binary file — no diff preview.</div>
      ) : diff.tooLarge ? (
        <div className="diff-placeholder">File too large to display.</div>
      ) : (
        <>
          <div className="diff-table">
            <div className="diff-cols">
              <div
                className="diff-col"
                ref={oldColRef}
                onScroll={() => syncScroll("old")}
              >
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className={clsx("diff-line", r.oldKind && `diff-${r.oldKind}`)}
                  >
                    <span className="diff-gutter">{r.oldNum ?? ""}</span>
                    {r.oldNum != null ? (
                      <Cell
                        text={r.oldLine ?? ""}
                        num={r.oldNum}
                        tokens={oldTokens}
                      />
                    ) : (
                      <span className="diff-cell diff-empty" aria-hidden />
                    )}
                  </div>
                ))}
              </div>
              <div
                className="diff-col"
                ref={newColRef}
                onScroll={() => syncScroll("new")}
              >
                {rows.map((r, i) => (
                  <div
                    key={i}
                    className={clsx("diff-line", r.newKind && `diff-${r.newKind}`)}
                  >
                    <span className="diff-gutter">{r.newNum ?? ""}</span>
                    {r.newNum != null ? (
                      <Cell
                        text={r.newLine ?? ""}
                        num={r.newNum}
                        tokens={newTokens}
                      />
                    ) : (
                      <span className="diff-cell diff-empty" aria-hidden />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Always-visible horizontal scrollbar, synced with both columns. */}
          <div
            className="diff-scrollbar"
            ref={scrollbarRef}
            onScroll={() => syncScroll("bar")}
          >
            <div style={{ width: Math.max(contentWidth, 1), height: 1 }} />
          </div>
        </>
      )}
    </div>
  );
}

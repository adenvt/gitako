import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import { useRepoStore } from "@/state/store";
import type { DiffFile } from "@/shared/types/git";
import { highlightLines, langForPath, type Line } from "@/shared/utils/highlight";
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

    for (const line of hunk.lines) {
      if (line.kind === "context") {
        // A context boundary ends any unpaired removal run.
        flushRemoves();
        pushContext(1);
      } else if (line.kind === "remove") {
        pushRemove();
      } else {
        // add — pair with a pending removal when one exists (edit), else a
        // standalone insertion.
        if (pendingRemoves.length > 0) pushPairedEdit();
        else pushStandaloneAdd();
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

  const oldColRef = useRef<HTMLDivElement>(null);
  const newColRef = useRef<HTMLDivElement>(null);
  const scrollbarRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  // Size the bottom scrollbar so its full scroll range equals the larger of the
  // two columns' horizontal overflow. The bar is wider than either column, so a
  // raw scrollWidth comparison would under-represent the needed scroll distance.
  useEffect(() => {
    const oldEl = oldColRef.current;
    const newEl = newColRef.current;
    const barEl = scrollbarRef.current;
    if (!oldEl || !newEl || !barEl) return;
    const maxScroll = Math.max(
      oldEl.scrollWidth - oldEl.clientWidth,
      newEl.scrollWidth - newEl.clientWidth,
    );
    const next = barEl.clientWidth + Math.max(0, maxScroll);
    setContentWidth((prev) => (prev === next ? prev : next));
  }, [rows, oldTokens, newTokens]);

  // The bottom bar is the single source of truth for horizontal scroll. It
  // drives both columns' scrollLeft. The columns are scrollable only
  // programmatically (overflow-x: hidden), so there is no feedback loop.
  const syncingRef = useRef(false);
  const syncScroll = () => {
    if (syncingRef.current) return;
    const oldEl = oldColRef.current;
    const newEl = newColRef.current;
    const barEl = scrollbarRef.current;
    if (!oldEl || !newEl || !barEl) return;

    const range = (el: HTMLElement) => Math.max(0, el.scrollWidth - el.clientWidth);
    const oldRange = range(oldEl);
    const newRange = range(newEl);
    const barRange = range(barEl);
    const frac = barRange > 0 ? barEl.scrollLeft / barRange : 0;

    syncingRef.current = true;
    oldEl.scrollLeft = frac * oldRange;
    newEl.scrollLeft = frac * newRange;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  };

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
        <>
          <div className={s.diffTable}>
            <div className={s.diffColHeaders}>
              <div className={s.diffColHeader}>OLD</div>
              <div className={s.diffColHeader}>NEW</div>
            </div>
            <div className={s.diffCols}>
              <div className={s.diffCol} ref={oldColRef}>
                {rows.map((r, i) => (
                  <div key={i} className={clsx(s.diffLine, r.oldKind && s[r.oldKind])}>
                    <span className={s.diffGutter}>
                      <span>{r.oldNum ?? ""}</span>
                      <span className={clsx(s.diffSign, r.oldKind === "remove" && s.remove)}>
                        {r.oldKind === "remove" ? "-" : "\u00a0"}
                      </span>
                    </span>
                    {r.oldNum != null ? (
                      <Cell text={r.oldLine ?? ""} num={r.oldNum} tokens={oldTokens} />
                    ) : (
                      <span className={clsx(s.diffCell, s.diffEmpty)} aria-hidden />
                    )}
                  </div>
                ))}
              </div>
              <div className={s.diffCol} ref={newColRef}>
                {rows.map((r, i) => (
                  <div key={i} className={clsx(s.diffLine, r.newKind && s[r.newKind])}>
                    <span className={s.diffGutter}>
                      <span>{r.newNum ?? ""}</span>
                      <span className={clsx(s.diffSign, r.newKind === "add" && s.add)}>
                        {r.newKind === "add" ? "+" : "\u00a0"}
                      </span>
                    </span>
                    {r.newNum != null ? (
                      <Cell text={r.newLine ?? ""} num={r.newNum} tokens={newTokens} />
                    ) : (
                      <span className={clsx(s.diffCell, s.diffEmpty)} aria-hidden />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* Always-visible horizontal scrollbar, the single scroll source. */}
          <div className={s.diffScrollbar} ref={scrollbarRef} onScroll={syncScroll}>
            <div style={{ width: Math.max(contentWidth, 1), height: 1 }} />
          </div>
        </>
      )}
    </div>
  );
}

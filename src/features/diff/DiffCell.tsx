import { memo, useMemo } from "react";
import clsx from "clsx";
import type { Line } from "@/shared/utils/highlight";
import { diffWords } from "./wordDiff";
import s from "./diff.module.css";

/** Render one cell's text, tokenized when highlight data is available.
 *  Memoized: for a 300-row diff, every parent re-render would otherwise
 *  re-tokenize every cell even when the inputs are identical. */
export const Cell = memo(function Cell({
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
});

/**
 * Cell for a changed (added/removed) line that has a counterpart on the other
 * side (paired edit): the changed words get a stronger tint via diffWords,
 * merged with shiki syntax highlighting so both the token colors and the
 * change emphasis show together. Fully added/removed lines (no counterpart)
 * skip word diffing and get a left-edge bar marker instead.
 */
export const ChangeCell = memo(function ChangeCell({
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
  // The merge of word-diff segments × shiki tokens is O(n) in the line
  // length. Memoize so it only re-runs when the line content or the
  // highlight for this line actually changes.
  const out = useMemo(() => {
    const segments =
      kind === "add" ? diffWords(other, text).newSegs : diffWords(other, text).oldSegs;
    const line = num != null && tokens ? tokens[num - 1] : undefined;
    const colors = line ?? [{ text, color: undefined }];
    const result: { t: string; color?: string; changed: boolean }[] = [];
    let si = 0;
    let ci = 0;
    let segIdx = 0;
    let colIdx = 0;
    while (segIdx < segments.length && colIdx < colors.length) {
      const seg = segments[segIdx];
      const col = colors[colIdx];
      const take = Math.min(seg.text.length - si, col.text.length - ci);
      const t = seg.text.slice(si, si + take);
      if (t.length > 0) result.push({ t, color: col.color, changed: seg.changed });
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
    if (segIdx < segments.length) {
      const seg = segments[segIdx];
      const rest = seg.text.slice(si);
      if (rest.length > 0) result.push({ t: rest, changed: seg.changed });
    }
    return result;
  }, [text, num, kind, other, tokens]);

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
});

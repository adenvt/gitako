import clsx from "clsx";
import { ScrollArea } from "@base-ui/react/scroll-area";
import type { Line } from "@/shared/utils/highlight";
import type { DiffRow } from "./align";
import { Cell, ChangeCell } from "./DiffCell";
import s from "./diff.module.css";

/**
 * One side of the side-by-side diff. Each pane is its own scroll container so
 * long lines clip cleanly at the column edge and scroll horizontally on their
 * own; the parent syncs their vertical scroll to keep rows aligned.
 */
export function DiffPane({
  side,
  rows,
  tokens,
  viewportRef,
  onScroll,
  onPointerEnter,
  minimap,
}: {
  side: "old" | "new";
  rows: DiffRow[];
  tokens: Line[] | null;
  viewportRef: React.RefObject<HTMLDivElement>;
  onScroll: (src: HTMLDivElement) => void;
  onPointerEnter: (src: HTMLDivElement) => void;
  minimap?: React.ReactNode;
}) {
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
          <ScrollArea.Content className={s.diffContent}>
            <div className={s.diffCol}>
              {rows.map((r, i) => {
                const num = side === "old" ? r.oldNum : r.newNum;
                const kind = side === "old" ? r.oldKind : r.newKind;
                const text = (side === "old" ? r.oldLine : r.newLine) ?? "";
                const other =
                  side === "old"
                    ? r.newNum != null
                      ? (r.newLine ?? null)
                      : null
                    : r.oldNum != null
                      ? (r.oldLine ?? null)
                      : null;
                // A fully added/removed row has no counterpart line to word-diff
                // against — mark it with a left-edge bar instead of word emphasis.
                const isFull = kind != null && other == null;
                return (
                  <div key={i} className={clsx(s.diffLine, kind && s[kind], isFull && s.diffFull)}>
                    <span className={s.diffGutter}>
                      <span>{num ?? ""}</span>
                      <span
                        className={clsx(
                          s.diffSign,
                          kind === "remove" && s.remove,
                          kind === "add" && s.add,
                        )}
                      >
                        {kind === "remove" ? "-" : kind === "add" ? "+" : "\u00a0"}
                      </span>
                    </span>
                    {num != null ? (
                      kind && !isFull ? (
                        <ChangeCell
                          text={text}
                          num={num}
                          kind={kind}
                          other={other as string}
                          tokens={tokens}
                        />
                      ) : (
                        <Cell text={text} num={num} tokens={tokens} />
                      )
                    ) : (
                      <span className={clsx(s.diffCell, s.diffEmpty)} aria-hidden />
                    )}
                  </div>
                );
              })}
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

import { useEffect, useState } from "react";
import { highlightLines, type Line } from "@/shared/utils/highlight";

/** Async-highlight a code string into per-line token arrays. */
export function useHighlightedLines(code: string, lang: string): Line[] | null {
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

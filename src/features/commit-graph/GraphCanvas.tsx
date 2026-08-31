import { useEffect, useRef } from "react";
import {
  drawGraph,
  GRAPH_PAD,
  graphGutter,
  LANE_PAD,
  LANE_WIDTH,
  MIN_GRAPH_BAND,
  ROW_HEIGHT,
  TAG_WIDTH,
  type GraphViewport,
  WORKING_ROW,
} from "./drawGraph";
import type { LayoutResult } from "./layout";
import s from "./graphCanvas.module.css";

// Re-export the layout constants so existing imports keep working.
export {
  GRAPH_PAD,
  graphGutter,
  LANE_PAD,
  LANE_WIDTH,
  MIN_GRAPH_BAND,
  ROW_HEIGHT,
  TAG_WIDTH,
  WORKING_ROW,
};

interface GraphCanvasProps {
  layout: LayoutResult;
  selectedHash: string | null;
  /** True when the working-directory row should be drawn (uncommitted changes). */
  hasWorkingRow: boolean;
  /** True when the working-directory row is selected (highlighted). */
  workingSelected: boolean;
  /** Scroll container that owns vertical scrolling (set by parent). */
  scrollRef: React.RefObject<HTMLDivElement>;
  /** Width of the graph band (tag column excluded). Lanes scale to fit it. */
  graphBand: number;
}

/**
 * Canvas renderer for the commit graph. The canvas is sized to its container
 * (not the scroll content) and redraws the visible row window on scroll.
 *
 * The actual drawing logic lives in `drawGraph` so it can be unit-tested
 * with a mocked 2D context (canvas APIs aren't available in happy-dom).
 */
export function GraphCanvas({
  layout,
  selectedHash,
  hasWorkingRow,
  workingSelected,
  scrollRef,
  graphBand,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef(layout);
  const selectedRef = useRef(selectedHash);
  const workingRef = useRef(hasWorkingRow);
  const workingSelectedRef = useRef(workingSelected);
  const graphBandRef = useRef(graphBand);
  layoutRef.current = layout;
  selectedRef.current = selectedHash;
  workingRef.current = hasWorkingRow;
  workingSelectedRef.current = workingSelected;
  graphBandRef.current = graphBand;

  const drawRef = useRef<() => void>(() => {});
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Cast: happy-dom doesn't implement a 2D context, so the test uses a
    // mock. The runtime path uses the real CanvasRenderingContext2D, which
    // structurally satisfies the DrawingContext shape.
    const ctx = canvas.getContext("2d") as unknown as Parameters<typeof drawGraph>[0] | null;
    if (!ctx) return;

    const draw = () => {
      const container = scrollRef.current;
      if (!container) return;
      const dpr = window.devicePixelRatio || 1;
      const width = container.clientWidth;
      const height = container.clientHeight;
      if (width === 0 || height === 0) return;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const viewport: GraphViewport = {
        width,
        height,
        scrollTop: container.scrollTop,
        graphBand: graphBandRef.current,
        selectedHash: selectedRef.current,
        hasWorkingRow: workingRef.current,
        workingSelected: workingSelectedRef.current,
      };
      drawGraph(ctx, layoutRef.current, viewport);
    };

    drawRef.current = draw;
    draw();
    const ro = new ResizeObserver(draw);
    const container = scrollRef.current;
    if (container) ro.observe(container);
    return () => ro.disconnect();
  }, [layout, scrollRef, graphBand]);

  // Redraw on scroll.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onScroll = () => drawRef.current();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  // Redraw when the selected commit or working-row state changes.
  useEffect(() => {
    drawRef.current();
  }, [selectedHash, hasWorkingRow, workingSelected]);

  return (
    <canvas
      ref={canvasRef}
      className={s.graphCanvas}
      // The canvas lives OUTSIDE the scroll content (in the viewport-sized
      // .commit-list), so it's absolutely positioned to the viewport and stays
      // put while the commit rows scroll beneath it. The draw code maps
      // row -> viewport Y by subtracting scrollTop, which matches this.
      style={{ pointerEvents: "none" }}
    />
  );
}

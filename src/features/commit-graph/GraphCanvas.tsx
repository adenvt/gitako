import { useEffect, useRef } from "react";
import type { LayoutResult } from "./layout";
import { laneColor } from "./colors";

export const ROW_HEIGHT = 36;
export const LANE_WIDTH = 18;
export const LANE_PAD = 12; // left padding before lane 0

/** Visual rows above the first commit: the working-directory row. */
export const WORKING_ROW = 0;

interface GraphCanvasProps {
  layout: LayoutResult;
  selectedHash: string | null;
  /** True when the working-directory row should be drawn (uncommitted changes). */
  hasWorkingRow: boolean;
  /** Scroll container that owns vertical scrolling (set by parent). */
  scrollRef: React.RefObject<HTMLDivElement>;
}

/**
 * Canvas renderer for the commit graph. The canvas is sized to its container
 * (not the scroll content) and redraws the visible row window on scroll.
 *
 * Rendering model (see layout.ts):
 *  - each commit sits at y = index * ROW_HEIGHT + ROW_HEIGHT/2
 *  - lane lines: lane L is drawn from the row of its first occupancy to the
 *    row where it is freed (inclusive), so merged lanes visually reach their
 *    merge point
 *  - edges: horizontal connector at the CHILD's row from child lane to parent
 *    lane, when the lanes differ
 */
export function GraphCanvas({
  layout,
  selectedHash,
  hasWorkingRow,
  scrollRef,
}: GraphCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef(layout);
  const selectedRef = useRef(selectedHash);
  const workingRef = useRef(hasWorkingRow);
  layoutRef.current = layout;
  selectedRef.current = selectedHash;
  workingRef.current = hasWorkingRow;

  /** Row offset for commits: 1 when the working row is shown, else 0. */
  const offsetRef = useRef(hasWorkingRow ? 1 : 0);
  offsetRef.current = hasWorkingRow ? 1 : 0;

  const drawRef = useRef<() => void>(() => {});
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
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

      const cur = layoutRef.current;
      ctx.clearRect(0, 0, width, height);

      const offset = offsetRef.current;
      const totalRows = cur.commits.length + offset;
      const scrollTop = container.scrollTop;
      const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
      const lastRow = Math.min(
        totalRows - 1,
        Math.ceil((scrollTop + height) / ROW_HEIGHT) + 5,
      );

      const xOf = (lane: number) => LANE_PAD + lane * LANE_WIDTH + LANE_WIDTH / 2;
      const screenYOf = (row: number) =>
        row * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;

      // ---- working directory: dashed connector from row 0 down to HEAD ----
      const headCommit = cur.commits[0];
      if (workingRef.current && headCommit) {
        const wx = xOf(headCommit.lane);
        const wy = screenYOf(WORKING_ROW);
        const hy = screenYOf(offset);
        ctx.strokeStyle = "#888";
        ctx.globalAlpha = 0.7;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx, hy);
        ctx.stroke();
        ctx.setLineDash([]);
        // Working-directory dot.
        ctx.beginPath();
        ctx.arc(wx, wy, 5, 0, Math.PI * 2);
        ctx.fillStyle = "#888";
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // ---- edges: vertical lines + curved connectors ----
      // Each edge connects a child (higher row) to a parent (lower row).
      // Same-lane edges draw a straight vertical line between dot centers.
      // Cross-lane edges draw one continuous path: horizontal from the child
      // dot to the parent's lane, a rounded corner, then vertical down to the
      // parent dot. The canvas clips naturally at its bounds, so geometry
      // extending off-screen (child above viewport, etc.) renders correctly.
      const R = 6; // corner radius

      for (const edge of cur.edges) {
        const cy = screenYOf(edge.childIndex + offset);
        const py = screenYOf(edge.parentIndex + offset);
        // Skip edges entirely outside the viewport (both endpoints off-screen).
        if ((cy < 0 && py < 0) || (cy > height && py > height)) continue;

        const cx = xOf(edge.childLane);
        const px = xOf(edge.parentLane);
        const color = laneColor(edge.parentLane);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 2;

        if (edge.childLane === edge.parentLane) {
          // Straight vertical between dot centers.
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(px, py);
          ctx.stroke();
        } else {
          // L-shaped with a rounded corner: child dot -> horizontal to the
          // parent's lane -> curve down -> vertical to parent dot.
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          if (px > cx) {
            // corner is to the right and below
            ctx.lineTo(px - R, cy);
            ctx.quadraticCurveTo(px, cy, px, cy + R);
          } else {
            // corner is to the left and below
            ctx.lineTo(px + R, cy);
            ctx.quadraticCurveTo(px, cy, px, cy + R);
          }
          ctx.lineTo(px, py);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }

      // ---- commits ----
      for (let i = firstRow; i <= lastRow; i++) {
        const commitIdx = i - offset;
        const c = cur.commits[commitIdx];
        if (!c) continue;
        const x = xOf(c.lane);
        const y = screenYOf(i);
        const color = laneColor(c.lane);
        const isSelected = c.hash === selectedRef.current;

        // merge commits: soft outer bubble
        if (c.isMerge) {
          ctx.beginPath();
          ctx.arc(x, y, 7, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.globalAlpha = 0.35;
          ctx.fill();
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(x, y, 8.5, 0, Math.PI * 2);
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    };

    drawRef.current = draw;
    draw();
    const ro = new ResizeObserver(draw);
    const container = scrollRef.current;
    if (container) ro.observe(container);
    return () => ro.disconnect();
  }, [layout, scrollRef]);

  // Redraw on scroll.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onScroll = () => drawRef.current();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [scrollRef]);

  // Redraw when the selected commit or working-row visibility changes.
  useEffect(() => {
    drawRef.current();
  }, [selectedHash, hasWorkingRow]);

  return (
    <canvas
      ref={canvasRef}
      className="graph-canvas"
      // The canvas lives OUTSIDE the scroll content (in the viewport-sized
      // .commit-list), so it's absolutely positioned to the viewport and stays
      // put while the commit rows scroll beneath it. The draw code maps
      // row -> viewport Y by subtracting scrollTop, which matches this.
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    />
  );
}

/**
 * Pure canvas drawing logic for the commit graph. Lives outside the React
 * component so it can be unit-tested with a mocked 2D context (the actual
 * `<canvas>` API is unavailable in happy-dom, and we don't want to ship a
 * full canvas polyfill just for tests).
 *
 * The draw function:
 *  - clears the visible region
 *  - draws the WIP connector + dot when there are uncommitted changes
 *  - draws each edge (same-lane: vertical; cross-lane: "type A" merge to
 *    the right, or "type B" / fork to the left)
 *  - draws each visible commit dot, with a soft outer bubble for merges
 *    and a selection ring for the selected commit
 *
 * All geometry is computed from `viewport` so the function is deterministic.
 */
import { laneColor } from "./colors";
import type { LayoutResult } from "./layout";

/** Layout constants also imported by the component. Re-exported here so a
 * single import gives the renderer everything it needs. */
export const ROW_HEIGHT = 36;
export const LANE_WIDTH = 18;
export const LANE_PAD = 12;
export const TAG_WIDTH = 140;
export const GRAPH_PAD = 16;
export const MIN_GRAPH_BAND = LANE_PAD + LANE_WIDTH / 2 + GRAPH_PAD;
export const WORKING_ROW = 0;

/** Visual row offset for the working-directory row. */
export const workingRowOffset = (hasWorkingRow: boolean) => (hasWorkingRow ? 1 : 0);

/** The clipped view of the layout the renderer is asked to draw. */
export interface GraphViewport {
  /** Layout's logical width in CSS px (set canvas.width = this * dpr). */
  width: number;
  /** Layout's logical height in CSS px. */
  height: number;
  /** Number of CSS pixels the user has scrolled down. */
  scrollTop: number;
  /** Resizable graph band width in CSS px (TAG_WIDTH is excluded from this). */
  graphBand: number;
  /** Selected commit hash (for the selection ring). */
  selectedHash: string | null;
  /** True when a working-directory row should be drawn. */
  hasWorkingRow: boolean;
  /** True when the working-directory row is selected. */
  workingSelected: boolean;
}

/** Canvas neutrals — must match the CSS variables in base.css. */
const DOT_STROKE = "#0f1319";
const WIP_COLOR = "#66707d";
const SELECTED_RING = "#e3e8ee";

/** Corner radius for the curve at the parent/child intersection. */
const EDGE_R = 6;

/** Min/max visible row bounds in commit-index space, with a 5-row overscan. */
export function visibleRowRange(
  layout: LayoutResult,
  hasWorkingRow: boolean,
  scrollTop: number,
  height: number,
): { firstRow: number; lastRow: number; offset: number; totalRows: number } {
  const offset = workingRowOffset(hasWorkingRow);
  const totalRows = layout.commits.length + offset;
  const firstRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 5);
  const lastRow = Math.min(
    totalRows - 1,
    Math.ceil((scrollTop + height) / ROW_HEIGHT) + 5,
  );
  return { firstRow, lastRow, offset, totalRows };
}

/** Compute the canvas X coordinate for a given lane index, with the band's
 * sticky-right clamp. */
export function laneX(lane: number, graphBand: number): number {
  const bandRight = TAG_WIDTH + graphBand - GRAPH_PAD;
  const dotX = TAG_WIDTH + LANE_PAD + lane * LANE_WIDTH + LANE_WIDTH / 2;
  return Math.min(dotX, bandRight);
}

/** Convert a logical row (in commit-index + working-row space) to a Y in
 * viewport space, accounting for scrollTop. */
export function screenY(row: number, scrollTop: number): number {
  return row * ROW_HEIGHT + ROW_HEIGHT / 2 - scrollTop;
}

/** Is this edge entirely outside the visible viewport? */
function edgeOffscreen(
  cy: number,
  py: number,
  height: number,
): boolean {
  return (cy < 0 && py < 0) || (cy > height && py > height);
}

/** Minimal 2D-context shape the renderer relies on. Lets us mock the
 * canvas in tests without standing up a full implementation. */
export interface DrawingContext {
  clearRect: (x: number, y: number, w: number, h: number) => void;
  setTransform: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void;
  arc: (x: number, y: number, r: number, startAngle: number, endAngle: number) => void;
  fill: () => void;
  stroke: () => void;
  setLineDash: (segments: number[]) => void;
  // State-setter properties (string/number/boolean). We use `unknown` because
  // each test mock decides the real type.
  strokeStyle: string;
  fillStyle: string;
  lineWidth: number;
  globalAlpha: number;
}

/** The full draw operation. Callers supply a mockable DrawingContext. */
export function drawGraph(
  ctx: DrawingContext,
  layout: LayoutResult,
  viewport: GraphViewport,
): void {
  const { width, height, scrollTop, graphBand, selectedHash, hasWorkingRow, workingSelected } = viewport;

  ctx.clearRect(0, 0, width, height);

  const { firstRow, lastRow, offset } = visibleRowRange(
    layout,
    hasWorkingRow,
    scrollTop,
    height,
  );

  // ---- WIP connector + dot (working directory) ----
  const headCommit = layout.commits[0];
  if (hasWorkingRow && headCommit) {
    const wx = laneX(headCommit.lane, graphBand);
    const wy = screenY(WORKING_ROW, scrollTop);
    const hy = screenY(offset, scrollTop);
    ctx.strokeStyle = WIP_COLOR;
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
    ctx.fillStyle = WIP_COLOR;
    ctx.fill();
    ctx.strokeStyle = DOT_STROKE;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    if (workingSelected) {
      ctx.beginPath();
      ctx.arc(wx, wy, 8.5, 0, Math.PI * 2);
      ctx.strokeStyle = SELECTED_RING;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- edges ----
  for (const edge of layout.edges) {
    const cy = screenY(edge.childIndex + offset, scrollTop);
    const py = screenY(edge.parentIndex + offset, scrollTop);
    if (edgeOffscreen(cy, py, height)) continue;

    const cx = laneX(edge.childLane, graphBand);
    const px = laneX(edge.parentLane, graphBand);
    const color = laneColor(edge.parentLane);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;

    if (edge.childLane === edge.parentLane) {
      // Same-lane: straight vertical between dot centers.
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(px, py);
      ctx.stroke();
    } else {
      const isMergeEdge = layout.commits[edge.childIndex]?.isMerge ?? false;
      if (isMergeEdge && px > cx) {
        // Type A — "turn right, drop down".
        ctx.strokeStyle = laneColor(edge.parentLane);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(px - EDGE_R, cy);
        ctx.quadraticCurveTo(px, cy, px, cy + EDGE_R);
        ctx.lineTo(px, py);
        ctx.stroke();
      } else {
        // Type B / fork.
        ctx.strokeStyle = laneColor(edge.childLane);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx, py - EDGE_R);
        ctx.quadraticCurveTo(cx, py, cx + (px > cx ? EDGE_R : -EDGE_R), py);
        ctx.lineTo(px, py);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---- commit dots ----
  for (let i = firstRow; i <= lastRow; i++) {
    const commitIdx = i - offset;
    const c = layout.commits[commitIdx];
    if (!c) continue;
    const x = laneX(c.lane, graphBand);
    const y = screenY(i, scrollTop);
    const color = laneColor(c.lane);
    const isSelected = c.hash === selectedHash;

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
    ctx.strokeStyle = DOT_STROKE;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (isSelected) {
      ctx.beginPath();
      ctx.arc(x, y, 8.5, 0, Math.PI * 2);
      ctx.strokeStyle = SELECTED_RING;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
}

/** Compute the graph gutter (the X range reserved for lanes) for a given
 * max lane. Re-exported here so the renderer is self-contained. */
export const graphGutter = (maxLane: number) =>
  LANE_PAD + (maxLane + 1) * LANE_WIDTH + GRAPH_PAD;

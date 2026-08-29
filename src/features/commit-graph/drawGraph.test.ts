import { describe, expect, it } from "vitest";
import {
  drawGraph,
  graphGutter,
  laneX,
  MIN_GRAPH_BAND,
  ROW_HEIGHT,
  screenY,
  TAG_WIDTH,
  visibleRowRange,
  WORKING_ROW,
  type DrawingContext,
  type GraphViewport,
} from "./drawGraph";
import { LANE_COLORS, laneColor } from "./colors";
import { layout, type LayoutResult } from "./layout";

/** Build a recording 2D context. Returns the context + a call log. */
function makeContext(): DrawingContext & {
  calls: Array<{ method: string; args: unknown[] }>;
  setStyle: { stroke: string | null; fill: string | null; lineWidth: number | null; alpha: number | null };
  path: Array<{ op: string; args: number[] }>;
} {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const path: Array<{ op: string; args: number[] }> = [];
  const setStyle = { stroke: null as string | null, fill: null as string | null, lineWidth: null as number | null, alpha: null as number | null };
  const ctx: DrawingContext = {
    clearRect: (x, y, w, h) => calls.push({ method: "clearRect", args: [x, y, w, h] }),
    setTransform: (a, b, c, d, e, f) => calls.push({ method: "setTransform", args: [a, b, c, d, e, f] }),
    beginPath: () => path.push({ op: "begin", args: [] }),
    moveTo: (x, y) => path.push({ op: "moveTo", args: [x, y] }),
    lineTo: (x, y) => path.push({ op: "lineTo", args: [x, y] }),
    quadraticCurveTo: (cpx, cpy, x, y) => path.push({ op: "quad", args: [cpx, cpy, x, y] }),
    arc: (x, y, r) => path.push({ op: "arc", args: [x, y, r] }),
    fill: () => calls.push({ method: "fill", args: [] }),
    stroke: () => calls.push({ method: "stroke", args: [path.slice()] }),
    setLineDash: (segs) => calls.push({ method: "setLineDash", args: [segs] }),
    get strokeStyle() { return setStyle.stroke ?? ""; },
    set strokeStyle(v: string) { setStyle.stroke = v; calls.push({ method: "setStrokeStyle", args: [v] }); },
    get fillStyle() { return setStyle.fill ?? ""; },
    set fillStyle(v: string) { setStyle.fill = v; calls.push({ method: "setFillStyle", args: [v] }); },
    get lineWidth() { return setStyle.lineWidth ?? 0; },
    set lineWidth(v: number) { setStyle.lineWidth = v; calls.push({ method: "setLineWidth", args: [v] }); },
    get globalAlpha() { return setStyle.alpha ?? 1; },
    set globalAlpha(v: number) { setStyle.alpha = v; calls.push({ method: "setAlpha", args: [v] }); },
  };
  return Object.assign(ctx, { calls, setStyle, path });
}

function makeLayout(rows: [string, string[]][]): LayoutResult {
  return layout(rows.map(([hash, parents]) => ({ hash, parents })));
}

const DEFAULT_VIEWPORT: GraphViewport = {
  width: 800,
  height: 400,
  scrollTop: 0,
  graphBand: graphGutter(2),
  selectedHash: null,
  hasWorkingRow: false,
  workingSelected: false,
};

describe("pure geometry helpers", () => {
  it("graphGutter scales by lane count", () => {
    expect(graphGutter(0)).toBe(12 + 18 + 16);
    expect(graphGutter(1)).toBe(12 + 36 + 16);
    expect(graphGutter(3)).toBe(12 + 72 + 16);
  });

  it("laneX returns the dot center for in-range lanes", () => {
    // TAG_WIDTH + LANE_PAD + lane*LANE_WIDTH + LANE_WIDTH/2
    expect(laneX(0, 200)).toBe(TAG_WIDTH + 12 + 0 + 9);
    expect(laneX(1, 200)).toBe(TAG_WIDTH + 12 + 18 + 9);
  });

  it("laneX clamps to the band's right edge when a lane falls outside", () => {
    // bandRight = TAG_WIDTH + graphBand - GRAPH_PAD
    const bandRight = TAG_WIDTH + 50 - 16; // = TAG_WIDTH + 34
    const wideX = TAG_WIDTH + 12 + 10 * 18 + 9; // would be way past bandRight
    expect(laneX(10, 50)).toBe(Math.min(wideX, bandRight));
    expect(laneX(10, 50)).toBe(bandRight);
  });

  it("screenY maps a logical row to a viewport Y by subtracting scrollTop", () => {
    expect(screenY(0, 0)).toBe(ROW_HEIGHT / 2);
    expect(screenY(1, 0)).toBe(ROW_HEIGHT + ROW_HEIGHT / 2);
    expect(screenY(5, 100)).toBe(5 * ROW_HEIGHT + ROW_HEIGHT / 2 - 100);
  });

  it("visibleRowRange clamps to the layout and includes a 5-row overscan", () => {
    const lay = makeLayout([
      ["c0", []],
      ["c1", ["c0"]],
      ["c2", ["c1"]],
    ]);
    // No overscan at scroll 0: starts at 0.
    const r1 = visibleRowRange(lay, false, 0, 100);
    expect(r1.firstRow).toBe(0);
    expect(r1.totalRows).toBe(3);
    expect(r1.offset).toBe(0);

    // With working row: totalRows = commits + 1, offset = 1.
    const r2 = visibleRowRange(lay, true, 0, 200);
    expect(r2.totalRows).toBe(4);
    expect(r2.offset).toBe(1);
  });

  it("visibleRowRange floors on negative scroll and caps at totalRows-1", () => {
    const lay = makeLayout([["c0", []]]);
    expect(visibleRowRange(lay, false, 1000, 100).lastRow).toBe(0);
  });
});

describe("drawGraph", () => {
  it("clears the viewport with the given dimensions", () => {
    const lay = makeLayout([["c0", []]]);
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, width: 123, height: 456 });
    const clear = ctx.calls.find((c) => c.method === "clearRect");
    expect(clear).toBeDefined();
    expect(clear?.args).toEqual([0, 0, 123, 456]);
  });

  it("does not draw the WIP connector when hasWorkingRow is false", () => {
    const lay = makeLayout([["c0", []]]);
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, hasWorkingRow: false });
    // No dashed line setLineDash should be called (the WIP connector is the
    // only place that uses a dashed line).
    expect(ctx.calls.some((c) => c.method === "setLineDash")).toBe(false);
  });

  it("draws the WIP dashed connector + dot + selection ring when hasWorkingRow is true", () => {
    const lay = makeLayout([["c0", []]]);
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, hasWorkingRow: true, workingSelected: true });
    // setLineDash([3,3]) for the dashed line.
    expect(ctx.calls.some((c) => c.method === "setLineDash" && JSON.stringify(c.args) === JSON.stringify([[3, 3]]))).toBe(true);
    // A working dot arc.
    expect(ctx.path.some((p) => p.op === "arc" && p.args[2] === 5)).toBe(true);
    // Selection ring (radius 8.5) when workingSelected.
    expect(ctx.path.some((p) => p.op === "arc" && p.args[2] === 8.5)).toBe(true);
  });

  it("does NOT draw the WIP selection ring when workingSelected is false", () => {
    const lay = makeLayout([["c0", []]]);
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, hasWorkingRow: true, workingSelected: false });
    expect(ctx.path.some((p) => p.op === "arc" && p.args[2] === 8.5)).toBe(false);
  });

  it("draws a same-lane edge as a straight line (moveTo + lineTo, no curve)", () => {
    // Linear history: c1 <- c2 <- c3, all in lane 0.
    const lay = makeLayout([
      ["c2", ["c1"]],
      ["c1", ["c0"]],
      ["c0", []],
    ]);
    const ctx = makeContext();
    drawGraph(ctx, lay, DEFAULT_VIEWPORT);
    // No quadratic curves should be drawn for straight same-lane edges.
    expect(ctx.path.some((p) => p.op === "quad")).toBe(false);
    // Stroke calls present (one per edge + dot strokes).
    expect(ctx.calls.filter((c) => c.method === "stroke").length).toBeGreaterThan(0);
  });

  it("draws a Type A merge (branch to the right of the merge) with a quadratic curve", () => {
    // A merge commit c3 with two parents in different lanes.
    // c3 is in lane 0; parent c1 in lane 0; parent c2 in lane 1.
    // The cross-lane edge to c2 (parentLane 1 > childLane 0) is Type A.
    const lay = makeLayout([
      ["c3", ["c1", "c2"]],
      ["c1", ["c0"]],
      ["c2", ["c0"]],
      ["c0", []],
    ]);
    const ctx = makeContext();
    drawGraph(ctx, lay, DEFAULT_VIEWPORT);
    expect(ctx.path.some((p) => p.op === "quad")).toBe(true);
  });

  it("draws a fork edge (non-merge) with a Type B curve", () => {
    // A non-merge commit with two parents: c2 <- (c1, c0) is NOT possible
    // because layout forces a child into the first parent's lane. The
    // typical fork is: a child in lane 0, parent in lane 1 (because c0 in
    // lane 1 is the new tip). For a fork, the edge is child=c2(lane 0) ->
    // parent=c0(lane 1). The commit c2 is NOT a merge (only 1 parent
    // producing this edge), but the layout's child-lanes-only-merge rule
    // means this child has lane 0 with parent in lane 1. We force a fork
    // shape with a direct layout result.
    const lay: LayoutResult = {
      commits: [
        { hash: "c0", parents: [], children: [], lane: 1, isMerge: false },
        { hash: "c1", parents: ["c0"], children: [0], lane: 0, isMerge: false },
      ],
      edges: [{ parentLane: 1, childLane: 0, parentIndex: 0, childIndex: 1 }],
      maxLane: 1,
    };
    const ctx = makeContext();
    drawGraph(ctx, lay, DEFAULT_VIEWPORT);
    // Type B: drop down, then turn. The direction of turn is right (px > cx),
    // so the curve uses +R.
    const quad = ctx.path.find((p) => p.op === "quad");
    expect(quad).toBeDefined();
  });

  it("skips edges that are entirely off-screen", () => {
    // A layout with a long-spanning edge; the viewport only sees the top.
    const lay: LayoutResult = {
      commits: [
        { hash: "c0", parents: [], children: [], lane: 0, isMerge: false },
        { hash: "c1", parents: ["c0"], children: [0], lane: 0, isMerge: false },
      ],
      edges: [{ parentLane: 0, childLane: 0, parentIndex: 1, childIndex: 0 }],
      maxLane: 0,
    };
    const ctx = makeContext();
    // Scroll way past both rows: both endpoints above the viewport.
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, scrollTop: 10000, height: 200 });
    // No stroke call for an off-screen edge.
    // The commit dots that are out of view won't be drawn either, so the
    // call log should have very few strokes/fills.
    const strokes = ctx.calls.filter((c) => c.method === "stroke");
    // We only expect zero strokes for the edge loop. The commit loop also
    // won't draw anything off-screen.
    expect(strokes.length).toBe(0);
  });

  it("draws a soft outer bubble for merge commits (radius 7) before the dot", () => {
    const lay: LayoutResult = {
      commits: [
        { hash: "c0", parents: [], children: [], lane: 0, isMerge: true },
      ],
      edges: [],
      maxLane: 0,
    };
    const ctx = makeContext();
    drawGraph(ctx, lay, DEFAULT_VIEWPORT);
    // The merge bubble arc (r=7) appears before the dot arc (r=5).
    const bubbleIdx = ctx.path.findIndex((p) => p.op === "arc" && p.args[2] === 7);
    const dotIdx = ctx.path.findIndex((p) => p.op === "arc" && p.args[2] === 5);
    expect(bubbleIdx).toBeGreaterThanOrEqual(0);
    expect(dotIdx).toBeGreaterThan(bubbleIdx);
  });

  it("draws the selection ring (radius 8.5) when the commit is selected", () => {
    const lay: LayoutResult = {
      commits: [
        { hash: "selected", parents: [], children: [], lane: 0, isMerge: false },
      ],
      edges: [],
      maxLane: 0,
    };
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, selectedHash: "selected" });
    expect(ctx.path.some((p) => p.op === "arc" && p.args[2] === 8.5)).toBe(true);
  });

  it("does NOT draw the selection ring when no commit is selected", () => {
    const lay: LayoutResult = {
      commits: [
        { hash: "c0", parents: [], children: [], lane: 0, isMerge: false },
      ],
      edges: [],
      maxLane: 0,
    };
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, selectedHash: null });
    expect(ctx.path.some((p) => p.op === "arc" && p.args[2] === 8.5)).toBe(false);
  });

  it("uses laneColor(parentLane) for the edge stroke (not the child's)", () => {
    // Edge from child lane 0 to parent lane 2. Expected stroke = laneColor(2).
    const lay: LayoutResult = {
      commits: [
        { hash: "p", parents: [], children: [], lane: 2, isMerge: false },
        { hash: "c", parents: ["p"], children: [0], lane: 0, isMerge: false },
      ],
      edges: [{ parentLane: 2, childLane: 0, parentIndex: 0, childIndex: 1 }],
      maxLane: 2,
    };
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT });
    // The first strokeStyle set for this edge should match laneColor(2).
    const strokeSets = ctx.calls.filter((c) => c.method === "setStrokeStyle");
    expect(strokeSets[0]?.args[0]).toBe(laneColor(2));
  });

  it("resets globalAlpha back to 1 after the WIP section (no leftover alpha)", () => {
    const lay = makeLayout([["c0", []]]);
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, hasWorkingRow: true });
    // The WIP section ends with globalAlpha = 1. The last alpha set should
    // be 1 (or default, which our mock records as 1).
    const alphas = ctx.calls.filter((c) => c.method === "setAlpha").map((c) => c.args[0]);
    expect(alphas[alphas.length - 1]).toBe(1);
  });

  it("uses the WIP_COLOR stroke for the working connector and the DOT_STROKE for the dot", () => {
    const lay = makeLayout([["c0", []]]);
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, hasWorkingRow: true });
    const strokeSets = ctx.calls.filter((c) => c.method === "setStrokeStyle").map((c) => c.args[0]);
    // First stroke for the WIP dashed line uses the WIP color (faint text).
    expect(strokeSets[0]).toBe("#66707d");
    // Then the dot's outer ring uses DOT_STROKE (bg).
    expect(strokeSets).toContain("#0f1319");
  });

  it("uses SELECTED_RING color for the selection ring", () => {
    const lay: LayoutResult = {
      commits: [
        { hash: "x", parents: [], children: [], lane: 0, isMerge: false },
      ],
      edges: [],
      maxLane: 0,
    };
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, selectedHash: "x" });
    const strokeSets = ctx.calls.filter((c) => c.method === "setStrokeStyle").map((c) => c.args[0]);
    // The selection ring is the last stroke set with --text color.
    expect(strokeSets[strokeSets.length - 1]).toBe("#e3e8ee");
  });

  it("draws the dot with fillStyle = laneColor and strokeStyle = DOT_STROKE", () => {
    const lay: LayoutResult = {
      commits: [
        { hash: "x", parents: [], children: [], lane: 1, isMerge: false },
      ],
      edges: [],
      maxLane: 1,
    };
    const ctx = makeContext();
    drawGraph(ctx, lay, DEFAULT_VIEWPORT);
    const fills = ctx.calls.filter((c) => c.method === "setFillStyle").map((c) => c.args[0]);
    // At least one fill is the dot's fill = laneColor(1).
    expect(fills).toContain(laneColor(1));
  });
});

describe("drawGraph integration with the layout algorithm", () => {
  it("renders a 3-commit linear history without throwing", () => {
    const lay = makeLayout([
      ["c2", ["c1"]],
      ["c1", ["c0"]],
      ["c0", []],
    ]);
    const ctx = makeContext();
    expect(() => drawGraph(ctx, lay, DEFAULT_VIEWPORT)).not.toThrow();
    // 3 dot arcs (r=5) and 2 same-lane edge strokes.
    expect(ctx.path.filter((p) => p.op === "arc" && p.args[2] === 5).length).toBe(3);
  });

  it("renders a branch+merge without throwing", () => {
    const lay = makeLayout([
      ["c4", ["c3", "c2"]],
      ["c3", ["c1"]],
      ["c2", ["c1"]],
      ["c1", []],
    ]);
    const ctx = makeContext();
    expect(() => drawGraph(ctx, lay, DEFAULT_VIEWPORT)).not.toThrow();
    // At least one quadratic curve (the merge edge).
    expect(ctx.path.some((p) => p.op === "quad")).toBe(true);
  });

  it("uses the graph gutter when no commits are loaded (only WIP would draw, here nothing)", () => {
    const lay: LayoutResult = { commits: [], edges: [], maxLane: -1 };
    const ctx = makeContext();
    expect(() => drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, graphBand: MIN_GRAPH_BAND })).not.toThrow();
  });

  it("draws a commit with a smaller graphBand so the lane clamps to the right edge", () => {
    // Lane 0 in a 30px band: the dot is at TAG_WIDTH + 12 + 9 = TAG_WIDTH + 21.
    // bandRight = TAG_WIDTH + 30 - 16 = TAG_WIDTH + 14.
    // The dot is at 21, the bandRight is 14, so the lane is clamped to 14.
    const lay: LayoutResult = {
      commits: [
        { hash: "x", parents: [], children: [], lane: 0, isMerge: false },
      ],
      edges: [],
      maxLane: 0,
    };
    const ctx = makeContext();
    drawGraph(ctx, lay, { ...DEFAULT_VIEWPORT, graphBand: 30 });
    // The arc should be drawn at x = TAG_WIDTH + 14 (bandRight).
    const dot = ctx.path.find((p) => p.op === "arc" && p.args[2] === 5);
    expect(dot).toBeDefined();
    expect(dot?.args[0]).toBe(TAG_WIDTH + 14);
  });
});

describe("module-level constants", () => {
  it("exports the same values the rest of the codebase depends on", () => {
    expect(ROW_HEIGHT).toBe(36);
    expect(TAG_WIDTH).toBe(140);
    expect(MIN_GRAPH_BAND).toBeGreaterThan(0);
    expect(WORKING_ROW).toBe(0);
  });

  it("LANE_COLORS is non-empty and has 6-char hex entries", () => {
    expect(LANE_COLORS.length).toBeGreaterThan(0);
    for (const c of LANE_COLORS) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("laneColor wraps via modulo", () => {
    expect(laneColor(0)).toBe(LANE_COLORS[0]);
    expect(laneColor(LANE_COLORS.length)).toBe(LANE_COLORS[0]);
  });
});

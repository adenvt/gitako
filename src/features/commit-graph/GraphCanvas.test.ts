import { describe, expect, it } from "vitest";
import {
  GRAPH_PAD,
  LANE_PAD,
  LANE_WIDTH,
  MIN_GRAPH_BAND,
  ROW_HEIGHT,
  TAG_WIDTH,
  graphGutter,
} from "./GraphCanvas";

describe("graph layout constants", () => {
  it("keeps the documented numeric values (changes here need a UI review)", () => {
    // Locked because Canvas math + CSS module width calculations both
    // depend on these matching exactly.
    expect(ROW_HEIGHT).toBe(36);
    expect(LANE_WIDTH).toBe(18);
    expect(LANE_PAD).toBe(12);
    expect(TAG_WIDTH).toBe(140);
    expect(GRAPH_PAD).toBe(16);
  });

  it("MIN_GRAPH_BAND matches the documented formula", () => {
    // = LANE_PAD + LANE_WIDTH/2 + GRAPH_PAD — the smallest band that
    // still keeps a half-lane of padding on the right edge.
    expect(MIN_GRAPH_BAND).toBe(LANE_PAD + LANE_WIDTH / 2 + GRAPH_PAD);
    expect(MIN_GRAPH_BAND).toBe(12 + 9 + 16);
  });
});

describe("graphGutter", () => {
  it("returns a one-lane band (LANE_PAD + LANE_WIDTH + GRAPH_PAD) for maxLane 0", () => {
    expect(graphGutter(0)).toBe(LANE_PAD + 1 * LANE_WIDTH + GRAPH_PAD);
    expect(graphGutter(0)).toBe(12 + 18 + 16);
  });

  it("scales linearly with maxLane (one LANE_WIDTH per extra lane)", () => {
    expect(graphGutter(1)).toBe(graphGutter(0) + LANE_WIDTH);
    expect(graphGutter(2)).toBe(graphGutter(0) + 2 * LANE_WIDTH);
    expect(graphGutter(5)).toBe(LANE_PAD + 6 * LANE_WIDTH + GRAPH_PAD);
  });

  it("is always at least MIN_GRAPH_BAND (one lane fits even with no commits)", () => {
    expect(graphGutter(0)).toBeGreaterThanOrEqual(MIN_GRAPH_BAND);
  });
});

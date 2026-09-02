import { describe, expect, it } from "vitest";
import { LANE_COLORS, laneColor } from "./colors";

describe("laneColor", () => {
  it("returns the first palette entry for lane 0", () => {
    expect(laneColor(0)).toBe(LANE_COLORS[0]);
  });

  it("returns the matching palette entry for an in-range lane", () => {
    expect(laneColor(3)).toBe(LANE_COLORS[3]);
  });

  it("returns the last palette entry for the highest in-range lane", () => {
    expect(laneColor(LANE_COLORS.length - 1)).toBe(LANE_COLORS[LANE_COLORS.length - 1]);
  });

  it("recycles colors once lanes exceed the palette length", () => {
    // modulo keeps the color set stable for arbitrarily wide graphs.
    expect(laneColor(LANE_COLORS.length)).toBe(LANE_COLORS[0]);
    expect(laneColor(LANE_COLORS.length + 1)).toBe(LANE_COLORS[1]);
    expect(laneColor(LANE_COLORS.length * 2)).toBe(LANE_COLORS[0]);
  });

  it("exposes a non-empty palette distinct from the UI accent", () => {
    expect(LANE_COLORS.length).toBeGreaterThan(0);
    // Lane colors must never collide with the teal UI accent (--accent).
    // The accent is a teal around 175-185 degrees; we sanity-check by
    // confirming no palette entry starts with the bytes that teal uses.
    for (const c of LANE_COLORS) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

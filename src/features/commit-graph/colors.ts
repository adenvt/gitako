/**
 * Lane color palette. Colors are recycled once lanes exceed the palette.
 * Night-neon theme: electric, saturated hues tuned to pop on the dark
 * background, kept distinct from the teal UI accent (--accent).
 * Opens with the pinkish-purple arc (pinkish purple -> neon purple ->
 * neon blue -> neon green), then fills around the hue wheel.
 */
export const LANE_COLORS = [
  "#ff5ec8", // pinkish purple (~320°)
  "#c64ff0", // neon purple (~280°)
  "#5f8bff", // neon blue (~224°)
  "#4ade80", // neon green (~142°)
  "#2dd4bf", // neon mint (~172°)
  "#22d3ee", // electric cyan (~188°)
  "#ffe14d", // neon yellow (~50°)
  "#ff7a1a", // neon orange (~25°)
  "#ff3d8b", // neon pink (~336°)
  "#ff2e4d", // hot red (~351°)
];

export function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

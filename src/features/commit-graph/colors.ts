/** Lane color palette. Colors are recycled once lanes exceed the palette. */
export const LANE_COLORS = [
  "#e8a33d", // orange
  "#4db6ac", // teal
  "#e57373", // red
  "#64b5f6", // blue
  "#ba68c8", // purple
  "#81c784", // green
  "#f06292", // pink
  "#ffd54f", // yellow
  "#4dd0e1", // cyan
  "#a1887f", // brown
];

export function laneColor(lane: number): string {
  return LANE_COLORS[lane % LANE_COLORS.length];
}

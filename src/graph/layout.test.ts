import { describe, expect, it } from "vitest";
import { layout, type RawCommit } from "./layout";

/** Build a commit list newest-first from (hash, parents) tuples. */
function commits(rows: [string, string[]][]): RawCommit[] {
  return rows.map(([hash, parents]) => ({ hash, parents }));
}

describe("graph layout", () => {
  it("places a linear history in a single lane", () => {
    const result = layout(commits([["c3", ["c2"]], ["c2", ["c1"]], ["c1", []]]));
    expect(result.commits.map((c) => c.lane)).toEqual([0, 0, 0]);
    expect(result.edges).toHaveLength(2);
    // Same-lane edges carry no horizontal connector geometry change.
    expect(result.edges.every((e) => e.parentLane === e.childLane)).toBe(true);
    expect(result.maxLane).toBe(0);
  });

  it("forks a branch into a new lane", () => {
    // main: c3 <- c1 ; feature: c2 <- c1
    const result = layout(
      commits([
        ["c3", ["c1"]],
        ["c2", ["c1"]],
        ["c1", []],
      ]),
    );
    // c3 and c2 are both children of c1 -> c1 gets lane 0, c2 forks to lane 1.
    expect(result.commits[0].lane).toBe(0);
    expect(result.commits[1].lane).toBe(1);
    expect(result.commits[2].lane).toBe(0);
    expect(result.maxLane).toBe(1);
  });

  it("merges a branch back with a fork connector", () => {
    // c4 (merge, parents c3, c2) <- c3 <- c1 ; c2 <- c1
    const result = layout(
      commits([
        ["c4", ["c3", "c2"]],
        ["c3", ["c1"]],
        ["c2", ["c1"]],
        ["c1", []],
      ]),
    );
    expect(result.commits[0].lane).toBe(0); // merge on main lane
    expect(result.commits[1].lane).toBe(0); // first parent continues
    expect(result.commits[2].lane).toBe(1); // second parent fork
    expect(result.commits[3].lane).toBe(0); // c1 merges lanes 0+1 back into 0
    // Edges: c4->c3 (0->0), c4->c2 (0->1), c3->c1 (0->0), c2->c1 (1->0)
    expect(result.edges).toHaveLength(4);
    // The lane-merge connector: child c2 (lane 1) -> parent c1 (lane 0).
    const fork = result.edges.find((e) => e.parentIndex === 3 && e.childIndex === 2);
    expect(fork).toBeDefined();
    expect(fork!.parentLane).toBe(0);
    expect(fork!.childLane).toBe(1);
  });

  it("handles a criss-cross merge (two lanes pointing at the same commit)", () => {
    const result = layout(
      commits([
        ["c5", ["c4", "c3"]],
        ["c4", ["c2"]],
        ["c3", ["c1"]],
        ["c2", ["c1"]],
        ["c1", []],
      ]),
    );
    // c5 claims lane 0. c4 continues lane 0, c3 forks to lane 1, c2 follows
    // c4 in lane 0, c1 is tip of lanes 0 and 1 -> merges into lane 0.
    expect(result.commits[0].lane).toBe(0);
    expect(result.commits[4].lane).toBe(0); // c1 (root) merged into lane 0
    // Lane 1 (c3) should have been merged away at the root.
    expect(result.commits[2].lane).toBe(1); // c3 in its own lane until root
    expect(result.maxLane).toBe(1);
    // The converging connector: child c3 (lane 1) -> parent c1 (lane 0).
    const cross = result.edges.find((e) => e.parentIndex === 4 && e.childIndex === 2);
    expect(cross).toBeDefined();
    expect(cross!.parentLane).toBe(0);
    expect(cross!.childLane).toBe(1);
  });

  it("vacates lanes at root commits", () => {
    const result = layout(
      commits([
        ["c2", ["c1"]],
        ["c1", []],
      ]),
    );
    expect(result.commits[1].lane).toBe(0);
    expect(result.maxLane).toBe(0);
  });

  it("reuses freed lanes", () => {
    // Two independent roots laid out sequentially.
    const result = layout(
      commits([
        ["a1", ["a0"]],
        ["a0", []],
        ["b1", ["b0"]],
        ["b0", []],
      ]),
    );
    // b1 should reuse lane 0 after a0 closed it.
    expect(result.commits[2].lane).toBe(0);
    expect(result.maxLane).toBe(0);
  });

  it("handles empty input", () => {
    const result = layout([]);
    expect(result.commits).toHaveLength(0);
    expect(result.edges).toHaveLength(0);
    expect(result.maxLane).toBe(0);
  });
});

/**
 * Graph layout: assigns each commit a lane index and produces the edges
 * needed to draw connecting lines between commits.
 *
 * This is a pure function operating on the raw topology returned by the
 * backend (`git log --all --topo-order --parents`), which guarantees that
 * every parent appears AFTER its child in the array (newest first).
 *
 * ## Algorithm (walked newest -> oldest, i.e. top of the graph -> bottom)
 *
 * - `lanes: (hash | null)[]` holds the tip commit currently occupying each
 *   lane. A lane with `null` is free.
 * - For each commit:
 *   1. **Claim a lane**: if the commit is the tip of one or more existing
 *      lanes, those lanes merge into the lowest-index one (criss-cross
 *      merges). Otherwise allocate a free lane.
 *   2. Record `commit.lane = claimedIndex`.
 *   3. **Fork parents**: the FIRST parent continues the claimed lane. Every
 *      additional parent takes a newly allocated lane. This produces the
 *      GitKraken-style fork on merge commits.
 *   4. A commit with no parents vacates its lane (`null`).
 *
 * ## Rendering model
 *
 * - **Lane lines** are drawn from lane-occupancy state: lane `L` has a line
 *   from its first occupied row to the row where it becomes null (inclusive),
 *   so merged/freed lanes visually reach their merge point.
 * - **Edges** carry horizontal connectors at the CHILD's row, from the child's
 *   lane to the parent's lane. Same-lane edges need no connector.
 * - No edge re-pointing is needed on lane merge: geometry stays valid because
 *   both lanes have lines that converge at the merge row.
 */

export interface RawCommit {
  hash: string;
  parents: string[];
}

export interface LayoutCommit extends RawCommit {
  /** Indices of commits (in the input array) that have this commit as a parent. */
  children: number[];
  lane: number;
  /** True when the commit has >= 2 parents. */
  isMerge: boolean;
}

export interface LaneEdge {
  /** Lane the parent commit is in. */
  parentLane: number;
  /** Lane the child commit is in. */
  childLane: number;
  /** Index of the parent commit (lower on screen). */
  parentIndex: number;
  /** Index of the child commit (higher on screen). */
  childIndex: number;
}

export interface LayoutResult {
  commits: LayoutCommit[];
  edges: LaneEdge[];
  /** Highest lane index ever allocated (for horizontal canvas sizing). */
  maxLane: number;
}

export function layout(commits: RawCommit[]): LayoutResult {
  const lanes: (string | null)[] = [];
  let maxAllocated = -1;

  const layoutCommits: LayoutCommit[] = commits.map((c) => ({
    ...c,
    children: [] as number[],
    lane: -1,
    isMerge: c.parents.length >= 2,
  }));

  const childOf = new Map<string, number[]>();
  for (let i = 0; i < layoutCommits.length; i++) {
    for (const p of layoutCommits[i].parents) {
      const list = childOf.get(p) ?? [];
      list.push(i);
      childOf.set(p, list);
    }
  }

  const allocLane = (): number => {
    const free = lanes.indexOf(null);
    if (free !== -1) return free;
    lanes.push(null);
    maxAllocated = Math.max(maxAllocated, lanes.length - 1);
    return lanes.length - 1;
  };

  const freeLane = (idx: number) => {
    lanes[idx] = null;
  };

  const edges: LaneEdge[] = [];

  for (let i = 0; i < layoutCommits.length; i++) {
    const commit = layoutCommits[i];

    // ---- 1. Claim a lane ----
    const occupied = lanes
      .map((tip, idx) => (tip === commit.hash ? idx : -1))
      .filter((idx) => idx !== -1);

    let lane: number;
    if (occupied.length > 0) {
      // Merge all occupied lanes into the first one.
      lane = occupied[0];
      for (const other of occupied.slice(1)) {
        freeLane(other);
      }
    } else {
      lane = allocLane();
    }
    commit.lane = lane;

    // ---- 2. Record edges to children (children were laid out above us) ----
    const children = childOf.get(commit.hash) ?? [];
    layoutCommits[i].children = children;
    for (const childIdx of children) {
      edges.push({
        parentLane: lane,
        childLane: layoutCommits[childIdx].lane,
        parentIndex: i,
        childIndex: childIdx,
      });
    }

    // ---- 3. Fork parents ----
    if (commit.parents.length === 0) {
      freeLane(lane);
    } else {
      lanes[lane] = commit.parents[0];
      for (const parent of commit.parents.slice(1)) {
        const pLane = allocLane();
        lanes[pLane] = parent;
      }
    }
  }

  let maxLane = maxAllocated;
  for (const e of edges) {
    maxLane = Math.max(maxLane, e.parentLane, e.childLane);
  }

  return { commits: layoutCommits, edges, maxLane: Math.max(0, maxLane) };
}

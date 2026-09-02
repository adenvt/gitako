import { describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { DiffView } from "./DiffView";
import { useRepoStore } from "@/state/store";
import type { DiffFile } from "@/shared/types/git";

vi.mock("@/state/git", () => ({
  fetchLog: vi.fn(),
  fetchRefs: vi.fn(),
  fetchStatus: vi.fn(),
  fetchShowFiles: vi.fn(),
  fetchDiff: vi.fn(),
  stageFiles: vi.fn(),
  commitChanges: vi.fn(),
  fetchHeadBranch: vi.fn().mockResolvedValue("main"),
}));

function makeDiff(overrides: Partial<DiffFile> = {}): DiffFile {
  return {
    oldPath: "a.ts",
    newPath: "a.ts",
    status: "M",
    binary: false,
    tooLarge: false,
    oldLines: ["line1", "line2"],
    newLines: ["line1", "line2 edited"],
    hunks: [
      {
        oldStart: 1,
        newStart: 1,
        oldLines: 2,
        newLines: 2,
        lines: [
          { kind: "context", text: "line1" },
          { kind: "remove", text: "line2" },
          { kind: "add", text: "line2 edited" },
        ],
      },
    ],
    ...overrides,
  };
}

/** Set scroll geometry on BOTH panes' viewports so the strips show. */
function makeScrollable(container: HTMLElement, scrollHeight = 400, clientHeight = 100) {
  const viewports = container.querySelectorAll("[class*='diffTableViewport']");
  expect(viewports.length).toBe(2);
  viewports.forEach((vp) => {
    Object.defineProperties(vp, {
      scrollHeight: { value: scrollHeight, configurable: true },
      clientHeight: { value: clientHeight, configurable: true },
    });
    // The minimap reads metrics from the DOM; nudge it to re-read so the
    // strips appear after the geometry stub lands.
    act(() => {
      vp.dispatchEvent(new Event("scroll"));
    });
  });
}

describe("DiffMinimap", () => {
  it("renders one bar per aligned row on both panes with the right kinds", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": makeDiff() },
    });
    const { container } = render(<DiffView />);
    makeScrollable(container);
    const strips = container.querySelectorAll(
      "[class*='diffMinimap']:not([class*='diffMinimapBar'])",
    );
    // One minimap per pane.
    expect(strips.length).toBe(2);
    const bars = container.querySelectorAll("[class*='diffMinimapBar']");
    // makeDiff: context "line1" + paired edit (remove "line2" / add "line2
    // edited" collapse into one row) → 2 bars × 2 panes.
    expect(bars.length).toBe(4);
    const kinds = Array.from(bars).map((b) => b.getAttribute("data-kind"));
    // Each pane colors its own side: OLD shows the removal (red), NEW shows
    // the addition (green); context stays "context".
    expect(kinds).toEqual(["context", "remove", "context", "add"]);
  });

  it("leaves a gap on the side that has no counterpart row", () => {
    const diff = makeDiff({
      oldLines: ["line1"],
      newLines: ["line1", "brand new"],
      hunks: [
        {
          oldStart: 1,
          newStart: 1,
          oldLines: 1,
          newLines: 2,
          lines: [
            { kind: "context", text: "line1" },
            { kind: "add", text: "brand new" },
          ],
        },
      ],
    });
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": diff },
    });
    const { container } = render(<DiffView />);
    makeScrollable(container);
    const bars = container.querySelectorAll("[class*='diffMinimapBar']");
    const kinds = Array.from(bars).map((b) => b.getAttribute("data-kind"));
    // old pane: context, context (gap for the added row) — new pane: context, add.
    expect(kinds).toEqual(["context", "context", "context", "add"]);
  });

  it("hides the minimap when the content does not overflow", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": makeDiff() },
    });
    const { container } = render(<DiffView />);
    // makeDiff has 2 rows × 19.5px = 39px content + 16px padding = 55px,
    // but happy-dom reports scrollHeight 0 → no overflow → no markers.
    expect(container.querySelector("[class*='diffMinimap']")).toBeNull();
  });
});

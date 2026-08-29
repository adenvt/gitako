import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("DiffView", () => {
  it("renders nothing when there is no active diff", () => {
    useRepoStore.setState({ activeDiff: null, diffCache: {} });
    const { container } = render(<DiffView />);
    expect(container.firstChild).toBeNull();
  });

  it("shows a loading placeholder while the diff is being fetched", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: {}, // not yet cached
    });
    render(<DiffView />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("shows a binary-file placeholder when the diff is binary", () => {
    const binary = makeDiff({ binary: true, oldLines: [], newLines: [], hunks: [] });
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "img.png", staged: false },
      diffCache: { "c1|img.png|w": binary },
    });
    render(<DiffView />);
    expect(screen.getByText(/binary file/i)).toBeInTheDocument();
  });

  it("shows a too-large placeholder for oversized diffs", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "big.ts", staged: false },
      diffCache: {
        "c1|big.ts|w": makeDiff({ tooLarge: true, oldLines: [], newLines: [], hunks: [] }),
      },
    });
    render(<DiffView />);
    expect(screen.getByText(/too large/i)).toBeInTheDocument();
  });

  it("shows the .error message when the diff fetch failed", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "x.ts", staged: false },
      diffCache: {
        "c1|x.ts|w": { ...makeDiff({ oldLines: [], newLines: [], hunks: [] }), error: "boom" },
      },
    });
    render(<DiffView />);
    expect(screen.getByText(/failed to load diff: boom/i)).toBeInTheDocument();
  });

  it("renders the file path in the top bar and a Close button that calls closeDiff", async () => {
    const closeDiff = vi.fn();
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "src/index.ts", staged: false },
      diffCache: { "c1|src/index.ts|w": makeDiff() },
      closeDiff,
    });
    const user = userEvent.setup();
    render(<DiffView />);
    expect(screen.getByText("src/index.ts")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /close diff/i }));
    expect(closeDiff).toHaveBeenCalled();
  });

  it("renders the OLD/NEW column headers when showing rows", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": makeDiff() },
    });
    render(<DiffView />);
    expect(screen.getByText("OLD")).toBeInTheDocument();
    expect(screen.getByText("NEW")).toBeInTheDocument();
  });

  it("drives column scrollLeft from the bottom bar's scroll position (syncScroll)", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": makeDiff() },
    });
    const { container } = render(<DiffView />);
    // The bottom scrollbar is the single source of truth for horizontal scroll.
    const bar = container.querySelector("[class*='diffScrollbar']") as HTMLElement | null;
    expect(bar).not.toBeNull();
    // Monkey-patch layout sizes for the bar and the two columns. React's
    // onScroll handler reads these to compute the column scrollLeft.
    Object.defineProperty(bar!, "scrollWidth", { configurable: true, value: 500 });
    Object.defineProperty(bar!, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(bar!, "scrollLeft", { configurable: true, value: 200, writable: true });
    // Use a CSS-modules-aware selector: match the column class but not
    // the headers container. The compiled class is something like
    // "_diffCol_xxx", so we exclude the "diffCol" / "diffCols" /
    // "diffColHeader" / "diffColHeaders" prefixes that aren't a column.
    const cols = container.querySelectorAll("[class*='_diffCol_']:not([class*='Header'])");
    expect(cols.length).toBe(2);
    for (const col of Array.from(cols)) {
      Object.defineProperty(col, "scrollWidth", { configurable: true, value: 400 });
      Object.defineProperty(col, "clientWidth", { configurable: true, value: 100 });
    }
    // Fire a native scroll event on the bar; React's onScroll will read the
    // new scrollLeft and drive the columns' scrollLeft via syncScroll.
    bar!.dispatchEvent(new Event("scroll", { bubbles: true }));

    // frac = 200 / (500-100) = 0.5; column range = 400-100 = 300; new = 150.
    expect((cols[0] as HTMLElement).scrollLeft).toBe(150);
  });

  it("syncScroll is a no-op when the bar's scroll range is zero (no overflow)", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": makeDiff() },
    });
    const { container } = render(<DiffView />);
    const bar = container.querySelector("[class*='diffScrollbar']") as HTMLElement;
    // bar range = 0 (scrollWidth == clientWidth) -> frac defaults to 0.
    Object.defineProperty(bar, "scrollWidth", { configurable: true, value: 100 });
    Object.defineProperty(bar, "clientWidth", { configurable: true, value: 100 });
    Object.defineProperty(bar, "scrollLeft", { configurable: true, value: 50, writable: true });
    const cols = container.querySelectorAll("[class*='diffCol']");
    for (const col of Array.from(cols)) {
      Object.defineProperty(col, "scrollWidth", { configurable: true, value: 400 });
      Object.defineProperty(col, "clientWidth", { configurable: true, value: 100 });
    }
    bar.dispatchEvent(new Event("scroll", { bubbles: true }));
    // No overflow on the bar -> frac = 0 -> column scrollLeft stays 0.
    expect((cols[0] as HTMLElement).scrollLeft).toBe(0);
  });
});

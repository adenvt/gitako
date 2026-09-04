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

  it("renders both diff columns inside a single scroll viewport (BaseUI ScrollArea)", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": makeDiff() },
    });
    const { container } = render(<DiffView />);
    // The two columns live inside the same Content/Viewport, so a single
    // scroll event drives both — no separate bottom bar, no syncScroll needed.
    const viewport = container.querySelector("[class*='diffTableViewport']");
    expect(viewport).not.toBeNull();
    const cols = container.querySelectorAll("[class*='_diffCol_']:not([class*='Header'])");
    expect(cols.length).toBe(2);
  });

  it("does not render the old bottom diffScrollbar element", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": makeDiff() },
    });
    const { container } = render(<DiffView />);
    // The standalone bottom scrollbar was replaced by BaseUI's Scrollbar.
    expect(container.querySelector("[class*='diffScrollbar']")).toBeNull();
  });

  it("highlights the changed words on a paired edit row", () => {
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "a.ts", staged: false },
      diffCache: { "c1|a.ts|w": makeDiff() },
    });
    const { container } = render(<DiffView />);
    // makeDiff pairs "-line2" / "+line2 edited" → word diff marks " edited".
    const words = container.querySelectorAll("[class*='diffWord']");
    expect(words.length).toBeGreaterThan(0);
    // The changed word renders on both columns (removed + added side).
    const changed = screen.getAllByText(" edited", { exact: true, normalizer: (t) => t });
    expect(changed.length).toBe(2);
  });

  it("marks a standalone insertion with a left-edge bar, not word emphasis", () => {
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
    // Standalone added line: the whole line carries the add emphasis.
    expect(container.querySelector("[class*='diffWord']")).toBeNull();
    // ...and the row gets the full-change left-edge marker instead.
    const rows = container.querySelectorAll("[class*='diffLine']");
    const marked = Array.from(rows).filter((el) => el.className.includes("diffFull"));
    expect(marked.length).toBe(1);
  });

  it("windows rows: a 500-line diff does not mount all 500 row elements", () => {
    // Build a 500-line diff with one hunk covering the whole file. Each line
    // is unchanged so the minimap + virtualizer paths are simple.
    const lineCount = 500;
    const lines = Array.from({ length: lineCount }, (_, i) => `line ${i + 1}`);
    const diff = makeDiff({
      oldLines: lines,
      newLines: lines,
      hunks: [
        {
          oldStart: 1,
          newStart: 1,
          oldLines: lineCount,
          newLines: lineCount,
          lines: lines.map((t) => ({ kind: "context" as const, text: t })),
        },
      ],
    });
    useRepoStore.setState({
      activeDiff: { hash: "c1", path: "big.ts", staged: false },
      diffCache: { "c1|big.ts|w": diff },
    });
    const { container } = render(<DiffView />);
    // happy-dom gives the viewport a 0×0 client size, so the windowed
    // range collapses to start=0, end=0. We assert the upper bound only
    // (no row is mounted at all) — the real win shows up in a real
    // browser where the window is e.g. 40 rows tall.
    const rows = container.querySelectorAll("[class*='diffLine']");
    expect(rows.length).toBeLessThan(lineCount);
  });
});

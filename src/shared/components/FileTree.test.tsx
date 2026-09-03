import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileTree } from "./FileTree";
import { buildFileTree, type FileTreeNode } from "@/shared/utils/fileTree";

function tree(...paths: Array<[string, string]>): FileTreeNode {
  return buildFileTree(paths.map(([path, status]) => ({ path, status })));
}

/** Shorthand: tree with all files having status "M". */
function flat(...paths: string[]): FileTreeNode {
  return buildFileTree(paths.map((path) => ({ path, status: "M" })));
}

describe("FileTree", () => {
  it("renders a flat list of files (no toolbar when no directories)", () => {
    render(<FileTree root={flat("a.ts", "b.ts")} />);
    expect(screen.getByText("a.ts")).toBeInTheDocument();
    expect(screen.getByText("b.ts")).toBeInTheDocument();
    // No "Expand all" / "Collapse all" button when there are no dirs.
    expect(screen.queryByText(/expand all/i)).toBeNull();
    expect(screen.queryByText(/collapse all/i)).toBeNull();
  });

  it("starts with top-level directories expanded and shows their files", () => {
    render(<FileTree root={tree(["src/a.ts", "M"], ["src/b.ts", "M"])} />);
    expect(screen.getByText("src")).toBeInTheDocument();
    expect(screen.getByText("a.ts")).toBeVisible();
    expect(screen.getByText("b.ts")).toBeVisible();
  });

  it("toggles a directory when its row is clicked", async () => {
    const user = userEvent.setup();
    render(<FileTree root={tree(["src/a.ts", "M"])} />);
    // Initially expanded -> "a.ts" is visible.
    expect(screen.getByText("a.ts")).toBeVisible();
    // Click the directory header to collapse.
    await user.click(screen.getByRole("button", { name: /src/ }));
    // The file row is now hidden under the collapsed directory.
    expect(screen.queryByText("a.ts")).toBeNull();
  });

  it("shows the Expand all button and reveals deep files when clicked", async () => {
    const user = userEvent.setup();
    // `src` has two children (`lib` dir + `c.ts` file), so the singleton
    // chain stops at `src` and `a.ts` stays hidden until expanded.
    render(<FileTree root={tree(["src/lib/a.ts", "M"], ["src/c.ts", "M"])} />);
    expect(screen.queryByText("a.ts")).toBeNull();
    // Click "Expand all".
    await user.click(screen.getByRole("button", { name: /expand all/i }));
    expect(screen.getByText("a.ts")).toBeVisible();
  });

  it("swaps to a Collapse all button once everything is expanded, and collapses on click", async () => {
    const user = userEvent.setup();
    render(<FileTree root={tree(["src/a.ts", "M"])} />);
    // Already expanded -> show "Collapse all".
    const collapse = screen.getByRole("button", { name: /collapse all/i });
    await user.click(collapse);
    expect(screen.queryByText("a.ts")).toBeNull();
    // Now a deeper expand is needed -> button is back to "Expand all".
    expect(screen.getByRole("button", { name: /expand all/i })).toBeInTheDocument();
  });

  it("calls onFileAction with the clicked file node when the action label is shown", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(<FileTree root={flat("a.ts")} onFileAction={onAction} actionLabel="Stage" />);
    await user.click(screen.getByRole("button", { name: "Stage" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    const arg = onAction.mock.calls[0]?.[0];
    expect(arg.path).toBe("a.ts");
    expect(arg.isFile).toBe(true);
  });

  it("calls onFileOpen when a file is clicked and the click handler is provided", async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<FileTree root={flat("a.ts")} onFileOpen={onOpen} />);
    await user.click(screen.getByText("a.ts"));
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0]?.[0]?.path).toBe("a.ts");
  });

  it("does not call onFileOpen when the prop is not provided (file rows are not clickable)", async () => {
    const user = userEvent.setup();
    render(<FileTree root={flat("a.ts")} />);
    // Clicking the file name should not throw even without onFileOpen.
    await user.click(screen.getByText("a.ts"));
    // Sanity: no error.
  });

  it("stops the file click from triggering a parent action when the action button is clicked", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    const onOpen = vi.fn();
    render(
      <FileTree
        root={flat("a.ts")}
        onFileAction={onAction}
        actionLabel="Stage"
        onFileOpen={onOpen}
      />,
    );
    // The action button should NOT also trigger onFileOpen (e.stopPropagation).
    await user.click(screen.getByRole("button", { name: "Stage" }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("applies the file status to the file row's title attribute (for hover tooltip)", () => {
    const { container } = render(<FileTree root={tree(["a.ts", "M"])} />);
    // The file row is a div with title="<status label>: <path>".
    const titleEl = container.querySelector('[title^="Modified: a.ts"]');
    expect(titleEl).not.toBeNull();
  });

  it("renders a deeply nested file under its parents (collapsed by default)", () => {
    // `a` has 2 children (`b`, `d.ts`), so the chain stops at `a`.
    render(<FileTree root={tree(["a/b/c/file.ts", "M"], ["a/d.ts", "M"])} />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.queryByText("file.ts")).toBeNull();
  });

  it("auto-expands a singleton directory chain on initial render", () => {
    // a -> b -> c -> file.ts: every level has a single directory child,
    // so the whole chain should auto-open.
    render(<FileTree root={tree(["a/b/c/file.ts", "M"])} />);
    expect(screen.getByText("file.ts")).toBeVisible();
  });

  it("stops auto-expanding the chain when a directory has multiple children", () => {
    // a -> b -> [c, other.ts]: b has 2 children, so the singleton chain
    // stops at b. `b` itself is on a singleton chain from `a`, so it
    // auto-opens — revealing `other.ts` directly. `c` is NOT auto-opened.
    render(
      <FileTree root={tree(["a/b/c/file.ts", "M"], ["a/b/other.ts", "M"])} />,
    );
    expect(screen.getByText("a")).toBeInTheDocument();
    // `b` is on a singleton chain from `a`, so it auto-opens.
    expect(screen.getByText("b")).toBeInTheDocument();
    // `other.ts` is a direct child of `b` (a file), so it's visible.
    expect(screen.getByText("other.ts")).toBeVisible();
    // `c` is a directory child of `b` — since `b` has 2 children, the
    // chain stops and `c` is NOT auto-opened, so `file.ts` stays hidden.
    expect(screen.queryByText("file.ts")).toBeNull();
  });

  it("cascades open through a singleton chain when a user clicks to expand a parent", async () => {
    const user = userEvent.setup();
    // Start with siblings at top so `a` doesn't auto-open via singleton chain.
    render(
      <FileTree root={tree(["a/b/c/d/file.ts", "M"], ["other.ts", "M"])} />,
    );
    // `a` is top-level so it's expanded by default, but its singleton chain
    // (b -> c -> d) should also have auto-opened.
    expect(screen.getByText("file.ts")).toBeVisible();

    // Collapse everything: toggle `a` closed, then re-open and verify cascade.
    await user.click(screen.getByRole("button", { name: /^a$/ }));
    expect(screen.queryByText("file.ts")).toBeNull();

    await user.click(screen.getByRole("button", { name: /^a$/ }));
    // Re-opening `a` should cascade through b, c, d -> file.ts is visible.
    expect(screen.getByText("file.ts")).toBeVisible();
  });

  it("hides the toolbar (no Expand/Collapse all) when the tree has no directories at all", () => {
    // The condition `dirPaths.length > 0` guards the toolbar.
    render(<FileTree root={flat("a.ts")} />);
    expect(screen.queryByRole("button", { name: /expand all/i })).toBeNull();
  });

  it("displays 'Expand all' when at least one top-level dir is collapsed", () => {
    // `src` has two children (`lib` dir + `c.ts` file), so `lib` stays
    // collapsed and 'a.ts' is hidden initially.
    render(<FileTree root={tree(["src/lib/a.ts", "M"], ["src/c.ts", "M"])} />);
    expect(screen.queryByText("a.ts")).toBeNull();
    // The toolbar still shows the 'Expand all' button (some dir is collapsed).
    expect(screen.getByRole("button", { name: /expand all/i })).toBeInTheDocument();
  });
});

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
    render(<FileTree root={tree(["src/lib/a.ts", "M"])} />);
    // `src/lib` is a deeper dir, so it starts collapsed.
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
    render(<FileTree root={tree(["a/b/c/file.ts", "M"])} />);
    // Top-level `a` is expanded by default; the file is hidden until expanded.
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.queryByText("file.ts")).toBeNull();
  });

  it("hides the toolbar (no Expand/Collapse all) when the tree has no directories at all", () => {
    // The condition `dirPaths.length > 0` guards the toolbar.
    render(<FileTree root={flat("a.ts")} />);
    expect(screen.queryByRole("button", { name: /expand all/i })).toBeNull();
  });

  it("displays 'Expand all' when at least one top-level dir is collapsed", () => {
    // src starts expanded; lib (deeper) starts collapsed -> not all expanded.
    render(<FileTree root={tree(["src/lib/a.ts", "M"])} />);
    // 'a.ts' is not yet visible because lib is collapsed.
    expect(screen.queryByText("a.ts")).toBeNull();
    // The toolbar still shows the 'Expand all' button (some dir is collapsed).
    expect(screen.getByRole("button", { name: /expand all/i })).toBeInTheDocument();
  });
});

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  ChevronRightIcon,
  FileDirectoryIcon,
  FileDirectoryOpenFillIcon,
  ListOrderedIcon,
  ListUnorderedIcon,
} from "@primer/octicons-react";
import { collectDirPaths, type FileTreeNode } from "@/shared/utils/fileTree";
import { statusLabel } from "@/shared/utils/status";
import { StatusIcon } from "@/shared/components/StatusIcon";
import { Button, ScrollArea } from "@/shared/components/ui";
import s from "./fileTree.module.css";

interface FileTreeProps {
  root: FileTreeNode;
  /** Optional per-file action (e.g. Stage/Unstage) revealed on hover. */
  onFileAction?: (node: FileTreeNode) => void;
  /** Label for the hover action button. */
  actionLabel?: string;
  /** Color the action button to signal its effect: stage = green, unstage = yellow. */
  actionVariant?: "stage" | "unstage";
  /** Optional click-to-open (e.g. open the diff for a file). */
  onFileOpen?: (node: FileTreeNode) => void;
}

/** Parent path of a tree node path; "" means the implicit root (no row). */
function parentPathOf(path: string): string | null {
  const i = path.lastIndexOf("/");
  if (i < 0) return null;
  return path.slice(0, i) || null;
}

/** Visible nodes in display order (pre-order, skipping collapsed subtrees). */
export function flattenVisible(root: FileTreeNode, expanded: Set<string>): FileTreeNode[] {
  const out: FileTreeNode[] = [];
  const walk = (children: FileTreeNode[]) => {
    for (const c of children) {
      out.push(c);
      if (!c.isFile && expanded.has(c.path)) walk(c.children);
    }
  };
  walk(root.children);
  return out;
}

interface TreeRowProps {
  node: FileTreeNode;
  depth: number;
  open: boolean;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  onFileAction?: (node: FileTreeNode) => void;
  actionLabel?: string;
  actionVariant?: "stage" | "unstage";
  onFileOpen?: (node: FileTreeNode) => void;
  /** Roving tabindex: only the focused row is in the tab order. */
  focusedPath: string | null;
  visibleIndex: Map<string, number>;
  onFocusRow: (path: string) => void;
}

function tabIndexForPath(focusedPath: string | null, visibleIndex: Map<string, number>, path: string): number {
  const idx = visibleIndex.get(path);
  if (focusedPath) return focusedPath === path ? 0 : -1;
  return idx === 0 ? 0 : -1;
}

function TreeRow({
  node,
  depth,
  open,
  expanded,
  onToggle,
  onFileAction,
  actionLabel,
  actionVariant,
  onFileOpen,
  focusedPath,
  visibleIndex,
  onFocusRow,
}: TreeRowProps) {
  const tabIndex = tabIndexForPath(focusedPath, visibleIndex, node.path);
  const focused = focusedPath === node.path;
  if (!node.isFile) {
    return (
      <>
        <Button
          variant="none"
          className={clsx(s.treeRow, s.treeDir)}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => onToggle(node.path)}
          aria-expanded={open}
          tabIndex={tabIndex}
          data-tree-row
          data-path={node.path}
          onFocus={() => onFocusRow(node.path)}
        >
          <ChevronRightIcon
            size={14}
            className={clsx(s.treeArrow, open && s.treeArrowOpen)}
            aria-hidden
          />
          {open ? (
            <FileDirectoryOpenFillIcon size={14} className={s.treeFolderIcon} aria-hidden />
          ) : (
            <FileDirectoryIcon size={14} className={s.treeFolderIcon} aria-hidden />
          )}
          <span className={s.treeName}>{node.name || "/"}</span>
        </Button>
        {open && (
          <div className={s.treeChildren} role="group">
            {node.children.map((c) => (
              <TreeRow
                key={c.path}
                node={c}
                depth={depth + 1}
                open={expanded.has(c.path)}
                expanded={expanded}
                onToggle={onToggle}
                onFileAction={onFileAction}
                actionLabel={actionLabel}
                actionVariant={actionVariant}
                onFileOpen={onFileOpen}
                focusedPath={focusedPath}
                visibleIndex={visibleIndex}
                onFocusRow={onFocusRow}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className={clsx(s.treeRow, s.treeFile, onFileOpen && s.clickable)}
      style={{ paddingLeft: 6 + depth * 14 }}
      title={`${statusLabel(node.status)}: ${node.path}`}
      onClick={
        onFileOpen
          ? () => {
              onFocusRow(node.path);
              onFileOpen(node);
            }
          : () => onFocusRow(node.path)
      }
      role="treeitem"
      aria-level={depth + 1}
      aria-selected={focused}
      tabIndex={tabIndex}
      data-tree-row
      data-path={node.path}
      onFocus={() => onFocusRow(node.path)}
    >
      <span className={s.treeSpacer} aria-hidden />
      <StatusIcon status={node.status} />
      <span className={`${s.treeName} mono`}>{node.name}</span>
      {onFileAction && actionLabel && (
        <Button
          variant="none"
          className={clsx(s.treeFileAction, actionVariant === "unstage" && s.treeFileActionUnstage)}
          data-file-action
          onClick={(e) => {
            e.stopPropagation();
            onFileAction(node);
          }}
        >
          {actionLabel}
        </Button>
      )}
    </div>
  );
}

export function FileTree({
  root,
  onFileAction,
  actionLabel,
  actionVariant,
  onFileOpen,
}: FileTreeProps) {
  const dirPaths = useMemo(() => collectDirPaths(root), [root]);

  // Top-level directories start expanded; deeper ones collapsed.
  // Also auto-expand any directory on a "singleton chain" — a directory whose
  // only child is another single-child directory — so the user doesn't have to
  // click through a nesting like src/components/foo/bar/baz.tsx.
  const initialExpanded = useMemo(() => {
    const set = new Set<string>();
    for (const child of root.children) {
      if (!child.isFile) set.add(child.path);
    }
    const walk = (n: FileTreeNode) => {
      if (n.isFile || n.children.length !== 1) return;
      const only = n.children[0];
      if (only.isFile) return;
      set.add(only.path);
      walk(only);
    };
    for (const child of root.children) {
      if (!child.isFile) walk(child);
    }
    return set;
  }, [root]);
  const [expanded, setExpanded] = useState<Set<string>>(() => initialExpanded);

  // Walk down a singleton chain from `path`: a directory whose only child is
  // another single-child directory. Used to auto-open the chain when the user
  // expands a folder, so they don't have to click through every nested
  // single-folder level.
  const findNode = useCallback(
    (path: string): FileTreeNode | null => {
      const walk = (n: FileTreeNode): FileTreeNode | null => {
        if (n.path === path) return n;
        for (const c of n.children) {
          const found = walk(c);
          if (found) return found;
        }
        return null;
      };
      return walk(root);
    },
    [root],
  );

  const toggle = useCallback(
    (path: string) =>
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(path)) {
          next.delete(path);
          return next;
        }
        next.add(path);
        // Cascade open through any nested single-folder chain beneath `path`.
        const node = findNode(path);
        if (node && !node.isFile) {
          const walk = (n: FileTreeNode) => {
            if (n.isFile || n.children.length !== 1) return;
            const only = n.children[0];
            if (only.isFile) return;
            next.add(only.path);
            walk(only);
          };
          walk(node);
        }
        return next;
      }),
    [findNode],
  );

  const expandAll = () => setExpanded(new Set(dirPaths));
  const collapseAll = () => setExpanded(new Set());

  const allExpanded = dirPaths.length > 0 && dirPaths.every((p) => expanded.has(p));

  // --- Keyboard navigation (roving tabindex + arrow keys) ---
  const visible = useMemo(() => flattenVisible(root, expanded), [root, expanded]);
  const [focusedPath, setFocusedPath] = useState<string | null>(null);
  // Scope DOM focus lookups to this tree (multiple FileTrees can be mounted
  // at once — e.g. composer + detail — and paths may collide).
  const treeRef = useRef<HTMLDivElement>(null);

  const focusPath = useCallback((path: string) => {
    setFocusedPath(path);
  }, []);

  const focusRowEl = useCallback((path: string) => {
    const el = treeRef.current?.querySelector<HTMLElement>(`[data-path="${path}"]`);
    if (el && document.activeElement !== el) el.focus({ preventScroll: true });
  }, []);

  // Move DOM focus when the focused row changes via keyboard.
  useEffect(() => {
    if (!focusedPath) return;
    focusRowEl(focusedPath);
  }, [focusedPath, visible, focusRowEl]);

  // If the focused row becomes hidden (e.g. Collapse all), move focus to
  // the nearest visible ancestor, else the first visible row.
  useEffect(() => {
    if (!focusedPath) return;
    if (visible.some((n) => n.path === focusedPath)) return;
    let p = parentPathOf(focusedPath);
    while (p) {
      if (visible.some((n) => n.path === p)) {
        setFocusedPath(p);
        return;
      }
      p = parentPathOf(p);
    }
    setFocusedPath(visible[0]?.path ?? null);
  }, [visible, focusedPath]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLElement;
    // Let the per-file action button keep its native Enter/Space behavior.
    if (target.closest("[data-file-action]")) return;
    const rowEl = target.closest("[data-tree-row]");
    if (!rowEl) return;
    const path = rowEl.getAttribute("data-path");
    if (!path) return;
    const node = findNode(path);
    if (!node) return;
    const idx = visible.findIndex((n) => n.path === path);

    const move = (to: number) => {
      const next = visible[to];
      if (next) {
        e.preventDefault();
        setFocusedPath(next.path);
      }
    };

    switch (e.key) {
      case "ArrowDown":
        move(idx + 1);
        return;
      case "ArrowUp":
        if (idx <= 0) {
          e.preventDefault();
          return;
        }
        move(idx - 1);
        return;
      case "Home":
        move(0);
        return;
      case "End":
        move(visible.length - 1);
        return;
      case "ArrowRight":
        if (node.isFile) return;
        e.preventDefault();
        if (!expanded.has(path)) {
          toggle(path);
        } else {
          // Already open: move into the first child.
          move(idx + 1);
        }
        return;
      case "ArrowLeft":
        e.preventDefault();
        if (!node.isFile && expanded.has(path)) {
          toggle(path);
        } else {
          const parent = parentPathOf(path);
          if (parent) setFocusedPath(parent);
        }
        return;
      case "Enter":
      case " ":
        // Directory rows are native <button>s — Enter/Space already fires
        // onClick, so handling it here too would toggle twice. Only files
        // (plain divs) need manual activation.
        if (node.isFile) {
          e.preventDefault();
          if (onFileOpen) onFileOpen(node);
        }
        return;
      default:
        return;
    }
  };

  // Roving tabindex: the focused row (or the first row before any focus)
  // is the only tab stop.
  const visibleIndex = useMemo(() => {
    const m = new Map<string, number>();
    visible.forEach((n, i) => m.set(n.path, i));
    return m;
  }, [visible]);

  return (
    <div className={s.fileTree} ref={treeRef}>
      {dirPaths.length > 0 && (
        <div className={s.fileTreeToolbar}>
          {allExpanded ? (
            <Button variant="none" className={s.treeToolbarBtn} onClick={collapseAll}>
              <ListUnorderedIcon size={13} aria-hidden />
              Collapse all
            </Button>
          ) : (
            <Button variant="none" className={s.treeToolbarBtn} onClick={expandAll}>
              <ListOrderedIcon size={13} aria-hidden />
              Expand all
            </Button>
          )}
        </div>
      )}
      <ScrollArea.Root className={s.fileTreeRows}>
        <ScrollArea.Viewport className={s.fileTreeRowsViewport}>
          <ScrollArea.Content
            className={s.fileTreeRowsContent}
            role="tree"
            aria-label="Files"
            onKeyDown={handleKeyDown}
          >
            {root.children.map((c) => (
              <TreeRow
                key={c.path}
                node={c}
                depth={0}
                open={expanded.has(c.path)}
                expanded={expanded}
                onToggle={(p) => {
                  setFocusedPath(p);
                  toggle(p);
                }}
                onFileAction={onFileAction}
                actionLabel={actionLabel}
                actionVariant={actionVariant}
                onFileOpen={onFileOpen}
                focusedPath={focusedPath}
                visibleIndex={visibleIndex}
                onFocusRow={focusPath}
              />
            ))}
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical">
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}

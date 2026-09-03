import { useMemo, useState } from "react";
import clsx from "clsx";
import { ScrollArea } from "@base-ui/react/scroll-area";
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
import { Button } from "@/shared/components/ui";
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
}: TreeRowProps) {
  if (!node.isFile) {
    return (
      <>
        <Button
          variant="none"
          className={clsx(s.treeRow, s.treeDir)}
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => onToggle(node.path)}
          aria-expanded={open}
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
          <div className={s.treeChildren}>
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
      onClick={onFileOpen ? () => onFileOpen(node) : undefined}
    >
      <span className={s.treeSpacer} aria-hidden />
      <StatusIcon status={node.status} />
      <span className={`${s.treeName} mono`}>{node.name}</span>
      {onFileAction && actionLabel && (
        <Button
          variant="none"
          className={clsx(s.treeFileAction, actionVariant === "unstage" && s.treeFileActionUnstage)}
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
  const findNode = (path: string): FileTreeNode | null => {
    const walk = (n: FileTreeNode): FileTreeNode | null => {
      if (n.path === path) return n;
      for (const c of n.children) {
        const found = walk(c);
        if (found) return found;
      }
      return null;
    };
    return walk(root);
  };

  const toggle = (path: string) =>
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
    });

  const expandAll = () => setExpanded(new Set(dirPaths));
  const collapseAll = () => setExpanded(new Set());

  const allExpanded = dirPaths.length > 0 && dirPaths.every((p) => expanded.has(p));

  return (
    <div className={s.fileTree}>
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
          <ScrollArea.Content className={s.fileTreeRowsContent}>
            {root.children.map((c) => (
              <TreeRow
                key={c.path}
                node={c}
                depth={0}
                open={expanded.has(c.path)}
                expanded={expanded}
                onToggle={toggle}
                onFileAction={onFileAction}
                actionLabel={actionLabel}
                actionVariant={actionVariant}
                onFileOpen={onFileOpen}
              />
            ))}
          </ScrollArea.Content>
        </ScrollArea.Viewport>
        <ScrollArea.Scrollbar orientation="vertical" className="scrollbarTrack" keepMounted>
          <ScrollArea.Thumb className="scrollbarThumb" />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>
    </div>
  );
}

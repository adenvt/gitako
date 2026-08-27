import { useMemo, useState } from "react";
import {
  ChevronRight,
  FilePenLine,
  FilePlus,
  FileSymlink,
  FileX,
  Folder,
  FolderOpen,
  ListCollapse,
  ListTree,
} from "lucide-react";
import { collectDirPaths, type FileTreeNode } from "./fileTree";
import { statusLabel } from "@/shared/utils/status";

interface FileTreeProps {
  root: FileTreeNode;
}

/** Icon for a file's git status, matching the reference UI's pencil/plus style. */
export function StatusIcon({ status }: { status: string }) {
  const props = {
    size: 14,
    strokeWidth: 2.2,
    className: `tree-status-icon file-status-${status.toLowerCase()}`,
    "aria-hidden": true,
  } as const;
  switch (status) {
    case "A":
      return <FilePlus {...props} />;
    case "D":
      return <FileX {...props} />;
    case "R":
    case "C":
      return <FileSymlink {...props} />;
    default:
      return <FilePenLine {...props} />;
  }
}

interface TreeRowProps {
  node: FileTreeNode;
  depth: number;
  open: boolean;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}

function TreeRow({ node, depth, open, expanded, onToggle }: TreeRowProps) {
  if (!node.isFile) {
    return (
      <>
        <button
          className="tree-row tree-dir"
          style={{ paddingLeft: 6 + depth * 14 }}
          onClick={() => onToggle(node.path)}
          aria-expanded={open}
        >
          <ChevronRight
            size={14}
            className={`tree-arrow${open ? " open" : ""}`}
            aria-hidden
          />
          {open ? (
            <FolderOpen size={14} className="tree-folder-icon" aria-hidden />
          ) : (
            <Folder size={14} className="tree-folder-icon" aria-hidden />
          )}
          <span className="tree-name">{node.name || "/"}</span>
        </button>
        {open && (
          <div className="tree-children">
            {node.children.map((c) => (
              <TreeRow
                key={c.path}
                node={c}
                depth={depth + 1}
                open={expanded.has(c.path)}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  return (
    <div
      className="tree-row tree-file"
      style={{ paddingLeft: 6 + depth * 14 }}
      title={`${statusLabel(node.status)}: ${node.path}`}
    >
      <span className="tree-spacer" aria-hidden />
      <StatusIcon status={node.status} />
      <span className="tree-name mono">{node.name}</span>
    </div>
  );
}

export function FileTree({ root }: FileTreeProps) {
  const dirPaths = useMemo(() => collectDirPaths(root), [root]);

  // Top-level directories start expanded; deeper ones collapsed.
  const topLevelDirs = useMemo(
    () => root.children.filter((c) => !c.isFile).map((c) => c.path),
    [root],
  );
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(topLevelDirs),
  );

  const toggle = (path: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });

  const expandAll = () => setExpanded(new Set(dirPaths));
  const collapseAll = () => setExpanded(new Set());

  const allExpanded =
    dirPaths.length > 0 && dirPaths.every((p) => expanded.has(p));

  return (
    <div className="file-tree">
      {dirPaths.length > 0 && (
        <div className="file-tree-toolbar">
          {allExpanded ? (
            <button className="tree-toolbar-btn" onClick={collapseAll}>
              <ListCollapse size={13} aria-hidden />
              Collapse all
            </button>
          ) : (
            <button className="tree-toolbar-btn" onClick={expandAll}>
              <ListTree size={13} aria-hidden />
              Expand all
            </button>
          )}
        </div>
      )}
      <div className="file-tree-rows">
        {root.children.map((c) => (
          <TreeRow
            key={c.path}
            node={c}
            depth={0}
            open={expanded.has(c.path)}
            expanded={expanded}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
}

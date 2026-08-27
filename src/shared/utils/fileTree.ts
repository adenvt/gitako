/** A path + git status letter pair, the input shape for tree building. */
export interface TreeEntry {
  path: string;
  status: string;
}

/** Prefix shown in the tree root row for files at the repo root. */
const ROOT_LABEL = "…";

/**
 * Build a nested tree from flat file paths.
 *
 * Directories are implicit: only paths that have at least one file underneath
 * become nodes. The tree is stable — directories sort before files, and
 * siblings sort alphabetically — so the output doesn't jitter as more commits
 * are inspected.
 */
export interface FileTreeNode {
  /** Directory name, or full file name for leaves. */
  name: string;
  /** Full relative path (empty for the implicit root). */
  path: string;
  /** True when this node is a file (leaf). */
  isFile: boolean;
  /** Raw git status for files (empty for directories). */
  status: string;
  /** Children, when a directory. */
  children: FileTreeNode[];
}

function statusOf(e: TreeEntry): string {
  return e.status[0] ?? e.status;
}

export function buildFileTree(entries: TreeEntry[]): FileTreeNode {
  const root: FileTreeNode = {
    name: ROOT_LABEL,
    path: "",
    isFile: false,
    status: "",
    children: [],
  };

  for (const e of entries) {
    const parts = e.path.split("/");
    let node = root;
    let acc = "";
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      let child = node.children.find((c) => c.name === part);
      if (!child) {
        child = {
          name: part,
          path: acc,
          isFile,
          status: "",
          children: [],
        };
        node.children.push(child);
      }
      node = child;
    }
    // Leaf: attach the git status.
    if (node.isFile) {
      node.status = statusOf(e);
    }
  }

  // Directories first, then files; alphabetical within each group.
  const sort = (n: FileTreeNode) => {
    n.children.sort((a, b) => {
      if (a.isFile !== b.isFile) return a.isFile ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
    n.children.forEach(sort);
  };
  sort(root);

  return root;
}

/** All directory node paths, for "expand all" / "collapse all". */
export function collectDirPaths(root: FileTreeNode): string[] {
  const dirs: string[] = [];
  const walk = (n: FileTreeNode) => {
    if (!n.isFile && n.path) dirs.push(n.path);
    n.children.forEach(walk);
  };
  walk(root);
  return dirs;
}

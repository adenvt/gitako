import { FilePenLine, FilePlus, FileSymlink, FileX } from "lucide-react";
import clsx from "clsx";
import s from "./fileTree.module.css";

const statusClass: Record<string, string> = {
  a: s.statusAdded,
  d: s.statusDeleted,
};

/** Icon for a file's git status (pencil/plus/X/symlink), colored by kind. */
export function StatusIcon({ status }: { status: string }) {
  const props = {
    size: 14,
    strokeWidth: 2.2,
    className: clsx(s.treeStatusIcon, statusClass[status.toLowerCase()] ?? s.statusChanged),
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

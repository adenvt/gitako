import {
  PlusIcon,
  FileSymlinkFileIcon,
  FileRemovedIcon,
  FileDiffIcon,
} from "@primer/octicons-react";
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
    className: clsx(s.treeStatusIcon, statusClass[status.toLowerCase()] ?? s.statusChanged),
    "aria-hidden": true,
  } as const;
  switch (status) {
    case "A":
      return <PlusIcon {...props} />;
    case "D":
      return <FileRemovedIcon {...props} />;
    case "R":
    case "C":
      return <FileSymlinkFileIcon {...props} />;
    default:
      return <FileDiffIcon {...props} />;
  }
}

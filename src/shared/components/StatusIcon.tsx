import { FilePenLine, FilePlus, FileSymlink, FileX } from "lucide-react";

/** Icon for a file's git status (pencil/plus/X/symlink), colored by kind. */
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

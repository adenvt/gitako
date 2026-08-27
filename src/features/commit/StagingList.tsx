import { StatusIcon } from "@/shared/components/StatusIcon";
import type { StatusEntry } from "@/shared/utils/status";

interface StagingListProps {
  title: string;
  entries: StatusEntry[];
  onBulk?: () => void;
  bulkLabel?: string;
  onRowAction: (entry: StatusEntry) => void;
  actionLabel: string;
}

/**
 * Flat list of working-tree files for the composer, one section (unstaged or
 * staged). The action button (Stage/Unstage) is revealed on row hover.
 */
export function StagingList({
  title,
  entries,
  onBulk,
  bulkLabel,
  onRowAction,
  actionLabel,
}: StagingListProps) {
  return (
    <div className="staging-section">
      <div className="staging-header">
        <span className="staging-title">
          {title} ({entries.length})
        </span>
        {onBulk && bulkLabel && entries.length > 0 && (
          <button className="staging-bulk" onClick={onBulk}>
            {bulkLabel}
          </button>
        )}
      </div>
      {entries.length === 0 ? (
        <div className="staging-empty">Nothing here.</div>
      ) : (
        <ul className="staging-list">
          {entries.map((e) => {
            const status = e.index !== "." ? e.index : e.worktree;
            const label = e.oldPath ? `${e.oldPath} → ${e.path}` : e.path;
            return (
              <li key={e.path} className="staging-row">
                <StatusIcon status={status} />
                <span className="staging-path" title={label}>
                  {label}
                </span>
                <button
                  className="staging-action"
                  onClick={() => onRowAction(e)}
                >
                  {actionLabel}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

import { useEffect, useMemo } from "react";
import { useRepoStore } from "@/state/store";
import { formatDate } from "@/shared/utils/time";
import { shortHash } from "@/shared/utils/hash";
import { statusLabel } from "@/shared/utils/status";
import { buildFileTree } from "@/shared/utils/fileTree";
import { FileTree } from "@/shared/components/FileTree";
import { StatusIcon } from "@/shared/components/StatusIcon";
import { laneColor } from "@/features/commit-graph/colors";
import type { ChangedFile } from "@/shared/types/git";

/** Number of changed files per status letter, e.g. { M: 3, A: 2 }. */
function fileStatusCounts(files: ChangedFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const s = f.status[0] ?? f.status;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  return counts;
}

export function CommitDetail() {
  const { commits, layout, selectedHash, filesByCommit, loadCommitFiles, openDiff } = useRepoStore();

  const commit = commits.find((c) => c.hash === selectedHash);
  const files = commit ? filesByCommit[commit.hash] : undefined;
  // Match ref badge color to the commit's graph node (lane color).
  const badgeColor = (() => {
    if (!commit || !layout) return undefined;
    const idx = layout.commits.findIndex((lc) => lc.hash === commit.hash);
    return idx >= 0 ? laneColor(layout.commits[idx].lane) : undefined;
  })();

  // Hooks must be called unconditionally (Rules of Hooks) — before any
  // early return — so the hook order stays stable across renders.
  const tree = useMemo(() => (files ? buildFileTree(files) : null), [files]);
  const counts = useMemo(() => (files ? fileStatusCounts(files) : null), [files]);

  useEffect(() => {
    if (selectedHash) {
      loadCommitFiles(selectedHash);
    }
  }, [selectedHash, loadCommitFiles]);

  if (!commit) {
    return (
      <div className="detail-pane">
        <h3>Commit details</h3>
        <div className="pane-placeholder">
          <p className="muted">Select a commit to see its details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="detail-pane">
      <h3>Commit details</h3>
      <div className="detail-commit">
        <div className="detail-subject">{commit.subject}</div>
        <dl className="detail-meta">
          <dt>Author</dt>
          <dd>
            {commit.authorName} &lt;{commit.authorEmail}&gt;
          </dd>
          <dt>Date</dt>
          <dd>{formatDate(commit.authorTime)}</dd>
          <dt>Hash</dt>
          <dd className="mono">{shortHash(commit.hash)}</dd>
          {commit.parents.length > 0 && (
            <>
              <dt>Parents</dt>
              <dd className="mono">{commit.parents.map((p) => shortHash(p)).join(", ")}</dd>
            </>
          )}
          {commit.refs.length > 0 && (
            <>
              <dt>Refs</dt>
              <dd>
                {commit.refs.map((r) => (
                  <span
                    key={r}
                    className="commit-ref-badge"
                    style={badgeColor ? ({ "--badge-color": badgeColor } as React.CSSProperties) : undefined}
                  >
                    {r}
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className="detail-files">
        <h4>Changed files</h4>
        {files && counts ? (
          <>
            <div className="file-stats">
              {Object.entries(counts)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([status, n]) => (
                  <span key={status} className="file-stat">
                    <StatusIcon status={status} />
                    {n} {statusLabel(status).toLowerCase()}
                  </span>
                ))}
            </div>
            {tree && tree.children.length > 0 ? (
              <FileTree root={tree} onFileOpen={(n) => void openDiff(commit.hash, n.path)} />
            ) : (
              <p className="muted">No files changed.</p>
            )}
          </>
        ) : (
          <div className="pane-placeholder">
            <p className="muted">Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}

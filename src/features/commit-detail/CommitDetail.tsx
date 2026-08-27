import { useEffect, useMemo } from "react";
import { useRepoStore } from "@/state/store";
import { formatDate } from "@/shared/utils/time";
import { shortHash } from "@/shared/utils/hash";
import { statusLabel } from "@/shared/utils/status";
import { buildFileTree, fileStatusCounts } from "./fileTree";
import { FileTree } from "./FileTree";
import { StatusIcon } from "@/shared/components/StatusIcon";

export function CommitDetail() {
  const { commits, selectedHash, filesByCommit, loadCommitFiles } =
    useRepoStore();

  const commit = commits.find((c) => c.hash === selectedHash);
  const files = commit ? filesByCommit[commit.hash] : undefined;

  // Hooks must be called unconditionally (Rules of Hooks) — before any
  // early return — so the hook order stays stable across renders.
  const tree = useMemo(() => (files ? buildFileTree(files) : null), [files]);
  const counts = useMemo(
    () => (files ? fileStatusCounts(files) : null),
    [files],
  );

  useEffect(() => {
    if (selectedHash) {
      loadCommitFiles(selectedHash);
    }
  }, [selectedHash, loadCommitFiles]);

  if (!commit) {
    return (
      <div className="detail-pane">
        <h3>Commit details</h3>
        <p className="muted">Select a commit to see its details.</p>
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
              <dd className="mono">
                {commit.parents.map((p) => shortHash(p)).join(", ")}
              </dd>
            </>
          )}
          {commit.refs.length > 0 && (
            <>
              <dt>Refs</dt>
              <dd>
                {commit.refs.map((r) => (
                  <span key={r} className="commit-ref-badge">
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
              <FileTree root={tree} />
            ) : (
              <p className="muted">No files changed.</p>
            )}
          </>
        ) : (
          <p className="muted">Loading…</p>
        )}
      </div>
    </div>
  );
}

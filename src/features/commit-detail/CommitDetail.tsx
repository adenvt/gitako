import { useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useRepoStore } from "@/state/store";
import { formatDate } from "@/shared/utils/time";
import { shortHash } from "@/shared/utils/hash";
import { statusLabel } from "@/shared/utils/status";
import { buildFileTree } from "@/shared/utils/fileTree";
import { FileTree } from "@/shared/components/FileTree";
import { StatusIcon } from "@/shared/components/StatusIcon";
import { laneColor } from "@/features/commit-graph/colors";
import badge from "@/features/commit-graph/refBadge.module.css";
import s from "./detail.module.css";
import type { ChangedFile } from "@/shared/types/git";

/** Number of changed files per status letter, e.g. { M: 3, A: 2 }. */
export function fileStatusCounts(files: ChangedFile[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const f of files) {
    const st = f.status[0] ?? f.status;
    counts[st] = (counts[st] ?? 0) + 1;
  }
  return counts;
}

export function CommitDetail() {
  const { commits, layout, selectedHash, filesByCommit, loadCommitFiles, openDiff, refsByCommit } =
    useRepoStore(
      useShallow((st) => ({
        commits: st.commits,
        layout: st.layout,
        selectedHash: st.selectedHash,
        filesByCommit: st.filesByCommit,
        loadCommitFiles: st.loadCommitFiles,
        openDiff: st.openDiff,
        refsByCommit: st.refsByCommit,
      })),
    );

  const commit = commits.find((c) => c.hash === selectedHash);
  const files = commit ? filesByCommit[commit.hash] : undefined;
  // Full ref info (vs. `commit.refs` which is just names) — needed because
  // a local branch and its remote tracking ref share a `name` (e.g. `main`
  // + `origin/main`) and we need a unique React key.
  const refInfos = commit ? (refsByCommit[commit.hash] ?? []) : [];
  // Match ref badge color to the commit's graph node (lane color). Use a
  // Map so this stays O(1) per render even for repos with thousands of
  // commits — the alternative (layout.commits.findIndex) was O(n) and
  // ran on every re-render.
  const badgeColor = useMemo(() => {
    if (!commit || !layout) return undefined;
    const idx = new Map(layout.commits.map((lc, i) => [lc.hash, i])).get(commit.hash);
    return idx !== undefined ? laneColor(layout.commits[idx].lane) : undefined;
  }, [commit, layout]);

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
      <div className={s.detailPane}>
        <h3>Commit details</h3>
        <div className={s.panePlaceholder}>
          <p className="muted">Select a commit to see its details.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={s.detailPane}>
      <h3>Commit details</h3>
      <div>
        <div className={s.detailSubject}>{commit.subject}</div>
        <dl className={s.detailMeta}>
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
          {refInfos.length > 0 && (
            <>
              <dt>Refs</dt>
              <dd>
                {refInfos.map((r) => (
                  <span
                    key={r.fullName}
                    className={badge.commitRefBadge}
                    style={
                      badgeColor
                        ? ({ "--badge-color": badgeColor } as React.CSSProperties)
                        : undefined
                    }
                  >
                    {r.name}
                  </span>
                ))}
              </dd>
            </>
          )}
        </dl>
      </div>

      <div className={s.detailFiles}>
        <h4>Changed files</h4>
        {files && counts ? (
          <>
            <div className={s.fileStats}>
              {Object.entries(counts)
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map(([status, n]) => (
                  <span key={status} className={s.fileStat}>
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
          <div className={s.panePlaceholder}>
            <p className="muted">Loading…</p>
          </div>
        )}
      </div>
    </div>
  );
}

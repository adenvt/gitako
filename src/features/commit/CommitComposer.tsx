import { useMemo, useState } from "react";
import { useRepoStore } from "@/state/store";
import { buildFileTree } from "@/shared/utils/fileTree";
import { FileTree } from "@/shared/components/FileTree";
import type { StatusEntry } from "@/shared/utils/status";

function toTreeEntry(e: StatusEntry) {
  // Parser normalizes spaces to "." and untracked "?" to "A".
  const status = e.index !== "." ? e.index : e.worktree;
  return { path: e.oldPath ? `${e.oldPath} → ${e.path}` : e.path, status };
}

/** Right-pane commit composer: two staging trees + subject/description + commit. */
export function CommitComposer() {
  const {
    statusEntries,
    stagedPaths,
    composerError,
    toggleStage,
    stageAll,
    unstageAll,
    commit,
    openDiff,
  } = useRepoStore();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const { unstagedTree, stagedTree, unstagedCount, stagedCount } = useMemo(() => {
    const unstaged: StatusEntry[] = [];
    const staged: StatusEntry[] = [];
    for (const e of statusEntries) {
      if (stagedPaths.has(e.path)) staged.push(e);
      else unstaged.push(e);
    }
    return {
      unstagedTree: buildFileTree(unstaged.map(toTreeEntry)),
      stagedTree: buildFileTree(staged.map(toTreeEntry)),
      unstagedCount: unstaged.length,
      stagedCount: staged.length,
    };
  }, [statusEntries, stagedPaths]);

  const canCommit = stagedCount > 0 && subject.trim().length > 0 && !busy;

  const handleCommit = async () => {
    if (!canCommit) return;
    setBusy(true);
    try {
      await commit(subject, description);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="detail-pane composer">
      <div className="composer-head">
        <h3>Commit WIP</h3>
      </div>

      <div className="staging-section">
        <div className="staging-header">
          <span className="staging-title">Unstaged ({unstagedCount})</span>
          {unstagedCount > 0 && (
            <button className="staging-bulk" onClick={() => void stageAll()}>
              Stage all
            </button>
          )}
        </div>
        <FileTree
          root={unstagedTree}
          onFileAction={(n) => void toggleStage(n.path, true)}
          actionLabel="Stage"
          onFileOpen={(n) => void openDiff("", n.path)}
        />
      </div>

      <div className="staging-section">
        <div className="staging-header">
          <span className="staging-title">Staged ({stagedCount})</span>
          {stagedCount > 0 && (
            <button className="staging-bulk" onClick={() => void unstageAll()}>
              Unstage all
            </button>
          )}
        </div>
        <FileTree
          root={stagedTree}
          onFileAction={(n) => void toggleStage(n.path, false)}
          actionLabel="Unstage"
          onFileOpen={(n) => void openDiff("", n.path, true)}
        />
      </div>

      <div className="composer-form">
        <input
          type="text"
          className="input composer-subject"
          placeholder="Subject (required)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void handleCommit();
            }
          }}
        />
        <textarea
          className="input composer-description"
          placeholder="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {composerError && <p className="composer-error">{composerError}</p>}
        <button
          className="composer-commit"
          disabled={!canCommit}
          onClick={() => void handleCommit()}
        >
          {busy ? "Committing…" : "Commit"}
        </button>
      </div>
    </div>
  );
}

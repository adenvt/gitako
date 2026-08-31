import { useEffect, useMemo, useState } from "react";
import { useRepoStore } from "@/state/store";
import { buildFileTree } from "@/shared/utils/fileTree";
import { FileTree } from "@/shared/components/FileTree";
import { useAppSettings } from "@/shared/compositions/useAppSettings";
import { Button, Input, Textarea } from "@/shared/components/ui";
import detail from "@/features/commit-detail/detail.module.css";
import s from "./composer.module.css";
import type { StatusEntry } from "@/shared/utils/status";

export function toTreeEntry(e: StatusEntry) {
  // Parser normalizes spaces to "." and untracked "?" to "A".
  const status = e.index !== "." ? e.index : e.worktree;
  return { path: e.oldPath ? `${e.oldPath} → ${e.path}` : e.path, status };
}

/** Right-pane commit composer: two staging trees + subject/description + commit. */
export function CommitComposer() {
  const {
    statusEntries,
    stagedPaths,
    toggleStage,
    stageAll,
    unstageAll,
    commit,
    openDiff,
    refreshStatus,
  } = useRepoStore();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  // Reflect staging done outside the app (e.g. `git add` in a terminal) by
  // polling status while the composer is open. Interval is user-configurable;
  // 0 disables polling.
  const { statusPollMs } = useAppSettings();
  useEffect(() => {
    if (statusPollMs <= 0) return;
    const t = window.setInterval(() => void refreshStatus(), statusPollMs);
    return () => window.clearInterval(t);
  }, [refreshStatus, statusPollMs]);

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
    <div className={`${detail.detailPane} ${s.composer}`}>
      <div className={s.composerHead}>
        <h3>Commit WIP</h3>
      </div>

      <div className={`${s.stagingSection} ${s.stagingUnstaged}`}>
        <div className={s.stagingHeader}>
          <span className={s.stagingTitle}>Unstaged ({unstagedCount})</span>
          {unstagedCount > 0 && (
            <Button variant="none" className={s.stagingBulk} onClick={() => void stageAll()}>
              Stage all
            </Button>
          )}
        </div>
        <FileTree
          root={unstagedTree}
          onFileAction={(n) => void toggleStage(n.path, true)}
          actionLabel="Stage"
          actionVariant="stage"
          onFileOpen={(n) => void openDiff("", n.path)}
        />
      </div>

      <div className={`${s.stagingSection} ${s.stagingStaged}`}>
        <div className={s.stagingHeader}>
          <span className={s.stagingTitle}>Staged ({stagedCount})</span>
          {stagedCount > 0 && (
            <Button variant="none" className={s.stagingBulk} onClick={() => void unstageAll()}>
              Unstage all
            </Button>
          )}
        </div>
        <FileTree
          root={stagedTree}
          onFileAction={(n) => void toggleStage(n.path, false)}
          actionLabel="Unstage"
          actionVariant="unstage"
          onFileOpen={(n) => void openDiff("", n.path, true)}
        />
      </div>

      <div className={s.composerForm}>
        <Input
          type="text"
          className={s.composerSubject}
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
        <Textarea
          className={s.composerDescription}
          placeholder="Description"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <Button
          variant="none"
          className={s.composerCommit}
          disabled={!canCommit}
          onClick={() => void handleCommit()}
        >
          {busy ? "Committing…" : "Commit"}
        </Button>
      </div>
    </div>
  );
}

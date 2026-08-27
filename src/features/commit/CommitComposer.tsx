import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { useRepoStore } from "@/state/store";
import type { StatusEntry } from "@/shared/utils/status";
import { StagingList } from "./StagingList";

/** Right-pane commit composer: two staging lists + subject/description + commit. */
export function CommitComposer() {
  const {
    statusEntries,
    stagedPaths,
    composerError,
    closeComposer,
    toggleStage,
    stageAll,
    unstageAll,
    commit,
  } = useRepoStore();

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const { unstaged, staged } = useMemo(() => {
    const u: StatusEntry[] = [];
    const s: StatusEntry[] = [];
    for (const e of statusEntries) {
      if (stagedPaths.has(e.path)) s.push(e);
      else u.push(e);
    }
    return { unstaged: u, staged: s };
  }, [statusEntries, stagedPaths]);

  const canCommit = staged.length > 0 && subject.trim().length > 0 && !busy;

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
        <button
          className="composer-close"
          onClick={closeComposer}
          aria-label="Close composer"
        >
          <X size={15} aria-hidden />
        </button>
      </div>

      <StagingList
        title="Unstaged"
        entries={unstaged}
        onBulk={() => void stageAll()}
        bulkLabel="Stage all"
        onRowAction={(e) => void toggleStage(e.path, true)}
        actionLabel="Stage"
      />

      <StagingList
        title="Staged"
        entries={staged}
        onBulk={() => void unstageAll()}
        bulkLabel="Unstage all"
        onRowAction={(e) => void toggleStage(e.path, false)}
        actionLabel="Unstage"
      />

      <div className="composer-form">
        <input
          type="text"
          className="composer-subject"
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
          className="composer-description"
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

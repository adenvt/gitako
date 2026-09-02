import { useEffect, useMemo, useState } from "react";
import { ZapIcon } from "@primer/octicons-react";
import { useRepoStore } from "@/state/store";
import { buildFileTree } from "@/shared/utils/fileTree";
import { FileTree } from "@/shared/components/FileTree";
import { useAppSettings } from "@/shared/compositions/useAppSettings";
import { useAiSettings } from "@/shared/compositions/useAiSettings";
import { isAiConfigured } from "@/shared/utils/aiSettings";
import { generateCommitMessage } from "@/features/ai";
import { errorMessage } from "@/shared/utils/error";
import { toastError, toastLoading, toastSuccess } from "@/shared/components/Toaster";
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
    repoPath,
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
  const [aiBusy, setAiBusy] = useState(false);
  const aiSettings = useAiSettings();

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
  const aiConfigured = isAiConfigured(aiSettings);
  const canGenerate = stagedCount > 0 && aiConfigured && !aiBusy;

  const handleCommit = async () => {
    if (!canCommit) return;
    setBusy(true);
    try {
      await commit(subject, description);
    } finally {
      setBusy(false);
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate || !repoPath) return;
    setAiBusy(true);
    // AbortController wires the toast's Cancel button to the in-flight
    // HTTP request. `signal.aborted` is also the tell that distinguishes
    // a user cancel from a real network/API failure in the catch.
    const controller = new AbortController();
    const loading = toastLoading("Generating commit message…", {
      description: "This can take a few seconds.",
      action: { label: "Cancel", onClick: () => controller.abort() },
    });
    try {
      const { subject: s, description: d } = await generateCommitMessage({
        settings: aiSettings,
        repoPath,
        signal: controller.signal,
      });
      setSubject(s);
      if (d) setDescription(d);
      loading.close();
      toastSuccess("Commit message generated");
    } catch (e) {
      loading.close();
      if (controller.signal.aborted) {
        // User-initiated cancel — no error toast, the click was the signal.
        return;
      }
      toastError("AI generation failed", errorMessage(e));
    } finally {
      setAiBusy(false);
    }
  };

  const generateTooltip = !aiConfigured
    ? "Configure your API key in AI settings"
    : stagedCount === 0
      ? "Stage files first"
      : "Generate commit message from staged diff";

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
        <div className={s.subjectRow}>
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
          <button
            type="button"
            className={s.aiIconBtn}
            disabled={!canGenerate}
            onClick={() => void handleGenerate()}
            aria-label={aiBusy ? "Generating commit message" : "Generate commit message"}
            title={generateTooltip}
          >
            <ZapIcon size={14} aria-hidden />
          </button>
        </div>
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

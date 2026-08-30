import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Archive, Settings } from "lucide-react";
import { useRepoStore } from "@/state/store";
import { countChanges } from "@/shared/utils/status";
import { Button } from "@/shared/components/ui";
import s from "./workspace.module.css";

/**
 * Pick the local branch name to show in the toolbar from a list of ref
 * strings. The first ref that does NOT contain a `/` is treated as the
 * local branch (remote branches are always `remote/name`); when none
 * qualify, the user is in detached-HEAD state and we show a placeholder.
 */
export function pickLocalBranch(refs: string[]): string {
  return refs.find((r) => !r.includes("/")) ?? "detached HEAD";
}

/** Last path component of a repo path, for the toolbar's "repo name" pill. */
export function repoNameFromPath(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.split("/").filter(Boolean).pop();
}

/** Transient "not yet implemented" notice for placeholder toolbar actions. */
export function Toolbar() {
  const { repoPath, commits, loading, refresh, statusEntries } = useRepoStore();
  const [notice, setNotice] = useState<string | null>(null);

  const head = commits[0];
  const headRefs = head?.refs ?? [];
  const branch = pickLocalBranch(headRefs);
  const repoName = repoNameFromPath(repoPath);
  const dirty = countChanges(statusEntries) > 0;

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 2500);
  };

  const handlePull = () => {
    void refresh();
  };

  return (
    <div className={s.toolbar}>
      <div className={s.toolbarLeft}>
        <span className={s.toolbarRepo}>{repoName}</span>
        <span className={s.toolbarBranch} title={branch}>
          on {branch}
        </span>
        {head && <span className={s.toolbarHash}>{head.hash.slice(0, 7)}</span>}
      </div>

      <div className={s.toolbarDivider} aria-hidden />

      <div className={s.toolbarActions}>
        <Button
          variant="solid"
          className={s.toolbarBtn}
          onClick={handlePull}
          disabled={loading}
          title={loading ? "Refreshing…" : "Fetch and refresh"}
        >
          <ArrowDownToLine size={13} aria-hidden />
          {loading ? "pull…" : "pull"}
        </Button>
        <Button
          variant="solid"
          className={s.toolbarBtn}
          onClick={() => showNotice("Push - not yet implemented (ROADMAP Phase 5)")}
        >
          <ArrowUpFromLine size={13} aria-hidden />
          push
        </Button>
        <Button
          variant="solid"
          className={s.toolbarBtn}
          onClick={() => showNotice("Stash - not yet implemented (ROADMAP Phase 4)")}
        >
          <Archive size={13} aria-hidden />
          stash
        </Button>
        <Button
          variant="solid"
          className={s.toolbarBtn}
          onClick={() => showNotice("Settings - not yet implemented (ROADMAP Phase 7)")}
        >
          <Settings size={13} aria-hidden />
          settings
        </Button>
      </div>

      <div className={s.toolbarRight}>
        {dirty && (
          <span className={s.toolbarDirty} title="Uncommitted changes">
            *
          </span>
        )}
        {repoPath && (
          <span className={s.toolbarPath} title={repoPath}>
            {repoPath}
          </span>
        )}
      </div>

      {notice && (
        <div className={s.toolbarNotice} role="status">
          {notice}
        </div>
      )}
    </div>
  );
}

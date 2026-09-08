import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { ArrowUpIcon, ArchiveIcon, BookIcon, GearIcon } from "@primer/octicons-react";
import { useRepoStore } from "@/state/store";
import { countChanges } from "@/shared/utils/status";
import { Button } from "@/shared/components/ui";
import { toastManager } from "@/shared/components/Toaster";
import { BranchSwitcher } from "./BranchSwitcher";
import { PullMenu } from "./PullMenu";
import s from "./workspace.module.css";

/** Last path component of a repo path, for the toolbar's "repo name" pill. */
export function repoNameFromPath(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return path.split("/").filter(Boolean).pop();
}

/** Transient "not yet implemented" notice for placeholder toolbar actions. */
export function Toolbar() {
  const {
    repoPath,
    loading,
    pushing,
    push: pushAction,
    statusEntries,
    openOverlay,
  } = useRepoStore(
    useShallow((st) => ({
      repoPath: st.repoPath,
      loading: st.loading,
      pushing: st.pushing,
      push: st.push,
      statusEntries: st.statusEntries,
      openOverlay: st.openOverlay,
    })),
  );
  const [notice, setNotice] = useState<string | null>(null);

  const head = useRepoStore((st) => st.commits[0]);
  const repoName = repoNameFromPath(repoPath);
  const dirty = countChanges(statusEntries) > 0;

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 2500);
  };

  const handlePush = () => {
    void pushAction();
  };

  // Dev-only shortcut to the Storybook dev server. import.meta.env.DEV is
  // statically replaced with `false` in production builds, so the whole branch
  // is dead-code-eliminated from the production bundle.
  const handleOpenStorybook = () => {
    const url = "http://localhost:6006";
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (win === null) {
      toastManager.add({
        type: "error",
        title: "Popup blocked",
        description: `Open Storybook manually: ${url}`,
      });
    }
  };

  return (
    <div className={s.toolbar}>
      <div className={s.toolbarLeft}>
        <span className={s.toolbarRepo}>{repoName}</span>
        <BranchSwitcher />
        {head && <span className={s.toolbarHash}>{head.hash.slice(0, 7)}</span>}
      </div>

      <div className={s.toolbarDivider} aria-hidden />

      <div className={s.toolbarActions}>
        <PullMenu />
        <Button
          variant="solid"
          className={s.toolbarBtn}
          onClick={handlePush}
          loading={pushing}
          disabled={loading}
          title={pushing ? "Pushing…" : "Push to remote"}
        >
          <ArrowUpIcon size={13} aria-hidden />
          {pushing ? "push…" : "push"}
        </Button>
        <Button
          variant="solid"
          className={s.toolbarBtn}
          onClick={() => showNotice("Stash - not yet implemented (ROADMAP Phase 4)")}
        >
          <ArchiveIcon size={13} aria-hidden />
          stash
        </Button>
        <Button variant="solid" className={s.toolbarBtn} onClick={() => openOverlay("ai-settings")}>
          <GearIcon size={13} aria-hidden />
          settings
        </Button>
        {import.meta.env.DEV && (
          <Button
            variant="solid"
            className={s.toolbarBtn}
            onClick={handleOpenStorybook}
            title="Open Storybook in browser"
          >
            <BookIcon size={13} aria-hidden />
            storybook
          </Button>
        )}
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

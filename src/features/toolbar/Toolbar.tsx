import { useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Archive, Settings } from "lucide-react";
import { useRepoStore } from "@/state/store";
import { countChanges } from "@/shared/utils/status";

/** Transient "not yet implemented" notice for placeholder toolbar actions. */
export function Toolbar() {
  const { repoPath, commits, loading, refresh, statusEntries } = useRepoStore();
  const [notice, setNotice] = useState<string | null>(null);

  const head = commits[0];
  const headRefs = head?.refs ?? [];
  const branch = headRefs.find((r) => !r.includes("/")) ?? "detached HEAD";
  const dirty = countChanges(statusEntries) > 0;

  const showNotice = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((cur) => (cur === msg ? null : cur)), 2500);
  };

  const handlePull = () => {
    void refresh();
  };

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <span className="toolbar-repo">{repoPath?.split("/").filter(Boolean).pop()}</span>
        <span className="toolbar-branch" title={branch}>
          {branch}
        </span>
        {head && <span className="toolbar-hash mono">{head.hash.slice(0, 7)}</span>}
      </div>

      <div className="toolbar-actions">
        <button
          className="btn toolbar-btn"
          onClick={handlePull}
          disabled={loading}
          title={loading ? "Refreshing…" : "Fetch and refresh"}
        >
          <ArrowDownToLine size={14} aria-hidden />
          {loading ? "Refreshing…" : "Pull"}
        </button>
        <button
          className="btn toolbar-btn"
          onClick={() => showNotice("Push - not yet implemented (ROADMAP Phase 5)")}
        >
          <ArrowUpFromLine size={14} aria-hidden />
          Push
        </button>
        <button
          className="btn toolbar-btn"
          onClick={() => showNotice("Stash - not yet implemented (ROADMAP Phase 4)")}
        >
          <Archive size={14} aria-hidden />
          Stash
        </button>
        <button
          className="btn toolbar-btn"
          onClick={() => showNotice("Settings - not yet implemented (ROADMAP Phase 7)")}
        >
          <Settings size={14} aria-hidden />
          Settings
        </button>
      </div>

      <div className="toolbar-right">
        {dirty && <span className="toolbar-dirty" title="Uncommitted changes">WIP</span>}
        {repoPath && <span className="toolbar-path" title={repoPath}>{repoPath}</span>}
      </div>

      {notice && <div className="toolbar-notice" role="status">{notice}</div>}
    </div>
  );
}

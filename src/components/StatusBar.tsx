import { useRepoStore } from "../state/store";

export function StatusBar() {
  const { repoPath, commits, loading } = useRepoStore();
  const head = commits[0];
  const headRefs = head?.refs ?? [];
  const branch = headRefs.find((r) => !r.includes("/")) ?? "detached HEAD";

  return (
    <div className="status-bar">
      <span className="status-branch">{branch}</span>
      {head && <span className="status-hash">{head.hash.slice(0, 7)}</span>}
      <span className="status-count">{commits.length} commits</span>
      {repoPath && <span className="status-path">{repoPath}</span>}
      {loading && <span className="status-loading">refreshing…</span>}
    </div>
  );
}

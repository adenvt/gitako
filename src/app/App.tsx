import { CommitList } from "@/features/commit-graph/CommitList";
import { CommitDetail } from "@/features/commit-detail/CommitDetail";
import { CommitComposer } from "@/features/commit/CommitComposer";
import { StatusBar } from "@/features/status-bar/StatusBar";
import { OpenRepo } from "@/features/repo/OpenRepo";
import { useRepoStore } from "@/state/store";

export default function App() {
  const { repoPath, composerOpen } = useRepoStore();

  return (
    <div className="app">
      {!repoPath ? (
        <OpenRepo />
      ) : (
        <div className="workspace">
          <StatusBar />
          <div className="main">
            <CommitList />
            {composerOpen ? <CommitComposer /> : <CommitDetail />}
          </div>
        </div>
      )}
    </div>
  );
}

import { CommitList } from "@/features/commit-graph/CommitList";
import { CommitDetail } from "@/features/commit-detail/CommitDetail";
import { StatusBar } from "@/features/status-bar/StatusBar";
import { OpenRepo } from "@/features/repo/OpenRepo";
import { useRepoStore } from "@/state/store";

export default function App() {
  const { repoPath } = useRepoStore();

  return (
    <div className="app">
      {!repoPath ? (
        <OpenRepo />
      ) : (
        <div className="workspace">
          <StatusBar />
          <div className="main">
            <CommitList />
            <CommitDetail />
          </div>
        </div>
      )}
    </div>
  );
}

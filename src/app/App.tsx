import { CommitList } from "@/features/commit-graph/CommitList";
import { CommitDetail } from "@/features/commit-detail/CommitDetail";
import { CommitComposer } from "@/features/commit/CommitComposer";
import { DiffView } from "@/features/diff/DiffView";
import { Toolbar } from "@/features/toolbar/Toolbar";
import { OpenRepo } from "@/features/repo/OpenRepo";
import { useRepoStore } from "@/state/store";

export default function App() {
  const { repoPath, composerOpen, activeDiff } = useRepoStore();

  return (
    <div className="app">
      {!repoPath ? (
        <OpenRepo />
      ) : (
        <div className="workspace">
          <Toolbar />
          <div className="main">
            {activeDiff ? <DiffView /> : <CommitList />}
            {composerOpen ? <CommitComposer /> : <CommitDetail />}
          </div>
        </div>
      )}
    </div>
  );
}

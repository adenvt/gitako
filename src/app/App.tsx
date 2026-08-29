import { CommitList } from "@/features/commit-graph/CommitList";
import { CommitDetail } from "@/features/commit-detail/CommitDetail";
import { CommitComposer } from "@/features/commit/CommitComposer";
import { DiffView } from "@/features/diff/DiffView";
import { Toolbar } from "@/features/toolbar/Toolbar";
import { OpenRepo } from "@/features/repo/OpenRepo";
import { useRepoStore } from "@/state/store";
import styles from "./app.module.css";
import workspace from "@/features/toolbar/workspace.module.css";

export default function App() {
  const { repoPath, composerOpen, activeDiff } = useRepoStore();

  return (
    <div className={styles.app}>
      {!repoPath ? (
        <OpenRepo />
      ) : (
        <div className={workspace.workspace}>
          <Toolbar />
          <div className={workspace.main}>
            {activeDiff ? <DiffView /> : <CommitList />}
            {composerOpen ? <CommitComposer /> : <CommitDetail />}
          </div>
        </div>
      )}
    </div>
  );
}

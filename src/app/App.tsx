import { CommitList } from "@/features/commit-graph/CommitList";
import { CommitDetail } from "@/features/commit-detail/CommitDetail";
import { CommitComposer } from "@/features/commit/CommitComposer";
import { DiffView } from "@/features/diff/DiffView";
import { Toolbar } from "@/features/toolbar/Toolbar";
import { OpenRepo } from "@/features/repo/OpenRepo";
import { AiSettingsPage } from "@/features/ai/settings/AiSettingsPage";
import { useRepoStore } from "@/state/store";
import { Toaster, toastManager } from "@/shared/components/Toaster";
import { Toast } from "@base-ui/react/toast";
import styles from "./app.module.css";
import workspace from "@/features/toolbar/workspace.module.css";

export default function App() {
  const { repoPath, composerOpen, activeDiff, overlay, closeOverlay } = useRepoStore();

  return (
    <Toast.Provider toastManager={toastManager}>
      <div className={styles.app}>
        {!repoPath ? (
          <OpenRepo />
        ) : (
          <div className={workspace.workspace}>
            {overlay === "ai-settings" ? (
              <div className={workspace.main}>
                <AiSettingsPage onBack={closeOverlay} />
              </div>
            ) : (
              <>
                <Toolbar />
                <div className={workspace.main}>
                  {activeDiff ? <DiffView /> : <CommitList />}
                  {composerOpen ? <CommitComposer /> : <CommitDetail />}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      <Toaster />
    </Toast.Provider>
  );
}

import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { CommitList } from "./components/CommitList";
import { CommitDetail } from "./components/CommitDetail";
import { StatusBar } from "./components/StatusBar";
import { useRepoStore } from "./state/store";
import { repoRoot } from "./state/git";

export default function App() {
  const { repoPath, openRepo, error } = useRepoStore();
  const [pathInput, setPathInput] = useState("");

  const handleOpen = async (path: string) => {
    try {
      const root = await repoRoot(path);
      await openRepo(root);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Cannot open repository: ${msg}`);
    }
  };

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open a git repository",
      });
      if (typeof selected === "string" && selected) {
        await handleOpen(selected);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to open picker: ${msg}`);
    }
  };

  return (
    <div className="app">
      {!repoPath ? (
        <div className="welcome">
          <h1>gitui</h1>
          <p>Open a git repository to see its commit graph</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pathInput.trim()) void handleOpen(pathInput.trim());
            }}
          >
            <input
              type="text"
              placeholder="/path/to/repo"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
            />
            <button type="submit">Open</button>
          </form>
          <button className="link" onClick={() => void handleBrowse()}>
            Browse…
          </button>
          {error && <p className="error">{error}</p>}
        </div>
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

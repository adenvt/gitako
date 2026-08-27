import { useEffect, useMemo, useState } from "react";
import { FolderOpen, Search, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { useRepoStore } from "@/state/store";
import { repoRoot } from "@/state/git";
import {
  addRecentRepo,
  loadRecentRepos,
  removeRecentRepo,
  type RecentRepo,
} from "@/shared/utils/recentRepos";

async function repoDisplayPath(path: string): Promise<string> {
  try {
    const home = await homeDir();
    return path.startsWith(home) ? `~${path.slice(home.length)}` : path;
  } catch {
    return path;
  }
}

export function OpenRepo() {
  const { openRepo, error } = useRepoStore();
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<RecentRepo[]>(() => loadRecentRepos());
  const [displayPaths, setDisplayPaths] = useState<Record<string, string>>({});

  // Resolve ~/ display paths once per session (homeDir is async; the path
  // plugin must be registered in the Rust backend).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const r of recent) {
        try {
          map[r.path] = await repoDisplayPath(r.path);
        } catch {
          map[r.path] = r.path;
        }
      }
      if (!cancelled) setDisplayPaths(map);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenPath = async (path: string) => {
    try {
      const root = await repoRoot(path);
      addRecentRepo(root);
      const next = loadRecentRepos();
      setRecent(next);
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
        await handleOpenPath(selected);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Failed to open picker: ${msg}`);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recent;
    return recent.filter(
      (r) => r.name.toLowerCase().includes(q) || r.path.toLowerCase().includes(q),
    );
  }, [recent, query]);

  const remove = (path: string) => {
    removeRecentRepo(path);
    setRecent(loadRecentRepos());
  };

  return (
    <div className="welcome">
      <div className="welcome-header">
        <div>
          <h1>Repositories</h1>
        </div>
        <div className="welcome-actions">
          <button className="welcome-btn" onClick={() => void handleBrowse()}>
            <FolderOpen size={15} aria-hidden />
            Open
          </button>
        </div>
      </div>

      <div className="welcome-search">
        <Search size={14} className="welcome-search-icon" aria-hidden />
        <input
          type="text"
          placeholder="Search repositories"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button
            className="welcome-clear"
            onClick={() => setQuery("")}
            aria-label="Clear search"
          >
            <X size={13} aria-hidden />
          </button>
        )}
      </div>

      {recent.length > 0 ? (
        <div className="welcome-recents">
          <div className="welcome-section-label">Recent</div>
          <ul className="welcome-list">
            {filtered.map((r) => (
              <li
                key={r.path}
                className="welcome-item"
                onClick={() => void handleOpenPath(r.path)}
              >
                <div className="welcome-item-name">{r.name}</div>
                <div className="welcome-item-path">
                  {displayPaths[r.path] ?? r.path}
                </div>
                <button
                  className="welcome-item-remove"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(r.path);
                  }}
                  aria-label={`Remove ${r.name} from recent`}
                >
                  <X size={13} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="welcome-empty">
          <p className="muted">No repositories yet.</p>
          <p className="muted">Click Open to pick a git repository folder.</p>
        </div>
      )}

      {error && <p className="error">{error}</p>}
    </div>
  );
}

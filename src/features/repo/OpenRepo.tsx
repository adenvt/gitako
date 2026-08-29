import { useEffect, useMemo, useState } from "react";
import { FolderOpen, GitBranch, Search, X } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { useRepoStore } from "@/state/store";
import { repoRoot } from "@/state/git";
import { Button, Input } from "@/shared/components/ui";
import {
  addRecentRepo,
  loadRecentRepos,
  removeRecentRepo,
  type RecentRepo,
} from "@/shared/utils/recentRepos";
import s from "./repo.module.css";

export async function repoDisplayPath(path: string): Promise<string> {
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
  const [banner, setBanner] = useState<string | null>(null);

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
      setBanner(`Cannot open repository: ${msg}`);
    }
  };

  const handleBrowse = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open a git repository",
        defaultPath: await homeDir(),
      });
      if (typeof selected === "string" && selected) {
        await handleOpenPath(selected);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setBanner(`Failed to open picker: ${msg}`);
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
    <div className={s.welcome}>
      <div className={s.welcomeBrand}>
        <GitBranch size={18} className={s.welcomeBrandIcon} aria-hidden />
        <span className={s.welcomeBrandName}>GiTako</span>
      </div>

      <div className={s.welcomeHeader}>
        <h1>Repositories</h1>
        <div className={s.welcomeActions}>
          <Button variant="solid" className={s.welcomeBtn} onClick={() => void handleBrowse()}>
            <FolderOpen size={15} aria-hidden />
            Open
          </Button>
        </div>
      </div>

      <div className={s.welcomeSearch}>
        <Search size={14} className={s.welcomeSearchIcon} aria-hidden />
        <Input
          type="text"
          className={s.welcomeSearchInput}
          placeholder="Search repositories"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <Button variant="ghost" className={s.welcomeClear} onClick={() => setQuery("")} aria-label="Clear search">
            <X size={13} aria-hidden />
          </Button>
        )}
      </div>

      {recent.length > 0 ? (
        <div className={s.welcomeRecents}>
          <div className={`${s.welcomeSectionLabel} section-label`}>Recent</div>
          <ul className={s.welcomeList}>
            {filtered.map((r) => (
              <li key={r.path} className={s.welcomeItem} onClick={() => void handleOpenPath(r.path)}>
                <div className={s.welcomeItemName}>{r.name}</div>
                <div className={`${s.welcomeItemPath} mono`}>{displayPaths[r.path] ?? r.path}</div>
                <Button
                  variant="ghost"
                  className={s.welcomeItemRemove}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(r.path);
                  }}
                  aria-label={`Remove ${r.name} from recent`}
                >
                  <X size={13} aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className={s.welcomeEmpty}>
          <GitBranch size={28} className={s.welcomeEmptyIcon} aria-hidden />
          <p className="muted">No repositories yet.</p>
          <p className="muted">Click Open to pick a git repository folder.</p>
          <Button variant="primary" className={s.welcomeEmptyBtn} onClick={() => void handleBrowse()}>
            <FolderOpen size={15} aria-hidden />
            Open
          </Button>
        </div>
      )}

      {(error || banner) && (
        <div className={s.welcomeError} role="alert">
          {error ?? banner}
        </div>
      )}
    </div>
  );
}

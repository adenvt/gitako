/** Recently opened repositories, persisted to localStorage. */

export interface RecentRepo {
  path: string;
  name: string;
  lastOpened: number;
}

const STORAGE_KEY = "gitako.recentRepos";
const MAX_RECENT = 20;

export function loadRecentRepos(): RecentRepo[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentRepo[];
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.path === "string") : [];
  } catch {
    return [];
  }
}

function saveRecentRepos(repos: RecentRepo[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(repos));
  } catch {
    // localStorage unavailable (private mode etc.) — non-fatal.
  }
}

/** Remember a repo (dedup by path, most recent first). */
export function addRecentRepo(path: string): void {
  const name = path.split("/").filter(Boolean).pop() ?? path;
  const entry: RecentRepo = { path, name, lastOpened: Date.now() };
  const repos = [entry, ...loadRecentRepos().filter((r) => r.path !== path)].slice(0, MAX_RECENT);
  saveRecentRepos(repos);
}

/** Remove a repo from the recent list (e.g. it no longer exists). */
export function removeRecentRepo(path: string): void {
  saveRecentRepos(loadRecentRepos().filter((r) => r.path !== path));
}

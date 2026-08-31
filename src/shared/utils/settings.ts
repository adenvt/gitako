/**
 * App settings, persisted to localStorage. The settings page (ROADMAP Phase 7)
 * will edit these; until then they default and are read directly.
 */

export interface AppSettings {
  /** Poll interval (ms) for refreshing working-tree status while the commit
   * composer is open. 0 disables polling. */
  statusPollMs: number;
}

const STORAGE_KEY = "gitako.settings";
const DEFAULT_SETTINGS: AppSettings = { statusPollMs: 3000 };

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      statusPollMs:
        typeof parsed.statusPollMs === "number" && parsed.statusPollMs >= 0
          ? parsed.statusPollMs
          : DEFAULT_SETTINGS.statusPollMs,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // localStorage unavailable (private mode etc.) — non-fatal.
  }
}

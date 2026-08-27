/** Human-friendly relative time, e.g. "5m", "3h", "2d", "1mo". */
export function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 30) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / (86400 * 30))}mo`;
}

/** Absolute timestamp formatted for the locale. */
export function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

/** Shorten a full commit hash to 7 characters for display. */
export function shortHash(hash: string): string {
  return hash.slice(0, 7);
}

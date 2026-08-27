import type { GitErrorPayload } from "../types/git";

/** Coerce a thrown invoke error into the typed GitErrorPayload. */
export function toGitError(e: unknown): GitErrorPayload {
  return e as GitErrorPayload;
}

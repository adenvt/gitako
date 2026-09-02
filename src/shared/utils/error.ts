import type { GitErrorPayload } from "@/shared/types/git";

/** Coerce a thrown invoke error into the typed GitErrorPayload. */
export function toGitError(e: unknown): GitErrorPayload {
  return e as GitErrorPayload;
}

/**
 * Extract a human-readable message from a thrown value. Tauri invoke
 * rejections are plain `GitErrorPayload` objects (not Error instances), so
 * `String(e)` would produce "[object Object]" — pull `.message` off the
 * payload instead.
 */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "object" && e !== null && "message" in e) {
    const m = (e as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  if (typeof e === "string") return e;
  return String(e);
}

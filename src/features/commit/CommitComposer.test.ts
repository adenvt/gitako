import { describe, expect, it } from "vitest";
import { toTreeEntry } from "./CommitComposer";
import type { StatusEntry } from "@/shared/utils/status";

describe("toTreeEntry", () => {
  it("uses the index status when it's set, ignoring the worktree status", () => {
    // "AM" = staged-add with worktree-modification. Composer shows it as
    // added because the index (staged) status wins.
    const e: StatusEntry = { index: "A", worktree: "M", path: "a.ts", oldPath: null };
    expect(toTreeEntry(e)).toEqual({ path: "a.ts", status: "A" });
  });

  it("falls back to the worktree status when the index is untouched ('.')", () => {
    const e: StatusEntry = { index: ".", worktree: "M", path: "a.ts", oldPath: null };
    expect(toTreeEntry(e)).toEqual({ path: "a.ts", status: "M" });
  });

  it("emits 'old -> new' for renames (when oldPath is present)", () => {
    const e: StatusEntry = {
      index: "R",
      worktree: ".",
      path: "new.ts",
      oldPath: "old.ts",
    };
    // Note: this is a literal "→" (U+2192), not "->", matching the source.
    expect(toTreeEntry(e).path).toBe("old.ts → new.ts");
  });

  it("does not label the path as a rename when oldPath is null", () => {
    const e: StatusEntry = { index: "A", worktree: ".", path: "new.ts", oldPath: null };
    expect(toTreeEntry(e).path).toBe("new.ts");
  });

  it("preserves an empty oldPath as null (does not render 'null -> path')", () => {
    // Edge case: even an empty string is falsy, so the rename branch is skipped.
    const e: StatusEntry = { index: "A", worktree: ".", path: "p.ts", oldPath: "" };
    expect(toTreeEntry(e).path).toBe("p.ts");
  });

  it("passes through the status character unchanged (no normalization)", () => {
    // The composer is a display layer; normalization happens in the parser.
    // Whatever status the parser produced is shown verbatim.
    const e: StatusEntry = { index: ".", worktree: "?", path: "u.ts", oldPath: null };
    expect(toTreeEntry(e).status).toBe("?");
  });
});

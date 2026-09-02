import { describe, expect, it } from "vitest";
import { fileStatusCounts } from "./CommitDetail";
import type { ChangedFile } from "@/shared/types/git";

function file(status: string, path = `f-${status}.txt`): ChangedFile {
  return { status, path, oldPath: null };
}

describe("fileStatusCounts", () => {
  it("returns an empty object for an empty file list", () => {
    expect(fileStatusCounts([])).toEqual({});
  });

  it("groups files by their first status character (the kind letter)", () => {
    // Real status strings are single letters but defensive code uses the
    // first character so it tolerates the score suffix on renames/copies.
    const files = [file("M", "a.ts"), file("M", "b.ts"), file("A", "c.ts"), file("D", "d.ts")];
    expect(fileStatusCounts(files)).toEqual({ M: 2, A: 1, D: 1 });
  });

  it("collapses renames to their kind letter (R100 -> R)", () => {
    const files = [
      file("R100", "old -> new"),
      file("R100", "old2 -> new2"),
      file("C075", "src -> dst"),
    ];
    expect(fileStatusCounts(files)).toEqual({ R: 2, C: 1 });
  });

  it("returns zero counts for unrecognised status strings", () => {
    // Empty status is the production guard; verify the empty-string bucket
    // is recorded exactly once rather than skipped silently.
    expect(fileStatusCounts([file("")])).toEqual({ "": 1 });
  });
});

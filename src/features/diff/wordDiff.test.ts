import { describe, expect, it } from "vitest";
import { diffWords } from "./wordDiff";

function segs(segments: { text: string; changed: boolean }[]): string {
  return segments.map((s) => `${s.changed ? "[" : ""}${s.text}${s.changed ? "]" : ""}`).join("");
}

describe("diffWords", () => {
  it("marks identical lines as fully unchanged", () => {
    const { oldSegs, newSegs } = diffWords("const x = 1;", "const x = 1;");
    expect(oldSegs.every((s) => !s.changed)).toBe(true);
    expect(newSegs.every((s) => !s.changed)).toBe(true);
    expect(segs(oldSegs)).toBe("const x = 1;");
  });

  it("marks completely different lines as fully changed (whitespace tokens are unchanged)", () => {
    const { oldSegs, newSegs } = diffWords("hello world", "totally different");
    // Both lines contain a space token, so the space itself is unchanged;
    // every word is changed.
    expect(oldSegs.filter((s) => s.changed).map((s) => s.text)).toEqual(["hello", "world"]);
    expect(newSegs.filter((s) => s.changed).map((s) => s.text)).toEqual(["totally", "different"]);
    // The space runs are not changed.
    expect(oldSegs.filter((s) => !s.changed).map((s) => s.text)).toEqual([" "]);
  });

  it("marks only the differing word runs as changed", () => {
    const { oldSegs, newSegs } = diffWords("line2", "line2 edited");
    expect(segs(oldSegs)).toBe("line2");
    expect(oldSegs[0].changed).toBe(false);
    // new: "line2" unchanged, " edited" changed (space + word merge into one run)
    expect(segs(newSegs)).toBe("line2[ edited]");
  });

  it("handles a word replaced in the middle", () => {
    const { oldSegs, newSegs } = diffWords("foo bar baz", "foo qux baz");
    expect(segs(oldSegs)).toBe("foo [bar] baz");
    expect(segs(newSegs)).toBe("foo [qux] baz");
  });

  it("marks a whitespace-only difference as changed", () => {
    const { oldSegs, newSegs } = diffWords("a  b", "a b");
    // old's "  " run and new's " " run don't match each other → both changed.
    expect(oldSegs.some((s) => s.changed && s.text === "  ")).toBe(true);
    expect(newSegs.some((s) => s.changed && s.text === " ")).toBe(true);
  });

  it("handles an empty side (pure insertion/deletion)", () => {
    const { oldSegs, newSegs } = diffWords("", "brand new");
    expect(oldSegs).toEqual([]);
    expect(newSegs.every((s) => s.changed)).toBe(true);
  });

  it("keeps punctuation attached to the adjacent word", () => {
    const { newSegs } = diffWords("return 1;", "return 2;");
    // the "2;" token is changed; the leading space stays unchanged
    expect(segs(newSegs)).toBe("return [2;]");
  });
});

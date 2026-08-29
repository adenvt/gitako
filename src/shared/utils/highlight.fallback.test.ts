import { describe, expect, it, vi } from "vitest";
import { langForPath } from "./highlight";

// Build a stub highlighter and inject it via vi.mock. We capture the factory
// so individual tests can change its behaviour between assertions.
const factories: Array<(opts: unknown) => unknown> = [];

vi.mock("shiki", () => ({
  createHighlighter: (opts: unknown) => {
    const fn = factories[factories.length - 1];
    return fn ? fn(opts) : Promise.reject(new Error("no factory registered"));
  },
}));

/**
 * Re-imports `highlightLines` after installing a fresh shiki factory.
 * The implementation has a module-level cache for the highlighter promise,
 * so we use `vi.resetModules()` to drop that cache between scenarios.
 */
async function loadWithFactory(
  factory: Parameters<typeof factories.push>[0],
): Promise<(typeof import("./highlight"))["highlightLines"]> {
  vi.resetModules();
  factories.push(factory);
  const mod = await import("./highlight");
  return mod.highlightLines;
}

describe("highlightLines fallback", () => {
  it("returns plain per-line tokens when shiki fails to load a language", async () => {
    const hl = await loadWithFactory(() => ({
      getLoadedLanguages: () => [],
      loadLanguage: () => Promise.reject(new Error("unknown")),
      codeToTokens: () => {
        throw new Error("should not be called on the fallback path");
      },
    }));

    const lines = await hl("x", "not-a-real-language");
    // Fallback: one token per line, no color.
    expect(lines).toEqual([[{ text: "x" }]]);
  });

  it("returns plain per-line tokens when the shiki factory itself throws", async () => {
    const hl = await loadWithFactory(() => Promise.reject(new Error("boom")));
    const lines = await hl("line1\nline2", "ts");
    expect(lines).toEqual([
      [{ text: "line1" }],
      [{ text: "line2" }],
    ]);
  });

  it("returns plain per-line tokens when the highlighter exists but the language is plaintext and shiki returns nothing useful", async () => {
    // plaintext is a "no-op" language for shiki; ensure the fallback shape
    // is still a list of single-text tokens per line.
    const hl = await loadWithFactory(() => ({
      getLoadedLanguages: () => ["plaintext"],
      loadLanguage: () => Promise.resolve(),
      codeToTokens: () => ({ tokens: [[{ content: "hello", color: undefined }]] }),
    }));
    const lines = await hl("hello", "plaintext");
    expect(lines).toEqual([[{ text: "hello" }]]);
  });

  it("returns the cached result on repeated calls with the same code/lang", async () => {
    let callCount = 0;
    const hl = await loadWithFactory(() => {
      callCount++;
      return Promise.reject(new Error("never reached on the second call"));
    });
    const a = await hl("x", "ts");
    const b = await hl("x", "ts");
    // Same reference -> served from the lineCache without re-invoking.
    expect(a).toBe(b);
    // The factory only runs once across both calls.
    expect(callCount).toBe(1);
  });
});

describe("langForPath (re-imported)", () => {
  it("returns the expected language", () => {
    expect(langForPath("a.ts")).toBe("typescript");
  });
});

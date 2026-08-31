import { describe, expect, it } from "vitest";
import { errorMessage } from "./error";

describe("errorMessage", () => {
  it("returns the message from a Tauri-style error payload object", () => {
    expect(errorMessage({ kind: "other", message: "git restore failed", code: 128 })).toBe(
      "git restore failed",
    );
  });

  it("returns the message from a real Error", () => {
    expect(errorMessage(new Error("boom"))).toBe("boom");
  });

  it("returns the value for a thrown string", () => {
    expect(errorMessage("fatal: something")).toBe("fatal: something");
  });

  it("falls back to String() for unknown values", () => {
    expect(errorMessage(42)).toBe("42");
    expect(errorMessage(null)).toBe("null");
    expect(errorMessage(undefined)).toBe("undefined");
  });

  it("does not produce [object Object] for payload objects", () => {
    const msg = errorMessage({ message: "", code: 1, kind: "other" } as unknown);
    expect(msg).not.toBe("[object Object]");
  });
});

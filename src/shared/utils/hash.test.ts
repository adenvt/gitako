import { describe, expect, it } from "vitest";
import { shortHash } from "./hash";

describe("shortHash", () => {
  it("returns the first 7 characters of a full hash", () => {
    expect(shortHash("abcdef0123456789")).toBe("abcdef0");
  });

  it("returns the input unchanged when shorter than 7 characters", () => {
    expect(shortHash("abc")).toBe("abc");
    expect(shortHash("")).toBe("");
  });

  it("does not mutate or lowercase the input", () => {
    // shortHash is purely a slice — case and length are preserved.
    expect(shortHash("ABCDEF0123456789")).toBe("ABCDEF0");
  });
});

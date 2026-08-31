import { describe, expect, it } from "vitest";
import { langForPath } from "./highlight";

describe("langForPath", () => {
  it("maps common single extensions to shiki language ids", () => {
    expect(langForPath("a.ts")).toBe("typescript");
    expect(langForPath("a.tsx")).toBe("tsx");
    expect(langForPath("a.js")).toBe("javascript");
    expect(langForPath("a.py")).toBe("python");
    expect(langForPath("a.rs")).toBe("rust");
    expect(langForPath("a.go")).toBe("go");
  });

  it("treats .cjs and .mjs as JavaScript", () => {
    expect(langForPath("a.cjs")).toBe("javascript");
    expect(langForPath("a.mjs")).toBe("javascript");
  });

  it("treats .h as C and .hpp as C++", () => {
    expect(langForPath("a.h")).toBe("c");
    expect(langForPath("a.hpp")).toBe("cpp");
    expect(langForPath("a.cc")).toBe("cpp");
  });

  it("treats .kts as Kotlin", () => {
    expect(langForPath("a.kts")).toBe("kotlin");
  });

  it("uses the full filename 'dockerfile' (case-insensitive) for docker", () => {
    expect(langForPath("Dockerfile")).toBe("docker");
    expect(langForPath("dockerfile")).toBe("docker");
  });

  it("falls back to plaintext for unknown extensions", () => {
    expect(langForPath("a.unknownext")).toBe("plaintext");
  });

  it("falls back to plaintext when there is no extension", () => {
    expect(langForPath("Makefile")).toBe("plaintext");
    expect(langForPath("LICENSE")).toBe("plaintext");
  });

  it("uses the LAST extension (after the final dot)", () => {
    // tar.gz — ext is `gz`, not in the map -> plaintext.
    expect(langForPath("a.tar.gz")).toBe("plaintext");
  });

  it("is case-insensitive on the extension", () => {
    expect(langForPath("A.TS")).toBe("typescript");
    expect(langForPath("A.PY")).toBe("python");
  });
});

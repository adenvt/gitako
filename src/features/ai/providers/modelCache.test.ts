import { describe, expect, it, beforeEach } from "vitest";
import { MODEL_CACHE_TTL_MS, pruneModelCache, readModelCache, writeModelCache } from "./modelCache";
import type { AiSettings } from "@/shared/utils/aiSettings";

const baseSettings: AiSettings = {
  providerId: "openai-compatible",
  apiKey: "sk-test",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
};

describe("modelCache", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns null when nothing is cached", () => {
    expect(readModelCache(baseSettings)).toBeNull();
  });

  it("writes and reads a model list for a (baseUrl, apiKey) pair", () => {
    writeModelCache(baseSettings, ["a", "b", "c"]);
    expect(readModelCache(baseSettings)).toEqual(["a", "b", "c"]);
  });

  it("returns a defensive copy (mutating the result doesn't poison the cache)", () => {
    writeModelCache(baseSettings, ["a"]);
    const got = readModelCache(baseSettings);
    expect(got).toEqual(["a"]);
    got?.push("b");
    expect(readModelCache(baseSettings)).toEqual(["a"]);
  });

  it("separates caches for different baseUrls", () => {
    const other: AiSettings = { ...baseSettings, baseUrl: "http://localhost:11434" };
    writeModelCache(baseSettings, ["gpt-4o"]);
    writeModelCache(other, ["llama3.1"]);
    expect(readModelCache(baseSettings)).toEqual(["gpt-4o"]);
    expect(readModelCache(other)).toEqual(["llama3.1"]);
  });

  it("separates caches for different api keys", () => {
    const other: AiSettings = { ...baseSettings, apiKey: "sk-other" };
    writeModelCache(baseSettings, ["gpt-4o"]);
    writeModelCache(other, ["claude-sonnet"]);
    expect(readModelCache(baseSettings)).toEqual(["gpt-4o"]);
    expect(readModelCache(other)).toEqual(["claude-sonnet"]);
  });

  it("returns null for a cache entry past MODEL_CACHE_TTL_MS", () => {
    writeModelCache(baseSettings, ["a"]);
    // Tamper with the stored fetchedAt so it looks stale.
    const raw = localStorage.getItem("gitako.ai.models-cache");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!);
    const key = Object.keys(parsed)[0];
    parsed[key].fetchedAt = Date.now() - MODEL_CACHE_TTL_MS - 1;
    localStorage.setItem("gitako.ai.models-cache", JSON.stringify(parsed));
    expect(readModelCache(baseSettings)).toBeNull();
  });

  it("overwrites the entry when the same (baseUrl, apiKey) is written twice", () => {
    writeModelCache(baseSettings, ["old"]);
    writeModelCache(baseSettings, ["new1", "new2"]);
    expect(readModelCache(baseSettings)).toEqual(["new1", "new2"]);
  });

  it("ignores malformed entries instead of throwing", () => {
    localStorage.setItem("gitako.ai.models-cache", "{not json");
    expect(readModelCache(baseSettings)).toBeNull();
  });

  describe("pruneModelCache", () => {
    it("keeps entries for keys present in the active list", () => {
      writeModelCache(baseSettings, ["a"]);
      pruneModelCache([baseSettings]);
      expect(readModelCache(baseSettings)).toEqual(["a"]);
    });

    it("drops entries whose key pair is not in the active list", () => {
      const stale: AiSettings = {
        ...baseSettings,
        apiKey: "sk-rotated",
        baseUrl: "https://other.example.com/v1",
      };
      writeModelCache(baseSettings, ["a"]);
      writeModelCache(stale, ["old"]);
      pruneModelCache([baseSettings]);
      expect(readModelCache(baseSettings)).toEqual(["a"]);
      expect(readModelCache(stale)).toBeNull();
    });

    it("no-ops when the active list is empty", () => {
      writeModelCache(baseSettings, ["a"]);
      pruneModelCache([]);
      expect(readModelCache(baseSettings)).toEqual(["a"]);
    });
  });
});

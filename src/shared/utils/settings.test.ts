import { afterEach, describe, expect, it } from "vitest";
import { loadSettings, saveSettings } from "./settings";

const KEY = "gitako.settings";

afterEach(() => {
  localStorage.removeItem(KEY);
});

describe("settings persistence", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadSettings()).toEqual({ statusPollMs: 3000 });
  });

  it("round-trips saved settings", () => {
    saveSettings({ statusPollMs: 5000 });
    expect(loadSettings()).toEqual({ statusPollMs: 5000 });
  });

  it("falls back to defaults for invalid values", () => {
    localStorage.setItem(KEY, JSON.stringify({ statusPollMs: -1 }));
    expect(loadSettings()).toEqual({ statusPollMs: 3000 });
    localStorage.setItem(KEY, JSON.stringify({ statusPollMs: "fast" }));
    expect(loadSettings()).toEqual({ statusPollMs: 3000 });
  });

  it("falls back to defaults on corrupt JSON", () => {
    localStorage.setItem(KEY, "{not json");
    expect(loadSettings()).toEqual({ statusPollMs: 3000 });
  });
});
